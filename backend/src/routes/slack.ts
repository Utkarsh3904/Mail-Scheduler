import { Router } from "express";
import { pool } from "../db";
import { exchangeSlackCode } from "../slack";
import { AuthedRequest, requireLogin } from "../auth";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

router.get("/connect", requireLogin, (req: AuthedRequest, res) => {
  // pass userId through state so we know who is connecting when slack redirects back
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID || "",
    scope: "incoming-webhook",
    redirect_uri: process.env.SLACK_CALLBACK_URL || "",
    state: String(req.userId),
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params}`);
});

router.get("/callback", async (req, res) => {
  const code = req.query.code as string;
  const userId = Number(req.query.state);

  if (!code || !userId) {
    return res.redirect(`${FRONTEND_URL}/dashboard?slack=failed`);
  }

  try {
    const webhookUrl = await exchangeSlackCode(code);
    await pool.query(
      "UPDATE users SET slack_webhook_url = $1 WHERE id = $2",
      [webhookUrl, userId]
    );
    res.redirect(`${FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err: any) {
    console.log("slack connect failed", err.message);
    res.redirect(`${FRONTEND_URL}/dashboard?slack=failed`);
  }
});

router.post("/disconnect", requireLogin, async (req: AuthedRequest, res) => {
  await pool.query("UPDATE users SET slack_webhook_url = NULL WHERE id = $1", [
    req.userId,
  ]);
  res.json({ ok: true });
});

export default router;
