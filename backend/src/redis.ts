import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const useTLS = REDIS_URL.startsWith("rediss://");

// log (masked) connection target so you can verify the deployed config on Render
try {
  const u = new URL(REDIS_URL);
  const masked = `${u.protocol}//${u.username ? "default" : ""}:${u.password ? "***" : ""}@${u.host}${u.pathname}`;
  console.log(`redis config: ${masked}, TLS=${useTLS}`);
} catch {
  console.log(`redis config: (could not parse REDIS_URL), TLS=${useTLS}`);
}

function makeConnection(name: string, opts: { maxRetriesPerRequest: number | null }) {
  const conn = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: opts.maxRetriesPerRequest,
    connectTimeout: 10000,
    ...(useTLS ? { tls: { rejectUnauthorized: false } } : {}),
    retryStrategy: (times: number) => {
      // cap retries so we fail fast when the host is unreachable (e.g. Render
      // cannot reach Upstash) instead of looping forever
      if (times > 10) {
        console.error(`redis [${name}] giving up after ${times} retries (host unreachable?)`);
        return null; // stop retrying
      }
      const delay = Math.min(times * 200, 3000);
      console.log(`redis [${name}] retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err: Error) => {
      console.log(`redis [${name}] reconnectOnError triggered:`, err.message);
      return true; // always try to reconnect on any error, including ECONNRESET
    },
  });

  conn.on("connect", () => console.log(`redis [${name}] connecting...`));
  conn.on("ready", () => console.log(`redis [${name}] ready`));
  conn.on("error", (err: Error) => console.error(`redis [${name}] error:`, err.message));
  conn.on("close", () => console.warn(`redis [${name}] connection closed`));
  conn.on("reconnecting", () => console.log(`redis [${name}] reconnecting...`));

  return conn;
}

export const queueRedis = makeConnection("queue", { maxRetriesPerRequest: 3 });
export const workerRedis = makeConnection("worker", { maxRetriesPerRequest: null });
export const utilityRedis = makeConnection("utility", { maxRetriesPerRequest: null });
