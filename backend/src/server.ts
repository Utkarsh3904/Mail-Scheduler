import "dotenv/config";
import express from "express";

// global error handlers - log and keep the process alive instead of crashing
// on a failed redis/db/queue promise or unhandled exception
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

import cors from "cors";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import "./worker";

import { emailQueue } from "./queue";
import { setupIndex } from "./search";
import authRoutes from "./routes/auth";
import slackRoutes from "./routes/slack";
import emailRoutes from "./routes/emails";

const app = express();

const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl) {
  console.warn("WARNING: FRONTEND_URL is not set - CORS origin is undefined, cross-origin requests may fail silently");
}
if (frontendUrl) {
  console.log(`CORS origin: ${frontendUrl}`);
}
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

// bull board - live queue dashboard
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});
app.use("/admin/queues", serverAdapter.getRouter());

app.use("/auth", authRoutes);
app.use("/slack", slackRoutes);
app.use("/emails", emailRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

setupIndex();

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`server running on http://localhost:${port}`);
  console.log(`bull board on http://localhost:${port}/admin/queues`);
});
