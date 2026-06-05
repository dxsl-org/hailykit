# Broadway Standards

Detected via `:broadway` in `mix.exs` — auto-injected as **extra**.

## What Broadway Is

Broadway is Elixir's data ingestion / pipeline framework. It handles the hard parts of high-throughput streaming consumers: backpressure, batching, parallel processing, graceful shutdowns, telemetry.

Connectors (producers) for: Amazon SQS, Google Cloud Pub/Sub, Kafka, RabbitMQ, Redis Streams, NATS.

## When to Use

- Process events from a message queue (Kafka, SQS, RabbitMQ) — millions/day
- Batch-friendly ingestion (group N messages, write together)
- Need built-in retries + dead-letter queues
- Want telemetry + observability for the pipeline

Not for: one-off jobs (use Oban), pub/sub between Elixir processes (use Phoenix.PubSub).

## Architecture

```
[Producer] → [Processor 1, Processor 2, ...] → [Batcher] → [BatchProcessor 1, ...]
```

Each stage is a separate process pool (configurable concurrency). Backpressure flows backwards — if batchers are slow, producers slow down too.

## Basic Pipeline

```elixir
defmodule MyApp.OrderPipeline do
  use Broadway

  alias Broadway.Message

  def start_link(_opts) do
    Broadway.start_link(__MODULE__,
      name: __MODULE__,
      producer: [
        module: {BroadwaySQS.Producer, queue_url: "https://sqs..."},
        concurrency: 1,
      ],
      processors: [
        default: [concurrency: 10]
      ],
      batchers: [
        db: [concurrency: 2, batch_size: 50, batch_timeout: 2_000],
        s3: [concurrency: 1, batch_size: 10]
      ]
    )
  end

  @impl true
  def handle_message(_, %Message{data: data} = msg, _) do
    order = Jason.decode!(data)

    msg
    |> Message.update_data(fn _ -> order end)
    |> Message.put_batcher(:db)             # or :s3 based on data
  end

  @impl true
  def handle_batch(:db, messages, _batch_info, _context) do
    orders = Enum.map(messages, & &1.data)
    MyApp.Orders.bulk_insert(orders)
    messages          # return list (acked on return)
  end

  def handle_batch(:s3, messages, _, _) do
    # ...
    messages
  end
end
```

## Add to Supervision Tree

```elixir
# lib/my_app/application.ex
children = [
  MyApp.Repo,
  MyApp.OrderPipeline,
]
```

## Producer Adapters

| Adapter | Source |
|---|---|
| `BroadwaySQS.Producer` | AWS SQS |
| `BroadwayKafka.Producer` | Apache Kafka |
| `BroadwayRabbitMQ.Producer` | RabbitMQ |
| `BroadwayCloudPubSub.Producer` | GCP Pub/Sub |
| `BroadwayRedisStream.Producer` (community) | Redis Streams |
| `Broadway.DummyProducer` | Tests / dev |

## Error Handling

```elixir
def handle_message(_, msg, _) do
  case process(msg.data) do
    :ok -> msg
    {:error, reason} -> Message.failed(msg, reason)
  end
end

def handle_failed(messages, _context) do
  # Log + send to DLQ
  Enum.each(messages, fn msg ->
    Logger.error("Failed: #{inspect(msg.status)} | #{inspect(msg.data)}")
    MyApp.DLQ.publish(msg.data)
  end)
  messages
end
```

`Message.failed/2` marks the message as failed — Broadway nacks it (returns to queue with the source's retry policy).

## Batching Logic

- `batch_size`: max messages before sending to batcher
- `batch_timeout`: max ms to wait if `batch_size` not reached
- Multiple batchers for different downstream targets (DB, S3, search index)
- Route messages to the right batcher with `Message.put_batcher/2`

Typical batching strategy: `batch_size: 100, batch_timeout: 5_000` — batches up to 100 messages or every 5 seconds, whichever first.

## Telemetry

Broadway emits events at every stage:
```elixir
:telemetry.attach(
  "broadway-handler",
  [:broadway, :processor, :message, :stop],
  fn _event, measurements, metadata, _config ->
    Logger.info("Processed in #{measurements.duration}ns")
  end,
  nil
)
```

Wire to Prometheus / DataDog for dashboards: throughput, latency, failure rate, batch sizes.

## Best Practices

- **Concurrency = consumer count** in processors (you can have more than queue concurrency)
- Keep `handle_message/3` light — heavy work in `handle_batch/4` (batched DB writes much cheaper)
- Use multiple batchers when downstream targets differ (DB vs cache vs search)
- Set `batch_timeout` based on freshness SLA — 100ms for realtime, 30s for analytics
- Idempotent processing — messages may be redelivered after crashes
- Graceful shutdown: Broadway handles SIGTERM, drains in-flight batches
- Monitor queue depth externally (CloudWatch for SQS) — Broadway can't tell you "queue is backed up"

## Performance Tuning

- Producer concurrency: usually 1 (the source handles fan-out); raise for Kafka with many partitions
- Processor concurrency: based on per-message work — 10-100 is typical
- Batcher batch_size: tune to DB capacity — 50-500 inserts/transaction is sweet spot for Postgres
- Memory: each message lives in BEAM until acked — don't load huge payloads

## Common Pitfalls

- Heavy work in `handle_message` (not batched) → bottleneck
- Forgetting `Message.put_batcher/2` → goes to default, breaks routing
- Non-idempotent processing + at-least-once delivery → duplicates in DB
- Logging full message payload at info level → log volume explosion
- Crashes in `handle_batch` lose ALL messages in batch → use try/rescue + DLQ for partial-failure tolerance
- Not setting `batch_timeout` → low-traffic pipelines never flush

## Resources

- Docs: https://hexdocs.pm/broadway
- SQS adapter: https://hexdocs.pm/broadway_sqs
- Kafka adapter: https://hexdocs.pm/broadway_kafka
- RabbitMQ adapter: https://hexdocs.pm/broadway_rabbitmq
