import { useState } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import { scheduleEmails } from "../api";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export default function ComposeModal({
  onClose,
  onScheduled,
}: {
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [sender, setSender] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("");
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const found = text.match(EMAIL_REGEX) || [];
    setRecipients(Array.from(new Set(found)));
  }

  async function handleSubmit() {
    setError("");

    if (!sender || !subject || !body || recipients.length === 0 || !startTime) {
      setError("please fill everything and upload a lead list");
      return;
    }

    setSubmitting(true);
    try {
      const startTimeISO = new Date(startTime).toISOString();
      await scheduleEmails({
        sender,
        subject,
        body,
        recipients,
        startTime: startTimeISO,
        delayMs,
        hourlyLimit,
      });
      onScheduled();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Compose New Email" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Input
          label="From (sender)"
          placeholder="you@yourcompany.com"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
        />

        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Body</label>
          <textarea
            className="border border-gray-300 rounded-md px-3 py-2 text-sm h-28"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600">Upload leads (CSV or TXT)</label>
          <input type="file" accept=".csv,.txt" onChange={handleFile} />
          <span className="text-xs text-gray-500">
            {recipients.length} email address{recipients.length === 1 ? "" : "es"} detected
          </span>
        </div>

        <Input
          label="Start time"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Delay between emails (ms)"
            type="number"
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
          />
          <Input
            label="Hourly limit"
            type="number"
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Number(e.target.value))}
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Scheduling..." : "Schedule"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
