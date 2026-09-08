import { ScheduledEmail, SentEmail, User } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "something went wrong");
  }

  return res.json();
}

export function getMe(): Promise<User> {
  return request("/auth/me");
}

export function logout() {
  return request("/auth/logout", { method: "POST" });
}

export function getScheduledEmails(): Promise<ScheduledEmail[]> {
  return request("/emails/scheduled");
}

export function getSentEmails(): Promise<SentEmail[]> {
  return request("/emails/sent");
}

export function scheduleEmails(payload: {
  sender: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayMs: number;
  hourlyLimit: number;
}) {
  return request("/emails/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function disconnectSlack() {
  return request("/slack/disconnect", { method: "POST" });
}

export const googleLoginUrl = `${API_URL}/auth/google`;
export const slackConnectUrl = `${API_URL}/slack/connect`;
