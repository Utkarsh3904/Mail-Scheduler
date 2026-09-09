import { Queue } from "bullmq";
import { queueRedis } from "./redis";

export const QUEUE_NAME = "emails";

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: queueRedis,
});
