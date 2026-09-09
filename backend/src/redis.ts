import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// queueRedis: used by the Queue (emailQueue.add) — non-blocking writes only
export const queueRedis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  commandTimeout: 5000,
});

// workerRedis: used by the Worker — needs its own connection for blocking
// reads (XREADGROUP BLOCK). Sharing a connection with the Queue causes the
// blocking read to lock out queue writes, so jobs never get picked up.
export const workerRedis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: 5000,
});

// utilityRedis: used by rateLimit.ts and slack.ts — lightweight key/value ops
export const utilityRedis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: 5000,
});

// log connection status at startup (non-blocking, fires async)
for (const [name, conn] of [
  ["queue", queueRedis],
  ["worker", workerRedis],
  ["utility", utilityRedis],
] as const) {
  conn.on("connect", () => console.log(`redis [${name}] connecting...`));
  conn.on("ready", () => console.log(`redis [${name}] ready`));
  conn.on("error", (err: Error) => console.error(`redis [${name}] error:`, err.message));
  conn.on("close", () => console.warn(`redis [${name}] connection closed`));
}
