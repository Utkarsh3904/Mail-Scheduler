import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Tabs from "../components/Tabs";
import Button from "../components/Button";
import EmailTable from "../components/EmailTable";
import ComposeModal from "../components/ComposeModal";
import { getMe, getScheduledEmails, getSentEmails, logout } from "../api";
import { ScheduledEmail, SentEmail, User } from "../types";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState("Scheduled Emails");
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);

  async function loadUser() {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      navigate("/");
    }
  }

  async function loadEmails(isInitial = false) {
    if (isInitial) setLoading(true);
    try {
      const [scheduledData, sentData] = await Promise.all([
        getScheduledEmails(),
        getSentEmails(),
      ]);
      setScheduled(scheduledData || []);
      setSent(sentData || []);
    } catch (err) {
      console.error("Failed to fetch emails:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
    loadEmails(true);

    const interval = setInterval(() => {
      loadEmails(false);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  if (!user) return null;

  return (
    <div>
      <Header user={user} onLogout={handleLogout} onSlackChange={loadUser} />

      <div className="max-w-5xl p-6 mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Tabs
            tabs={["Scheduled Emails", "Sent Emails"]}
            active={tab}
            onChange={setTab}
          />
          <Button onClick={() => setShowCompose(true)}>+ Compose New Email</Button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg">
          {tab === "Scheduled Emails" ? (
            <EmailTable
              loading={loading}
              emptyMessage="No emails scheduled yet."
              columns={[
                { key: "recipient", label: "Email" },
                { key: "subject", label: "Subject" },
                { key: "scheduled_time", label: "Scheduled Time" },
                { key: "status", label: "Status" },
              ]}
              rows={scheduled.map((e) => ({
                ...e,
                scheduled_time: e.scheduled_time
                  ? new Date(e.scheduled_time).toLocaleString()
                  : "-",
              }))}
            />
          ) : (
            <EmailTable
              loading={loading}
              emptyMessage="No emails sent yet."
              columns={[
                { key: "recipient", label: "Email" },
                { key: "subject", label: "Subject" },
                { key: "sent_time", label: "Sent Time" },
                { key: "status", label: "Status" },
              ]}
              rows={sent.map((e) => ({
                ...e,
                sent_time: e.sent_time
                  ? new Date(e.sent_time).toLocaleString()
                  : e.status === "failed"
                  ? "Failed before sending"
                  : "-",
                error_message: e.error_message || undefined,
              }))}
            />
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeModal onClose={() => setShowCompose(false)} onScheduled={loadEmails} />
      )}
    </div>
  );
}
