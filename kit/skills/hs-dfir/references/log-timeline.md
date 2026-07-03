# Log-Timeline Reasoning

Build a queryable timeline from parsed logs, then reason over it with SQL instead of eyeballing raw text. This turns "grep for suspicious lines" into "ask the timeline what happened between 02:14 and 02:31 UTC across every host."

> **Attribution:** The parse-then-reason-in-SQL pattern is adapted from the `logs_reasoning` concept in [google/sec-gemini](https://github.com/google/sec-gemini) (Apache-2.0). Only the concept is reproduced here — no code was copied. This file documents a technique to apply manually or via a short script; it does not ship as a hailykit CLI command.

## Why SQLite, and why `node:sqlite`

A timeline is a set of typed, timestamped events you need to filter, join, and aggregate — exactly what SQL is for. `node:sqlite` is a Node.js built-in (available from Node 22.5+, experimental until Node 24; hailykit's own floor is Node 20, so check `process.versions.node` before relying on it, or fall back to the external Plaso option below on older runtimes). Using the built-in means zero new dependencies, no network fetch, and a single portable `.sqlite` file that survives after the investigation as case evidence.

Do not reach for a heavier datastore for this — an incident's log volume rarely exceeds what SQLite comfortably indexes, and portability of a single file matters more than write throughput here.

## Schema

A minimal timeline needs one events table and one sources table, so every event traces back to the artifact it came from (chain-of-custody, not just data).

```sql
CREATE TABLE sources (
  id        INTEGER PRIMARY KEY,
  path      TEXT NOT NULL,       -- path to the (copied, not original) artifact
  sha256    TEXT NOT NULL,       -- hash recorded during Recon
  log_type  TEXT NOT NULL        -- e.g. 'auth', 'web-access', 'edr', 'firewall'
);

CREATE TABLE events (
  id          INTEGER PRIMARY KEY,
  source_id   INTEGER NOT NULL REFERENCES sources(id),
  ts_utc      TEXT NOT NULL,     -- ISO 8601, normalized to UTC — never store mixed timezones
  host        TEXT,
  actor       TEXT,              -- user, process, or service account
  action      TEXT NOT NULL,     -- e.g. 'login', 'process-create', 'http-request', 'file-write'
  target      TEXT,              -- file path, URL, dest IP, etc.
  raw_line    TEXT NOT NULL      -- original line, for citation in the report
);

CREATE INDEX idx_events_ts     ON events(ts_utc);
CREATE INDEX idx_events_host   ON events(host);
CREATE INDEX idx_events_action ON events(action);
```

## Building the timeline (`node:sqlite`)

```js
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('./case-2114-timeline.sqlite');
db.exec(`
  CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY, path TEXT, sha256 TEXT, log_type TEXT);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY, source_id INTEGER, ts_utc TEXT, host TEXT,
    actor TEXT, action TEXT, target TEXT, raw_line TEXT
  );
`);

const insertSource = db.prepare('INSERT INTO sources (path, sha256, log_type) VALUES (?, ?, ?)');
const insertEvent = db.prepare(
  'INSERT INTO events (source_id, ts_utc, host, actor, action, target, raw_line) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

// One insertSource() call per hashed artifact from Recon, then one insertEvent()
// call per parsed log line, mapped into the normalized schema above.
```

Parsing itself is log-format-specific (syslog, JSON EDR export, W3C web-access log, Windows Event XML) — write a small parser per format that emits `{ ts_utc, host, actor, action, target, raw_line }` tuples and feed them to `insertEvent`. Normalize every timestamp to UTC at parse time; mixed timezones are the single most common cause of a wrong timeline.

## Reasoning over the timeline

Once built, investigate with SQL instead of re-reading raw logs:

```sql
-- What happened on the suspected patient-zero host in the hour around first detection?
SELECT ts_utc, actor, action, target FROM events
WHERE host = 'web01' AND ts_utc BETWEEN '2026-07-02T02:00:00Z' AND '2026-07-02T03:00:00Z'
ORDER BY ts_utc;

-- Lateral movement: same actor authenticating across multiple hosts within a short window
SELECT actor, COUNT(DISTINCT host) AS hosts, MIN(ts_utc), MAX(ts_utc)
FROM events WHERE action = 'login'
GROUP BY actor HAVING hosts > 1
ORDER BY hosts DESC;

-- First and last sighting of an IOC value across the whole environment
SELECT MIN(ts_utc), MAX(ts_utc), COUNT(*) FROM events WHERE target = '203.0.113.9';
```

Each query answers one investigative question (scope, dwell time, lateral movement, first/last sighting) and its result becomes a cited fact in the incident report — always keep `raw_line` alongside so a finding traces back to source.

## External option: Plaso / log2timeline

For disk images and mixed forensic artifacts (filesystem metadata, registry hives, browser history) rather than plain-text logs, use [Plaso](https://plaso.readthedocs.io/)'s `log2timeline.py` to produce a super-timeline, then `psort.py` to filter/export it. Merge its output into the same `events` table (map Plaso's `datetime`, `source`, `message` fields onto `ts_utc`, `action`, `raw_line`) so both text logs and disk-artifact events live in one queryable timeline.

```
log2timeline.py --storage-file case-2114.plaso ./evidence-copy/disk-image/
psort.py -o l2tcsv -w case-2114-plaso.csv case-2114.plaso
```

Import the resulting CSV into the `events` table with the same normalization rules (UTC, cite `raw_line`) so downstream queries do not need to care which pipeline produced a given row.
