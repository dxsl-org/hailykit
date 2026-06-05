---
name: tech-runtime
description: Runtime usage monitoring — context window thresholds, usage limit tracking, hook injection architecture, action thresholds by utilization level.
---

# Runtime Awareness

Monitor context window utilization and API usage limits during active sessions.

## Two Metrics to Track

1. **Context window utilization** — percentage of the current session's context window consumed
2. **API usage limits** — quota consumption across 5-hour and 7-day rolling windows

## Injected Awareness Format

The runtime hook injects a usage summary periodically via PostToolUse:

```
<usage-awareness>
Limits: 5h=45%, 7d=32%
Context: 67%
</usage-awareness>
```

With warnings when thresholds are approached:

```
<usage-awareness>
Limits: 5h=75% [WARNING], 7d=32%
Context: 78% [WARNING - consider compaction]
</usage-awareness>
```

## Context Window Thresholds

| Utilization | Status | Recommended Action |
|-------------|--------|--------------------|
| < 70% | Normal | Continue normally |
| 70–80% | Warning | Plan a compaction strategy |
| 80–90% | High | Execute compaction now |
| > 90% | Critical | Immediate compaction or session reset |

## API Usage Limit Thresholds

### 5-Hour Rolling Window

| Utilization | Recommended Action |
|-------------|-------------------|
| < 70% | Normal usage |
| 70–90% | Reduce parallelization; prefer sequential over concurrent sub-agents |
| > 90% | Wait for reset or use a lower-tier model |

### 7-Day Rolling Window

| Utilization | Recommended Action |
|-------------|-------------------|
| < 70% | Normal usage |
| 70–90% | Monitor daily consumption rate |
| > 90% | Limit usage to essential tasks only |

## Hook Architecture

The runtime awareness system has two components:

1. **Statusline** — writes context window data (token count, percentage, cache breakdown) to a temp file after each response
2. **PostToolUse hook** — reads the temp file and the Anthropic usage API, then injects the `<usage-awareness>` block into the conversation

The hook fires at a configurable interval (default: every 5 minutes) to avoid injecting every tool call.

## Usage Limits API

```
GET https://api.anthropic.com/api/oauth/usage
Authorization: Bearer <oauth-token>
anthropic-beta: oauth-2025-04-20
```

Response fields:
- `five_hour.utilization` — integer 0–100 (already a percentage)
- `five_hour.resets_at` — ISO 8601 timestamp
- `seven_day.utilization` — integer 0–100
- `seven_day.resets_at` — ISO 8601 timestamp

## Credential Locations

| Platform | Location |
|----------|----------|
| macOS | Keychain — `Claude Code-credentials` |
| Windows | `%USERPROFILE%\.claude\.credentials.json` |
| Linux | `~/.claude/.credentials.json` |

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No usage limits shown | No OAuth token | Run `claude login` |
| Context % not updating | Statusline not writing temp file | Check statusline configuration |
| 401 Unauthorized | Expired OAuth token | Re-authenticate |
| Hook not injecting | PostToolUse matcher misconfigured | Verify settings.json hook entry |

## Related

- `tech-optimization.md` — what to do when context is high
- `tech-compression.md` — compaction strategies for high-utilization sessions
