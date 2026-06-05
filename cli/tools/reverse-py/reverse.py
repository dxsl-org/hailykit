#!/usr/bin/env python3
"""Example external (polyglot) hailykit tool, in Python.

Protocol: read ONE NDJSON request line on stdin, write ONE NDJSON response
line on stdout, exit 0. See docs/tech-stack.md -> "Polyglot protocol".
    request : {"v":1,"id":"...","tool":"reverse-py","input":{"text":"..."},...}
    response: {"v":1,"id":"...","ok":true,"output":{"text":"..."}}
"""
import json
import sys


def main() -> None:
    raw = sys.stdin.read()
    lines = [ln for ln in raw.strip().split("\n") if ln]
    try:
        request = json.loads(lines[-1]) if lines else {}
    except json.JSONDecodeError as exc:
        _write({"v": 1, "id": "unknown", "ok": False,
                "error": {"code": "E_BAD_REQUEST", "message": str(exc)}})
        return

    text = ""
    if isinstance(request.get("input"), dict):
        value = request["input"].get("text")
        if isinstance(value, str):
            text = value

    _write({"v": 1, "id": request.get("id"), "ok": True,
            "output": {"text": text[::-1]}})


def _write(response: dict) -> None:
    sys.stdout.write(json.dumps(response) + "\n")


if __name__ == "__main__":
    main()
