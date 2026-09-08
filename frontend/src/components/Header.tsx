import { User } from "../types";
import Button from "./Button";
import { slackConnectUrl, disconnectSlack } from "../api";

export default function Header({
  user,
  onLogout,
  onSlackChange,
}: {
  user: User;
  onLogout: () => void;
  onSlackChange: () => void;
}) {
  async function handleSlackClick() {
    if (user.slackConnected) {
      await disconnectSlack();
      onSlackChange();
    } else {
      window.location.href = slackConnectUrl;
    }
  }

  return (
    <div className="flex justify-between items-center bg-white px-6 py-4 border-b border-gray-200">
      <h1 className="text-lg font-semibold text-gray-800">ReachInbox Scheduler</h1>

      <div className="flex items-center gap-4">
        <Button variant="secondary" onClick={handleSlackClick}>
          {user.slackConnected ? "Slack Connected ✓" : "Connect Slack"}
        </Button>

        <div className="flex items-center gap-2">
          {user.avatar && (
            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
          )}
          <div className="text-sm">
            <div className="font-medium text-gray-800">{user.name}</div>
            <div className="text-gray-500">{user.email}</div>
          </div>
        </div>

        <Button variant="secondary" onClick={onLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
}
