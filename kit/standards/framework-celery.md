# Celery Standards

Detected via `celery` in `requirements.txt` / `pyproject.toml` / `Pipfile` — auto-injected as **extra**.

## What Celery Is

Celery is Python's distributed task queue — the standard for background jobs in Django/Flask/FastAPI ecosystems. Broker-backed (Redis, RabbitMQ), supports scheduling, retries, chaining, monitoring.

## When to Use

- Heavy / slow work that shouldn't block HTTP request (send email, generate PDF, ML inference)
- Scheduled tasks (cron-like)
- Multi-step pipelines (extract → transform → load)
- Fan-out work (process N items in parallel)

**Lighter alternatives:** `arq`, `rq`, `dramatiq` — simpler if you don't need Celery's full feature set.

## Setup

```bash
pip install "celery[redis]"
# or "celery[librabbitmq]" for RabbitMQ
```

```python
# myapp/celery.py
from celery import Celery

app = Celery(
    'myapp',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/1',     # for result storage
    include=['myapp.tasks'],                 # modules with @app.task
)

app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,                  # 30 min hard limit
    task_soft_time_limit=25 * 60,             # raise SoftTimeLimitExceeded at 25min
)
```

## Tasks

```python
# myapp/tasks.py
from .celery import app
from celery import shared_task

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_welcome_email(self, user_id: int):
    try:
        user = User.objects.get(id=user_id)
        send_email(user.email, 'Welcome!')
    except SMTPException as exc:
        raise self.retry(exc=exc, countdown=60)
```

- `bind=True` — first arg is `self`, gives access to retry/state
- `shared_task` — not tied to a specific app instance (works in Django + Flask)
- `max_retries` + `default_retry_delay` — auto-retry on raised exceptions

## Enqueue Tasks

```python
# Fire and forget
send_welcome_email.delay(user_id=123)

# With options
send_welcome_email.apply_async(
    args=[123],
    countdown=60,                # delay 60s
    expires=3600,                 # discard if not picked up within 1h
    queue='emails',                # specific queue
)

# Scheduled
send_welcome_email.apply_async(
    args=[123],
    eta=datetime.utcnow() + timedelta(hours=1),
)
```

## Workers

```bash
celery -A myapp worker --loglevel=info
celery -A myapp worker -Q emails,default --concurrency=4
celery -A myapp worker --autoscale=10,2     # min 2, max 10 child processes
```

- One worker per queue (or one for many queues with `-Q a,b,c`)
- `--concurrency=N` — number of child processes (prefork pool); default = CPU count
- Use **gevent** or **eventlet** pool for I/O-bound tasks: `--pool=gevent --concurrency=100`

## Beat (Scheduled Tasks)

```python
# In celery.py
app.conf.beat_schedule = {
    'cleanup-every-hour': {
        'task': 'myapp.tasks.cleanup_old_records',
        'schedule': 3600.0,        # every hour
    },
    'daily-report': {
        'task': 'myapp.tasks.send_daily_report',
        'schedule': crontab(hour=9, minute=0),
        'args': ('finance',),
    },
}
```

Run beat (scheduler) as a separate process:
```bash
celery -A myapp beat --loglevel=info
```

**One beat instance only** — multiple = duplicate schedules.

## Chains / Groups / Chords

```python
from celery import chain, group, chord

# Sequential
chain(
    fetch_data.s(user_id),
    process_data.s(),
    store_results.s(),
)()

# Parallel
group(process_chunk.s(i) for i in range(100))()

# Parallel then aggregate
chord(
    (download.s(url) for url in urls),
    combine_results.s(),
)()
```

`.s()` = signature (frozen task call). Compose them like LEGO.

## Result Backend

```python
result = send_welcome_email.delay(user_id=123)
result.id              # task ID
result.status          # PENDING, STARTED, SUCCESS, FAILURE, RETRY
result.result          # return value (if SUCCESS)
result.get(timeout=10) # blocks until result ready
```

**Don't store results unless you need them** — adds Redis/DB load. Disable per-task:
```python
@shared_task(ignore_result=True)
def send_email(...): ...
```

## Django Integration

```bash
pip install django-celery-beat django-celery-results
```

```python
# settings.py
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'django-db'      # store results in Django DB
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
```

Now you can edit schedules via Django admin UI.

## FastAPI Integration

```python
# main.py
from .celery import app as celery_app

@app.post("/process")
async def trigger(data: dict):
    result = process_data.delay(data)
    return {"task_id": result.id}

@app.get("/result/{task_id}")
async def get_result(task_id: str):
    result = celery_app.AsyncResult(task_id)
    return {"status": result.status, "result": result.result if result.ready() else None}
```

## Monitoring

- **Flower** — web UI for monitoring workers, queues, tasks:
  ```bash
  pip install flower
  celery -A myapp flower
  ```
- **Prometheus** via `celery-prometheus-exporter`
- **Sentry** — captures task failures automatically with `sentry-sdk`

## Best Practices

- **Idempotent tasks** — Celery can deliver same message twice (broker can fail mid-ack)
- Pass **IDs, not objects** — task args are JSON-serialized; object state could be stale by the time task runs
- Set `task_time_limit` — orphan tasks consume worker slots forever otherwise
- Separate queues by SLA: `critical`, `default`, `slow`
- Use `acks_late=True` + `task_reject_on_worker_lost=True` for tasks that MUST complete
- Monitor queue depth — when default queue backs up, you're losing throughput
- One beat instance only — use `--pidfile` to enforce

## Common Pitfalls

- Passing Django model instance to task → serialized state stale; pass `pk` instead
- Tasks that aren't idempotent + retries enabled → double-send emails, double-charge cards
- Storing task results without need → Redis memory bloat
- Running beat from multiple machines → duplicate schedules
- `delay()` in tests without `CELERY_TASK_ALWAYS_EAGER=True` → tests hang
- Mixing prefork + asyncio in a task → event loop conflicts; use gevent pool or separate async framework

## Alternatives (When Celery is Overkill)

- **arq** — Redis-only, async-native, simpler API
- **rq** — Redis Queue, dead simple
- **dramatiq** — modern Celery alternative, fewer config gotchas
- **Huey** — lightweight, integrates well with Django
- **TaskIQ** — async-first, supports any broker

## Resources

- Docs: https://docs.celeryq.dev
- Best practices: https://denibertovic.com/posts/celery-best-practices/
- Flower: https://flower.readthedocs.io
- Django integration: https://django-celery-beat.readthedocs.io
