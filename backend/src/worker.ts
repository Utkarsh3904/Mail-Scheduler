import "dotenv/config";
import { Worker, DelayedError, Job } from "bullmq";
import { workerRedis } from "./redis";
import { QUEUE_NAME } from "./queue";
import { pool } from "./db";
import { sendEmail } from "./mailer";
import { canSendNow, msUntilNextHour } from "./rateLimit";
import { sendSlackMessage, shouldNotify } from "./slack";
import { indexEmail } from "./search";
import { startReconciler } from "./reconciler";

const concurrency = Number(process.env.WORKER_CONCURRENCY) || 5;
const minDelayMs = Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS) || 2000;

type JobData = {
  emailId: number;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  hourlyLimit: number;
};

async function handleJob(job: Job<JobData>, token?: string) {
  const { emailId, sender, recipient, subject, body, hourlyLimit } = job.data;

  console.log(`[worker] handleJob invoked: jobId=${job.id}, emailId=${emailId}`);

  try {
    // idempotency check - if this row is already marked sent, skip it.
    const existing = await pool.query(
      "SELECT status, user_id FROM emails WHERE id = $1",
      [emailId]
    );

    if (existing.rows.length === 0) {
      console.log(`email ${emailId} was deleted, skipping`);
      return;
    }

    if (existing.rows[0].status === "sent") {
      console.log(`email ${emailId} already sent, skipping`);
      return;
    }

    const userId = existing.rows[0].user_id;

    // rate limit check - per sender, per hour, backed by redis.
    const allowed = await canSendNow(sender, hourlyLimit);

    if (!allowed) {
      const waitMs = msUntilNextHour();
      console.log(`sender ${sender} hit hourly limit, pushing job to next hour`);

      const notify = await shouldNotify(sender);
      if (notify) {
        await sendSlackMessage(
          userId,
          `Hourly send limit reached for sender ${sender}. Remaining emails will resume next hour.`
        );
      }

      if (token) {
        await job.moveToDelayed(Date.now() + waitMs, token);
        throw new DelayedError();
      }
      throw new Error("rate limited, no token to delay job, will retry with backoff");
    }

    try {
      const result = await sendEmail({ from: sender, to: recipient, subject, html: body });
      const sentTime = new Date();

      await pool.query(
        "UPDATE emails SET status = 'sent', sent_time = $1, error_message = NULL WHERE id = $2",
        [sentTime, emailId]
      );

      await indexEmail(emailId, {
        userId,
        sender,
        recipient,
        subject,
        body,
        status: "sent",
        sentTime: sentTime.toISOString(),
      });

      console.log(`sent email ${emailId} to ${recipient}, preview: ${result.previewUrl}`);
    } catch (err: any) {
      console.log(`failed to send email ${emailId}:`, err.message);
      await pool.query(
        "UPDATE emails SET status = 'failed', error_message = $1 WHERE id = $2",
        [err.message, emailId]
      );
      throw err; // let bullmq retry it a couple times before giving up
    }
  } catch (err: any) {
    // DelayedError is an intentional reschedule signal, not a failure - log softly.
    if (err instanceof DelayedError) {
      console.log(`job ${job.id} rescheduled (rate limit), not a failure`);
      throw err;
    }
    console.error(`[worker] unexpected error in handleJob jobId=${job.id} emailId=${emailId}:`, err?.stack || err);
    throw err;
  }
}

// the limiter makes sure the worker only starts 1 job per minDelayMs,
// across the whole process - this is the "minimum delay between sends" rule
const worker = new Worker(QUEUE_NAME, handleJob, {
  connection: workerRedis,
  concurrency,
  limiter: {
    max: 1,
    duration: minDelayMs,
  },
});

console.log(`[worker] created Worker on queue "${QUEUE_NAME}" listening for jobs (concurrency=${concurrency}, minDelayMs=${minDelayMs})`);

worker.on("completed", (job) => console.log(`job ${job.id} done`));
worker.on("failed", (job, err) => console.log(`job ${job?.id} failed:`, err.message));
worker.on("error", (err) => console.error("[worker] worker-level connection/processing error:", err?.stack || err));

console.log(`worker started, concurrency=${concurrency}, minDelayMs=${minDelayMs}`);

// Start self-healing reconciler to pick up any scheduled emails missed by Redis
startReconciler();

