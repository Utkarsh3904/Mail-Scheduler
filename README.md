# ReachInbox Scheduler

Email job scheduler + dashboard built for the ReachInbox hiring assignment.

## Stack

- Backend: Node.js, Express, TypeScript
- DB: PostgreSQL, plain SQL via `pg` (no ORM, per the assignment - ORM was optional)
- Queue: BullMQ + Redis
- Email: Nodemailer + Ethereal (fake SMTP)
- Search: Elasticsearch (plain HTTP calls, no client library)
- Auth: Google OAuth (manual authorization code flow) + a signed cookie session
- Slack: Slack OAuth (incoming webhook) for rate-limit notifications
- Frontend: React + Vite + TypeScript + Tailwind CSS

## 1. Start infra

```
docker compose up -d
```

This starts Postgres, Redis and Elasticsearch. The Postgres container automatically
runs `backend/sql/schema.sql` on first boot to create the tables.

## 2. Backend

```
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - from Google Cloud Console, add
  `http://localhost:4000/auth/google/callback` as an authorized redirect URI.
- `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` - from api.slack.com/apps, add the
  `incoming-webhook` scope and `http://localhost:4000/slack/callback` as the redirect URL.
- `ETHEREAL_USER` / `ETHEREAL_PASS` - not needed. The backend creates a
  separate Ethereal test account per sender automatically the first time
  that sender is used, and logs the generated inbox credentials to the
  worker's console.

Run the API and the worker in two separate terminals:

```
npm run dev       # API on http://localhost:4000
npm run worker    # BullMQ worker
```

Bull Board (live queue dashboard): http://localhost:4000/admin/queues

## 3. Frontend

```
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

## Architecture

### How scheduling works
When you hit "Schedule" on the compose modal, the backend inserts one row per
recipient into the `emails` table with `status = 'scheduled'`, then adds one
BullMQ job per email with `delay` set to `scheduled_time - now`. No cron
anywhere - BullMQ just holds the job in Redis's delayed set until it's due,
then hands it to a worker.

### How persistence on restart is handled
The job's delay is stored inside Redis itself (BullMQ writes it to a sorted
set), not in the Node process's memory. So if the API or the worker restarts,
Redis still knows exactly when each job is due. The worker just needs to be
started again and it keeps picking up jobs from where it left off - nothing
is re-scheduled from scratch.

For idempotency, the BullMQ job id is `email-<row id>`, so scheduling the same
email twice by accident can't create two jobs for it. On top of that, the
worker checks the row's `status` in Postgres before sending - if it's already
`sent`, the job is skipped. This covers the case where a job gets retried
after a crash that happened right after the email actually went out.

### Multiple senders
Each schedule request has a `sender` (the "from" address entered in the
compose form). The mailer keeps a separate Ethereal test account per unique
sender, created the first time that sender is used and reused after that -
so different senders really do send through different SMTP accounts, not
just a different "from" label on the same one. Rate limiting is also scoped
per sender for the same reason.

### Rate limiting & concurrency
- **Concurrency**: the worker is started with `concurrency` from
  `WORKER_CONCURRENCY` (default 5), so that many jobs can run in parallel.
- **Minimum delay between sends**: done with BullMQ's `limiter` option
  (`max: 1` per `MIN_DELAY_BETWEEN_EMAILS_MS`, default 2000ms). This throttles
  how often the worker pulls a new job to run, regardless of concurrency.
- **Emails per hour, per sender**: a Redis key like `rate:<sender>:<hour>` is
  `INCR`ed every time we try to send for that sender. If the count goes above
  `hourlyLimit`, we `DECR` it back and treat the send as blocked. Because
  `INCR`/`DECR` are single Redis commands, this stays correct even with
  multiple worker processes running at once - nobody is trusting an
  in-memory counter.
  - **Trade-off**: there's a tiny window between the `INCR` and the `DECR`
    where the counter can briefly look one higher than it should. For an
    assignment like this it's an acceptable trade-off - a proper production
    system would use a single Lua script to make it atomic, but that adds
    real complexity for not much benefit at this scale.
- When a sender is over its hourly limit, the job is **not** failed. It's
  pushed back into BullMQ's delayed state until the start of the next hour
  (`job.moveToDelayed` + throwing `DelayedError`, which is the supported way
  to reschedule a job from inside a worker without losing it).

### Slack notifications
When a sender's hourly limit is hit, the worker calls `sendSlackMessage`,
which looks up that user's stored webhook URL and posts to it directly. If
the user never connected Slack, `slack_webhook_url` is `null` and the
function just returns - no crash, no notification. Connecting Slack later
starts working immediately since the webhook URL is read fresh from the DB
on every rate-limit hit, no restart needed. To avoid spamming Slack for
every single delayed job, we only send one notification per sender per hour
(tracked with a separate Redis key that expires after an hour).

### Behavior under load (1000+ emails at once)
Scheduling doesn't send anything immediately - it just writes rows and adds
delayed jobs. So scheduling 1000 emails for the same time is cheap; BullMQ
just ends up with 1000 jobs due around the same moment. From there:
- `concurrency` caps how many run at once,
- the `limiter` option caps how fast new jobs start overall,
- the per-sender hourly counter caps how many actually get sent per sender
  before the rest get pushed to the next hour automatically.
So nothing gets dropped - excess jobs just spill into later hours in the
order they were originally due.

## Features implemented

**Backend**
- [x] Email scheduling API (`POST /emails/schedule`)
- [x] BullMQ delayed jobs, no cron
- [x] Ethereal SMTP sending via Nodemailer
- [x] Elasticsearch indexing + search endpoint (`GET /emails/search`)
- [x] Bull Board live dashboard at `/admin/queues`
- [x] Restart-safe persistence (Redis-backed delay + DB status checks)
- [x] Idempotent sends (deterministic job id + status check)
- [x] Configurable worker concurrency
- [x] Configurable minimum delay between sends (BullMQ limiter)
- [x] Configurable per-sender hourly rate limit (Redis counters)
- [x] Real Slack OAuth + live webhook notification on rate-limit hit

**Frontend**
- [x] Real Google OAuth login
- [x] Header with name, email, avatar, logout
- [x] Scheduled Emails / Sent Emails tabs
- [x] Compose modal: subject, body, CSV/TXT lead upload with detected count,
      start time, delay, hourly limit
- [x] Tables with loading and empty states
- [x] Slack connect/disconnect from the header
