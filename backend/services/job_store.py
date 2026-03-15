"""
Redis-backed job state store for async match pipeline jobs.

Job lifecycle: queued -> analyzing -> searching -> scoring -> auditing -> complete | failed

Each job key has a 2-hour TTL in Redis. The frontend polls GET /api/jobs/{job_id}
every 2 seconds until stage == "complete" or "failed".
"""
from __future__ import annotations

import json
import os
import uuid
from typing import Any, Optional

import structlog

log = structlog.get_logger()

_JOB_TTL = 7200  # 2 hours in seconds


def _redis():
    """Return a synchronous redis.Redis client (used inside asyncio.to_thread)."""
    import redis as _redis_lib
    url = os.getenv("REDIS_URL", "redis://localhost:6379")
    return _redis_lib.from_url(url, decode_responses=True)


async def create_job(case_id: str) -> str:
    """Create a new job entry in Redis and return the job_id."""
    import asyncio
    import functools

    job_id = str(uuid.uuid4())
    state = json.dumps({"stage": "queued", "case_id": case_id, "result": None, "error": None})
    r = _redis()
    await asyncio.to_thread(functools.partial(r.setex, f"job:{job_id}", _JOB_TTL, state))
    log.info("job_created", job_id=job_id, case_id=case_id)
    return job_id


async def update_job_stage(job_id: str, stage: str) -> None:
    """Update only the stage field of a job."""
    import asyncio

    r = _redis()

    def _update(r=r):
        raw = r.get(f"job:{job_id}")
        if not raw:
            return
        state = json.loads(raw)
        state["stage"] = stage
        r.setex(f"job:{job_id}", _JOB_TTL, json.dumps(state))

    await asyncio.to_thread(_update)
    log.debug("job_stage_updated", job_id=job_id, stage=stage)


async def complete_job(job_id: str, result: dict) -> None:
    """Mark job complete and store the full result."""
    import asyncio

    r = _redis()

    def _complete(r=r):
        raw = r.get(f"job:{job_id}")
        state = json.loads(raw) if raw else {}
        state["stage"] = "complete"
        state["result"] = result
        r.setex(f"job:{job_id}", _JOB_TTL, json.dumps(state))

    await asyncio.to_thread(_complete)
    log.info("job_complete", job_id=job_id)


async def fail_job(job_id: str, error: str) -> None:
    """Mark job failed with an error message."""
    import asyncio

    r = _redis()

    def _fail(r=r):
        raw = r.get(f"job:{job_id}")
        state = json.loads(raw) if raw else {}
        state["stage"] = "failed"
        state["error"] = error
        r.setex(f"job:{job_id}", _JOB_TTL, json.dumps(state))

    await asyncio.to_thread(_fail)
    log.warning("job_failed", job_id=job_id, error=error)


async def get_job(job_id: str) -> Optional[dict]:
    """Retrieve job state. Returns None if job_id doesn't exist."""
    import asyncio
    import functools

    r = _redis()
    raw = await asyncio.to_thread(functools.partial(r.get, f"job:{job_id}"))
    if not raw:
        return None
    return json.loads(raw)
