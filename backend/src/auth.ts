import { Request, Response, NextFunction } from "express";
import { pool } from "./db";

export interface AuthedRequest extends Request {
  userId?: number;
}

export async function requireLogin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.signedCookies?.userId;

  if (!userId) {
    return res.status(401).json({ error: "not logged in" });
  }

  const result = await pool.query("SELECT id FROM users WHERE id = $1", [
    userId,
  ]);

  if (result.rows.length === 0) {
    return res.status(401).json({ error: "user not found" });
  }

  req.userId = Number(userId);
  next();
}
