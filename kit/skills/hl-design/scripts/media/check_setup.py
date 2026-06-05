#!/usr/bin/env python3
"""Verify hd:ai-generation environment: API keys + dependencies."""
from __future__ import annotations

import os
import sys


def check_env() -> list[str]:
    errors = []
    if not os.environ.get("MINIMAX_API_KEY"):
        errors.append("MINIMAX_API_KEY not set (required for MiniMax image/video/speech/music)")
    if not os.environ.get("OPENROUTER_API_KEY"):
        print("[info] OPENROUTER_API_KEY not set — OpenRouter image routing unavailable (MiniMax still works)")
    return errors


def check_deps() -> list[str]:
    errors = []
    for mod in ("requests", "dotenv", "PIL"):
        try:
            __import__(mod)
        except ImportError:
            errors.append(f"Missing dependency: {mod} — run `pip install -r scripts/requirements.txt`")
    return errors


def main() -> int:
    print("Checking hd:ai-generation setup...")
    errors = check_env() + check_deps()
    if errors:
        print("\n[FAIL] Issues found:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("[OK] hd:ai-generation environment ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
