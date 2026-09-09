import { ScheduledEmail, SentEmail, User } from "./types";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");

async function request(path: string, options: RequestInit = {}) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (err) {
    throw new Error(
      "network error - could not reach the server. Check that the backend is running and VITE_API_URL is correct."
    );
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "something went wrong");
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null;
  }

  const text = await res.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("response was not valid JSON", text, err);
    throw new Error("unexpected response from server");
  }
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
