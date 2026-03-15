"""GET /api/jobs/{job_id} -- poll async match job status."""
import structlog
from fastapi import APIRouter, HTTPException

from services.job_store import get_job

log = structlog.get_logger()
router = APIRouter(prefix="/api", tags=["Jobs"])


@router.get("/jobs/{job_id}")
async def poll_job(job_id: str) -> dict:
    """
    Returns job state: { stage, case_id, result?, error? }

    Stages: queued | analyzing | searching | scoring | auditing | complete | failed

    The 'result' field is populated (with the full MatchResponse as a dict)
    only when stage == 'complete'. Poll every 2 seconds.
    """
    job = await get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return job
