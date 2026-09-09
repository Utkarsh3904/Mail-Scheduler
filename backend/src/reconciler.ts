import { pool } from "./db";
import { emailQueue } from "./queue";

let isReconciling = false;

export async function reconcileScheduledEmails() {
  if (isReconciling) return;
  isReconciling = true;

  try {
    // Find all emails marked as 'scheduled'
    const result = await pool.query(
      `SELECT id, user_id, sender, recipient, subject, body, scheduled_time, delay_ms, hourly_limit, job_id
       FROM emails
       WHERE status = 'scheduled'
       ORDER BY scheduled_time ASC`
    );

    const scheduledEmails = result.rows;
    if (scheduledEmails.length === 0) {
      return;
    }

    let enqueuedCount = 0;
    const now = Date.now();

    for (const email of scheduledEmails) {
      const jobId = `email-${email.id}`;

      try {
        // Check if the job already exists in BullMQ / Redis
        const existingJob = await emailQueue.getJob(jobId);
        if (existingJob) {
          const state = await existingJob.getState();
          // If the job is active, waiting, or delayed in Redis, it's already properly scheduled
          if (state === "delayed" || state === "waiting" || state === "active") {
            continue;
          }
        }

        // Calculate delay from now. If the scheduled_time has already arrived or passed, delay is 0 (send now)
        const scheduledTimeMs = new Date(email.scheduled_time).getTime();
        const delayFromNow = Math.max(scheduledTimeMs - now, 0);

        await emailQueue.add(
          "send-email",
          {
            emailId: email.id,
            sender: email.sender,
            recipient: email.recipient,
            subject: email.subject,
            body: email.body,
            hourlyLimit: email.hourly_limit,
          },
          {
            delay: delayFromNow,
            jobId,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
          }
        );

        if (email.job_id !== jobId) {
          await pool.query("UPDATE emails SET job_id = $1 WHERE id = $2", [
            jobId,
            email.id,
          ]);
        }

        enqueuedCount++;
      } catch (err: any) {
        console.error(`[reconciler] Failed to enqueue email ${email.id}:`, err.message);
      }
    }

    if (enqueuedCount > 0) {
      console.log(`[reconciler] Successfully enqueued/recovered ${enqueuedCount} scheduled email(s) into BullMQ`);
    }
  } catch (err: any) {
    console.error("[reconciler] Error during reconciliation:", err.message);
  } finally {
    isReconciling = false;
  }
}

let reconcilerInterval: NodeJS.Timeout | null = null;

export function startReconciler(intervalMs = 30000) {
  // Run once immediately on start
  reconcileScheduledEmails().catch((err) =>
    console.error("[reconciler] Initial run failed:", err.message)
  );

  // Run periodically to catch any scheduled emails missed due to network blips or restarts
  if (!reconcilerInterval) {
    reconcilerInterval = setInterval(() => {
      reconcileScheduledEmails().catch((err) =>
        console.error("[reconciler] Periodic run failed:", err.message)
      );
    }, intervalMs);
    console.log(`[reconciler] Started background reconciler loop (every ${intervalMs / 1000}s)`);
  }
}
