import { Router } from "express";
import { pool } from "../db";
import { emailQueue } from "../queue";
import { AuthedRequest, requireLogin } from "../auth";
import { searchEmails } from "../search";

const router = Router();

router.use(requireLogin);

// schedule one or more emails (one recipient per row from the uploaded list)
router.post("/schedule", async (req: AuthedRequest, res) => {
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
  const delay = Number(delayMs) || Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS) || 2000;
  const limit = Number(hourlyLimit) || Number(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER) || 200;

  const created = [];

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
    const delayFromNow = Math.max(scheduledTime.getTime() - Date.now(), 0);

    await emailQueue.add(
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
        jobId: `email-${emailId}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }
    );

    await pool.query("UPDATE emails SET job_id = $1 WHERE id = $2", [
      `email-${emailId}`,
      emailId,
    ]);

    created.push(emailId);
  }

  res.json({ scheduled: created.length, ids: created });
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
    `SELECT id, recipient, subject, sent_time, status
     FROM emails
     WHERE user_id = $1 AND status IN ('sent', 'failed')
     ORDER BY sent_time DESC`,
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
