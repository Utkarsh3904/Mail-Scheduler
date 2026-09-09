// Quick standalone test for Upstash Redis credentials.
// Usage: node test-redis.mjs rediss://default:YOUR_TOKEN@big-jennet-148506.upstash.io:6379
import IORedis from "ioredis";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node test-redis.mjs <rediss://connection-string>");
  process.exit(1);
}

const client = new IORedis(url, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: 1,
  connectTimeout: 8000,
});

client.on("error", (err) => console.log("error:", err.message));

try {
  const pong = await client.ping();
  console.log("SUCCESS - PING:", pong);
  const info = await client.info("server");
  console.log("INFO server:", info.split("\n").filter((l) => l.trim()).join(" | "));
  process.exit(0);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exit(1);
} finally {
  client.quit();
}
