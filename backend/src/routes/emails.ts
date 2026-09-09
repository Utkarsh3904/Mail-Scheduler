import { Router } from "express";
import { pool } from "../db";
import { emailQueue } from "../queue";
import { AuthedRequest, requireLogin } from "../auth";
import { searchEmails } from "../search";
import { reconcileScheduledEmails } from "../reconciler";

const router = Router();

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

router.use(requireLogin);

// schedule one or more emails (one recipient per row from the uploaded list or manual input)
router.post("/schedule", async (req: AuthedRequest, res) => {
  try {
    console.log("POST /emails/schedule body:", JSON.stringify(req.body));

    const {
      sender,
      subject,
      body,
      recipients,
      startTime,
      delayMs,
      hourlyLimit,
    } = req.body;

    if (!sender || !subject || !body || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "sender, subject, body and recipients are required" });
    }

    if (!startTime) {
      return res.status(400).json({ error: "startTime is required" });
    }

    const startAt = new Date(startTime);
    if (isNaN(startAt.getTime())) {
      return res.status(400).json({ error: "Invalid startTime format" });
    }

    const delay = Number(delayMs) || Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS) || 2000;
    const limit = Number(hourlyLimit) || Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER) || 200;

    const created: number[] = [];

    // each recipient gets sent `delay` ms after the previous one, starting at startTime
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const scheduledTime = new Date(startAt.getTime() + i * delay);

      const inserted = await pool.query(
        `INSERT INTO emails (user_id, sender, recipient, subject, body, status, scheduled_time, delay_ms, hourly_limit)
         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8)
         RETURNING id`,
        [req.userId, sender, recipient, subject, body, scheduledTime, delay, limit]
      );

      const emailId = inserted.rows[0].id;
      const jobId = `email-${emailId}`;
      const delayFromNow = Math.max(scheduledTime.getTime() - Date.now(), 0);

      try {
        await withTimeout(
          emailQueue.add(
            "send-email",
            {
              emailId,
              sender,
              recipient,
              subject,
              body,
              hourlyLimit: limit,
            },
            {
              delay: delayFromNow,
              jobId,
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
            }
          ),
          10000,
          "emailQueue.add"
        );

        await pool.query("UPDATE emails SET job_id = $1 WHERE id = $2", [
          jobId,
          emailId,
        ]);
      } catch (queueErr: any) {
        // If Redis is momentarily reconnecting or slow, do NOT fail the entire batch.
        // The email is safely stored in PostgreSQL as 'scheduled'.
        // The background reconciler will detect and enqueue it within seconds!
        console.warn(
          `[schedule] Redis enqueue was slow/failed for email ${emailId} (${queueErr?.message}), reconciler will pick it up.`
        );
      }

      created.push(emailId);
    }

    // Trigger reconciliation asynchronously in background to ensure everything is queued
    reconcileScheduledEmails().catch(() => {});

    const response = { scheduled: created.length, ids: created };
    console.log("POST /emails/schedule responding:", JSON.stringify(response));
    res.json(response);
  } catch (err: any) {
    console.error("POST /emails/schedule failed:", err);
    res.status(500).json({ error: err?.message || "unknown error" });
  }
});

router.get("/scheduled", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, recipient, subject, scheduled_time, status
     FROM emails
     WHERE user_id = $1 AND status IN ('scheduled', 'sending')
     ORDER BY scheduled_time ASC`,
    [req.userId]
  );
  res.json(result.rows);
});

router.get("/sent", async (req: AuthedRequest, res) => {
  const result = await pool.query(
    `SELECT id, recipient, subject, scheduled_time, sent_time, status, error_message
     FROM emails
     WHERE user_id = $1 AND status IN ('sent', 'failed')
     ORDER BY COALESCE(sent_time, scheduled_time, created_at) DESC`,
    [req.userId]
  );
  res.json(result.rows);
});

router.get("/search", async (req: AuthedRequest, res) => {
  const q = (req.query.q as string) || "";
  try {
    const results = await searchEmails(req.userId as number, q);
    res.json(results);
  } catch (err: any) {
    console.log("search failed", err.message);
    res.status(500).json({ error: "search is unavailable right now" });
  }
});

export default router;
