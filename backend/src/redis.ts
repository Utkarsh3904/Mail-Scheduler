// import IORedis from "ioredis";

// export const redis = new IORedis({
//   host: process.env.REDIS_HOST || "localhost",
//   port: Number(process.env.REDIS_PORT) || 6379,
//   maxRetriesPerRequest: null,
// });

import IORedis from "ioredis";

export const redis = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  connectTimeout: 5000,
});