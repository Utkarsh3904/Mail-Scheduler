export interface User {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  slackConnected: boolean;
}

export interface ScheduledEmail {
  id: number;
  recipient: string;
  subject: string;
  scheduled_time: string;
  status: string;
}

export interface SentEmail {
  id: number;
  recipient: string;
  subject: string;
  sent_time: string;
  status: string;
}
