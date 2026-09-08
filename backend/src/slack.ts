import axios from "axios";
import { pool } from "./db";
import { redis } from "./redis";

export async function exchangeSlackCode(code: string) {
  const res = await axios.post(
    "https://slack.com/api/oauth.v2.access",
    null,
    {
      params: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.SLACK_CALLBACK_URL,
      },
    }
  );

  if (!res.data.ok) {
    throw new Error("slack oauth failed: " + res.data.error);
  }

  return res.data.incoming_webhook.url as string;
}

export async function sendSlackMessage(userId: number, text: string) {
  const result = await pool.query(
    "SELECT slack_webhook_url FROM users WHERE id = $1",
    [userId]
  );
  const webhookUrl = result.rows[0]?.slack_webhook_url;

  if (!webhookUrl) {
    // user never connected slack, just skip silently
    return;
  }

  await axios.post(webhookUrl, { text });
}

// only notify once per sender per hour, so we don't spam slack for every job
export async function shouldNotify(sender: string) {
  const hour = new Date().toISOString().slice(0, 13);
  const key = `slack-notified:${sender}:${hour}`;
  const wasSet = await redis.set(key, "1", "EX", 3700, "NX");
  return wasSet === "OK";
}
