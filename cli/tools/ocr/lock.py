"""lock.py — advisory single-writer output-root lock, split out of batch.py
(which was over this repo's 200-line file guideline) to keep the lock
mechanics separable from the per-document pipeline that uses them.

Advisory only: `O_CREAT|O_EXCL` is the sole atomicity primitive (no
distributed coordination beyond the filesystem) — a second live invocation
raises `RunInProgressError`; a lock left by a dead pid or older than
`stale_seconds` is reclaimed once, then retried.
"""
from __future__ import annotations

import ctypes
import json
import os
import time

LOCK_FILENAME = "manifest.lock"
DEFAULT_STALE_SECONDS = 3600


class RunInProgressError(RuntimeError):
    code = "run_in_progress"


def _pid_alive(pid: int) -> bool:
    """Cross-platform liveness check — `os.kill(pid, 0)` isn't meaningful on
    Windows, so use OpenProcess via ctypes (stdlib) there instead."""
    if os.name == "nt":
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if handle:
            ctypes.windll.kernel32.CloseHandle(handle)
            return True
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _lock_stat(lock_path: str) -> tuple[float, int | None] | None:
    """Snapshot `(mtime, pid)` of the CURRENT file at `lock_path`, or `None`
    if it's gone entirely. Two independent snapshots taken moments apart are
    compared by `acquire_lock` to detect whether another run already
    reclaimed/renewed the lock in between (see that function's TOCTOU note)."""
    try:
        mtime = os.path.getmtime(lock_path)
    except OSError:
        return None
    pid: int | None = None
    try:
        with open(lock_path, "r", encoding="utf-8") as fh:
            info = json.load(fh)
        raw_pid = info.get("pid")
        if isinstance(raw_pid, int):
            pid = raw_pid
    except (OSError, ValueError):
        pass
    return (mtime, pid)


def _stat_is_stale(stat: tuple[float, int | None] | None, stale_seconds: int) -> bool:
    if stat is None:
        return True
    mtime, pid = stat
    if time.time() - mtime > stale_seconds:
        return True
    if pid is None:
        return False  # unreadable but fresh - assume a concurrent writer, not stale
    return not _pid_alive(pid)


def acquire_lock(output_root: str, *, stale_seconds: int = DEFAULT_STALE_SECONDS) -> str:
    """Advisory single-writer lock at the output root: `O_CREAT|O_EXCL` is the
    atomicity primitive (no distributed coordination beyond the filesystem).
    A second live invocation gets `RunInProgressError`; a lock left by a dead
    pid or older than `stale_seconds` is reclaimed once, then retried.
    """
    os.makedirs(output_root, exist_ok=True)
    lock_path = os.path.join(output_root, LOCK_FILENAME)
    payload = json.dumps({"pid": os.getpid(), "created": time.time()}).encode("utf-8")
    for attempt in range(2):
        try:
            fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            with os.fdopen(fd, "wb") as fh:
                fh.write(payload)
            return lock_path
        except FileExistsError:
            if attempt == 0:
                stat = _lock_stat(lock_path)
                # Re-stat immediately before unlinking (TOCTOU guard): if the
                # file changed between the two snapshots, another run already
                # reclaimed or renewed it in that gap - treat that as
                # authoritative (fall through to RunInProgressError) instead
                # of deleting a lock we can no longer confirm is still stale.
                if _stat_is_stale(stat, stale_seconds) and _lock_stat(lock_path) == stat:
                    try:
                        os.remove(lock_path)
                    except OSError:
                        pass
                    continue
            raise RunInProgressError(f"another OCR run holds the lock at {lock_path!r}")
    raise RunInProgressError(f"another OCR run holds the lock at {lock_path!r}")


def release_lock(lock_path: str) -> None:
    try:
        os.remove(lock_path)
    except OSError:
        pass
