import { googleLoginUrl } from "../api";

export default function Login() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-lg shadow-sm text-center w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-2">ReachInbox Scheduler</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to schedule and track your emails</p>

        <a
          href={googleLoginUrl}
          className="flex items-center justify-center gap-2 border border-gray-300 rounded-md py-2 text-sm font-medium hover:bg-gray-50"
        >
          Continue with Google
        </a>
      </div>
    </div>
  );
}
