# Oban Standards

Detected via `:oban` in `mix.exs` — auto-injected as **extra**.

## What Oban Is

Oban is the de-facto background job queue for Elixir. Postgres-backed (uses `LISTEN/NOTIFY` for low-latency), no separate Redis/RabbitMQ needed. Production-grade: retries, backoff, scheduling, unique jobs, telemetry.

## Setup

`mix.exs`:
```elixir
{:oban, "~> 2.18"}
```

Config:
```elixir
# config/config.exs
config :my_app, Oban,
  repo: MyApp.Repo,
  queues: [default: 10, emails: 20, media: 5],
  plugins: [
    {Oban.Plugins.Pruner, max_age: 60 * 60 * 24 * 7},  # prune completed jobs after 7d
    {Oban.Plugins.Cron, crontab: [
      {"0 * * * *", MyApp.Workers.HourlyReport},        # every hour
      {"0 2 * * *", MyApp.Workers.DailyCleanup},        # 2am daily
    ]},
  ]
```

Add to supervision tree:
```elixir
# lib/my_app/application.ex
children = [
  MyApp.Repo,
  {Oban, Application.fetch_env!(:my_app, Oban)},
]
```

Run migration:
```bash
mix ecto.gen.migration add_oban_jobs_table
# Add: Oban.Migrations.up()
mix ecto.migrate
```

## Workers

```elixir
defmodule MyApp.Workers.SendWelcomeEmail do
  use Oban.Worker, queue: :emails, max_attempts: 5

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"user_id" => user_id}}) do
    user = MyApp.Accounts.get_user!(user_id)
    MyApp.Mailer.deliver_welcome(user)
    :ok
  end
end
```

Return `:ok`, `{:ok, result}`, `{:error, reason}`, or `{:snooze, seconds}`. Raising an exception triggers retry per `max_attempts`.

## Enqueue Jobs

```elixir
%{user_id: user.id}
|> MyApp.Workers.SendWelcomeEmail.new()
|> Oban.insert()

# Scheduled
%{user_id: user.id}
|> MyApp.Workers.SendWelcomeEmail.new(scheduled_at: ~U[2026-12-25 10:00:00Z])
|> Oban.insert()

# Delayed (relative)
%{user_id: user.id}
|> MyApp.Workers.SendWelcomeEmail.new(schedule_in: 60 * 5)   # 5 minutes
|> Oban.insert()

# Insert atomically with another DB write
Ecto.Multi.new()
|> Ecto.Multi.insert(:user, user_changeset)
|> Oban.insert(:welcome_email, fn %{user: user} ->
  MyApp.Workers.SendWelcomeEmail.new(%{user_id: user.id})
end)
|> Repo.transaction()
```

**Atomic insert in transaction** is Oban's killer feature — the job ONLY enqueues if the user insert commits. No "user created but email never sent" race.

## Retries + Backoff

```elixir
use Oban.Worker, max_attempts: 5

# Custom backoff (default is exponential)
def backoff(%Oban.Job{attempt: attempt}), do: trunc(:math.pow(attempt, 4) + 15)
```

Failed jobs go to `available` after backoff. Permanently failed jobs (max_attempts reached) land in `discarded`.

## Unique Jobs (Idempotency)

Prevent duplicate enqueue:
```elixir
use Oban.Worker,
  queue: :default,
  unique: [period: 60, fields: [:args, :worker]]
```

Within 60 seconds, identical `args` won't enqueue twice. Use for:
- "Send password reset" — don't spam
- "Recompute stats for user X" — coalesce concurrent requests
- Webhook delivery jobs — dedupe by event ID

## Cron Jobs

```elixir
plugins: [
  {Oban.Plugins.Cron, crontab: [
    {"@hourly", MyApp.Workers.RefreshCache},
    {"0 9 * * 1-5", MyApp.Workers.WeekdayReport, args: %{report: "sales"}},
  ]}
]
```

Standard cron syntax. Jobs are inserted automatically at the scheduled time.

## Testing

Use Oban's testing helpers — they don't actually run jobs but assert they were enqueued:

```elixir
use Oban.Testing, repo: MyApp.Repo

test "registration enqueues welcome email" do
  {:ok, user} = Accounts.register_user(%{email: "a@b.com"})

  assert_enqueued worker: MyApp.Workers.SendWelcomeEmail, args: %{user_id: user.id}
end

# Or run inline (for integration tests)
test "welcome email worker sends mail" do
  user = insert(:user)
  perform_job(MyApp.Workers.SendWelcomeEmail, %{user_id: user.id})
  assert_email_sent(to: user.email)
end
```

Set `testing: :manual` in test config to prevent auto-execution.

## Pro Features (Paid)

Oban Pro adds: workflows (DAG of jobs), batches, smart pause, dynamic queues, encryption. Worth it for serious workloads — ~$50/mo per team.

## Best Practices

- Workers should be **idempotent** — same job run twice = same outcome
- Args should be **JSON-serializable IDs**, never full structs (DB row could change)
- Use `unique` for dedup of likely-duplicate jobs (webhooks, reset emails)
- Scope queues by SLA: fast critical jobs in one queue, slow batch in another
- Insert jobs in the same transaction as the triggering DB write
- Set reasonable `max_attempts` (3-5 for transient, 1 for non-retryable)
- Use telemetry events to monitor queue depth + processing time

## Common Pitfalls

- Passing schema struct in args → fails if record deleted before job runs; use `id` instead
- Forgetting to insert job in same transaction → "user created but no welcome email" race
- Setting `max_attempts: 1` on flaky external API → no retry, single failure = permanent
- Long-running worker without `Oban.Worker.timeout/1` override → blocks queue slot
- Not pruning the `oban_jobs` table → grows unbounded, slows queries
- Running multiple Oban instances pointed at same DB without queue partitioning → contention

## Monitoring

Phoenix LiveDashboard has Oban integration showing queue depth, throughput, failure rates. Wire into your existing dashboard. Production: also export Telemetry events to Prometheus/DataDog.

## Resources

- Docs: https://hexdocs.pm/oban
- GitHub: https://github.com/sorentwo/oban
- Oban Pro: https://oban.pro
