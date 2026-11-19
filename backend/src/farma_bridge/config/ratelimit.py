"""Tiny in-memory per-IP rate limiter for the sign-in endpoints.

Good enough for one API process; behind several workers/replicas use a shared store (Redis) instead.
Set RATE_LIMIT_ENABLED=false to turn it off (tests, local load runs).
"""
import os
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def reset() -> None:
    _hits.clear()


def limit(name: str, max_calls: int, per_seconds: int = 600):
    """FastAPI dependency: at most `max_calls` per client IP per `per_seconds` for this endpoint group."""

    def dependency(request: Request) -> None:
        if os.getenv("RATE_LIMIT_ENABLED", "true").lower() in {"0", "false", "no"}:
            return
        key = (name, request.client.host if request.client else "unknown")
        now = time.monotonic()
        q = _hits[key]
        while q and now - q[0] > per_seconds:
            q.popleft()
        if len(q) >= max_calls:
            raise HTTPException(429, "Too many requests. Please wait a few minutes and try again.", headers={"Retry-After": str(per_seconds)})
        q.append(now)

    return dependency
