#!/usr/bin/env bash
# diff-tests.sh — Detect NEW test failures vs a baseline.
#
# Usage:
#   diff-tests.sh <baseline-file> <current-file>
#
#   Files may be CTRF JSON, JUnit XML, or a plain-text exit-code file.
#   Format is auto-detected from file content.
#
# Exit codes:
#   0  no new failures (gate passes)
#   1  new failures found (gate fails; names/count printed to stdout)
#   2  error (missing files, unreadable, etc.)
#
# Requires: jq for CTRF JSON (degrades gracefully if absent).
#           xmllint for JUnit name-level diff (degrades to count-only if absent).
# Zero additional npm or system dependencies required.

set -uo pipefail

BASELINE="${1:-}"
CURRENT="${2:-}"

if [[ -z "$BASELINE" || -z "$CURRENT" ]]; then
  echo "Usage: diff-tests.sh <baseline-file> <current-file>" >&2
  exit 2
fi

for f in "$BASELINE" "$CURRENT"; do
  [[ -f "$f" ]] || { echo "Error: file not found: $f" >&2; exit 2; }
done

# ── Format detection ──────────────────────────────────────────────────────────
detect_format() {
  local first
  first=$(head -c 2 "$1" 2>/dev/null | tr -d '\n')
  case "$first" in
    '{'*|'['*) echo "json" ;;
    '<'*)      echo "xml"  ;;
    *)         echo "text" ;;
  esac
}

# ── CTRF JSON path (requires jq) ──────────────────────────────────────────────
diff_ctrf() {
  if ! command -v jq &>/dev/null; then
    echo "⚠️  jq not found — falling back to exit-code comparison" >&2
    diff_exitcode
    return
  fi

  local b_fails c_fails new
  b_fails=$(jq -r '.results.tests[] | select(.status == "failed") | .name' "$BASELINE" 2>/dev/null | sort -u)
  c_fails=$(jq -r '.results.tests[] | select(.status == "failed") | .name' "$CURRENT"  2>/dev/null | sort -u)

  new=$(comm -13 \
    <(printf '%s\n' "$b_fails" | sort -u) \
    <(printf '%s\n' "$c_fails" | sort -u) 2>/dev/null || true)

  if [[ -z "$new" ]]; then
    echo "✅  no new failures (signal: CTRF)"
    exit 0
  fi
  echo "❌  new failures (signal: CTRF):"
  echo "$new"
  exit 1
}

# ── JUnit XML path ────────────────────────────────────────────────────────────
diff_junit() {
  if command -v xmllint &>/dev/null; then
    # Name-level diff via XPath
    local b_fails c_fails new
    b_fails=$(xmllint --xpath '//testcase[failure or error]/@name' "$BASELINE" 2>/dev/null \
      | grep -oP '(?<==")[^"]+' | sort -u || true)
    c_fails=$(xmllint --xpath '//testcase[failure or error]/@name' "$CURRENT"  2>/dev/null \
      | grep -oP '(?<==")[^"]+' | sort -u || true)

    new=$(comm -13 \
      <(printf '%s\n' "$b_fails" | sort -u) \
      <(printf '%s\n' "$c_fails" | sort -u) 2>/dev/null || true)

    if [[ -z "$new" ]]; then
      echo "✅  no new failures (signal: JUnit/xmllint)"
      exit 0
    fi
    echo "❌  new failures (signal: JUnit/xmllint):"
    echo "$new"
    exit 1
  fi

  # Fallback: count <failure occurrences (grep-based, no xmllint)
  echo "⚠️  xmllint not found — JUnit failure detection is count-only (names unavailable)" >&2
  local count_b count_c
  count_b=$(grep -c '<failure' "$BASELINE" 2>/dev/null || echo 0)
  count_c=$(grep -c '<failure' "$CURRENT"  2>/dev/null || echo 0)

  if (( count_c > count_b )); then
    echo "❌  failure count increased: ${count_b} → ${count_c} (signal: JUnit/grep — count-only)"
    exit 1
  fi
  echo "✅  no new failures (signal: JUnit/grep — count-only)"
  exit 0
}

# ── Exit-code / text fallback ─────────────────────────────────────────────────
diff_exitcode() {
  echo "⚠️  test-signal: exit-code only — new-failure detection is best-effort." >&2
  echo "   Pre-existing failures may mask regressions. Add a CTRF reporter for accuracy." >&2

  local code_b code_c
  code_b=$(tr -d '[:space:]' < "$BASELINE" 2>/dev/null || echo "unknown")
  code_c=$(tr -d '[:space:]' < "$CURRENT"  2>/dev/null || echo "unknown")

  if [[ "$code_b" == "0" && "$code_c" != "0" ]]; then
    echo "❌  exit-code degraded: 0 → ${code_c} (signal: exit-code)"
    exit 1
  fi
  echo "✅  no new failures detected (signal: exit-code — best-effort)"
  exit 0
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
FMT_B=$(detect_format "$BASELINE")
FMT_C=$(detect_format "$CURRENT")

if [[ "$FMT_B" == "json" && "$FMT_C" == "json" ]]; then
  diff_ctrf
elif [[ "$FMT_B" == "xml" && "$FMT_C" == "xml" ]]; then
  diff_junit
else
  diff_exitcode
fi
