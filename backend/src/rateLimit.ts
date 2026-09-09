import { utilityRedis } from "./redis";

// key looks like: rate:sender@example.com:2026-09-08T14
function hourKey(sender: string) {
  const hour = new Date().toISOString().slice(0, 13);
  return `rate:${sender}:${hour}`;
}

// tries to take one slot for this sender in the current hour.
// returns true if allowed, false if the sender is already at the limit.
export async function canSendNow(sender: string, hourlyLimit: number) {
  const key = hourKey(sender);
  const count = await utilityRedis.incr(key);

  if (count === 1) {
    await utilityRedis.expire(key, 3600);
  }

  if (count > hourlyLimit) {
    await utilityRedis.decr(key);
    return false;
  }

  return true;
}

export function msUntilNextHour() {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next.getTime() - now.getTime();
}
