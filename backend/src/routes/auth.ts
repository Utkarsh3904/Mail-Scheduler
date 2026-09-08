import { Router } from "express";
import axios from "axios";
import { pool } from "../db";
import { AuthedRequest, requireLogin } from "../auth";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

router.get("/google", (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: process.env.GOOGLE_CALLBACK_URL || "",
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send("missing code from google");
  }

  try {
    const tokenRes = await axios.post("https://oauth2.googleapis.com/token", {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    });

    const profileRes = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokenRes.data.access_token}` } }
    );

    const profile = profileRes.data;

    const existing = await pool.query(
      "SELECT id FROM users WHERE google_id = $1",
      [profile.sub]
    );

    let userId: number;

    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await pool.query(
        "UPDATE users SET name = $1, email = $2, avatar_url = $3 WHERE id = $4",
        [profile.name, profile.email, profile.picture, userId]
      );
    } else {
      const inserted = await pool.query(
        "INSERT INTO users (google_id, name, email, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id",
        [profile.sub, profile.name, profile.email, profile.picture]
      );
      userId = inserted.rows[0].id;
    }

    res.cookie("userId", userId, {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    res.redirect(`${FRONTEND_URL}/dashboard`);
  } catch (err: any) {
    console.log("google login failed", err.response?.data || err.message);
    res.redirect(`${FRONTEND_URL}/?error=login_failed`);
  }
});

router.get("/me", requireLogin, async (req: AuthedRequest, res) => {
  const result = await pool.query(
    "SELECT id, name, email, avatar_url, slack_webhook_url FROM users WHERE id = $1",
    [req.userId]
  );

  const user = result.rows[0];

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar_url,
    slackConnected: !!user.slack_webhook_url,
  });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("userId");
  res.json({ ok: true });
});

export default router;
