import { useState } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import { scheduleEmails } from "../api";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function getNowLocalString() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

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
  const [recipientsText, setRecipientsText] = useState("");
  const [startTime, setStartTime] = useState(getNowLocalString());
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function parseEmails(text: string): string[] {
    const matches = text.match(EMAIL_REGEX) || [];
    return Array.from(new Set(matches.map((m) => m.toLowerCase().trim())));
  }

  const detectedRecipients = parseEmails(recipientsText);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const found = parseEmails(text);
      if (found.length > 0) {
        // Append or set the recipients
        const combined = Array.from(new Set([...detectedRecipients, ...found]));
        setRecipientsText(combined.join(", "));
      }
    } catch {
      setError("Failed to read the uploaded file");
    }
  }

  async function handleSubmit() {
    setError("");

    const parsedSender = sender.trim();
    const parsedSubject = subject.trim();
    const parsedBody = body.trim();
    const finalRecipients = parseEmails(recipientsText);

    if (!parsedSender) {
      setError("Please provide a sender email");
      return;
    }

    if (!parsedSubject) {
      setError("Please enter an email subject");
      return;
    }

    if (!parsedBody) {
      setError("Please enter an email body");
      return;
    }

    if (finalRecipients.length === 0) {
      setError("Please enter or upload at least one valid recipient email address");
      return;
    }

    if (!startTime) {
      setError("Please specify a start time");
      return;
    }

    const startDate = new Date(startTime);
    if (isNaN(startDate.getTime())) {
      setError("Invalid start time selected");
      return;
    }

    setSubmitting(true);
    try {
      const startTimeISO = startDate.toISOString();
      await scheduleEmails({
        sender: parsedSender,
        subject: parsedSubject,
        body: parsedBody,
        recipients: finalRecipients,
        startTime: startTimeISO,
        delayMs,
        hourlyLimit,
      });
      onScheduled();
      onClose();
    } catch (err: any) {
      console.error("schedule failed:", err);
      setError(err.message || "Failed to schedule emails. Please check connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Compose New Email" onClose={onClose}>
      <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto pr-1">
        <Input
          label="From (sender)"
          placeholder="you@yourcompany.com"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
        />

        <Input
          label="Subject"
          placeholder="Email subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-600 font-medium">Body</label>
          <textarea
            className="px-3 py-2 text-sm border border-gray-300 rounded-md h-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Write your email body here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-600 font-medium">
              Recipients (type, paste, or upload)
            </label>
            <span className="text-xs text-blue-600 font-medium">
              {detectedRecipients.length} valid recipient{detectedRecipients.length === 1 ? "" : "s"}
            </span>
          </div>
          <textarea
            className="px-3 py-2 text-sm border border-gray-300 rounded-md h-18 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="recipient1@example.com, recipient2@example.com (or upload file below)"
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
          />

          <div className="flex items-center gap-2 mt-1">
            <label className="text-xs text-gray-500 cursor-pointer bg-gray-50 border border-gray-200 hover:bg-gray-100 px-2 py-1 rounded">
              📁 Upload CSV / TXT
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFile}
                className="hidden"
              />
            </label>
            <span className="text-xs text-gray-400">
              Auto-extracts emails from file
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <label className="text-sm text-gray-600 font-medium">Start Time</label>
            <button
              type="button"
              onClick={() => setStartTime(getNowLocalString())}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Set to Now
            </button>
          </div>
          <Input
            label=""
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

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

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 text-sm text-red-600 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Scheduling..." : "Schedule Emails"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
