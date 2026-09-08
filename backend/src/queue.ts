import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_NAME = "emails";

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});
