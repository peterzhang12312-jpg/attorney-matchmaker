"""POST /api/case-lookup -- search CourtListener by docket number, case name, or description."""
import structlog
from fastapi import APIRouter, Request
from middleware.rate_limit import limiter
from models.schemas import CaseLookupRequest, CaseLookupResponse
from services.case_lookup import lookup_case

log = structlog.get_logger()
router = APIRouter(prefix="/api", tags=["Case Lookup"])


@router.post("/case-lookup", response_model=CaseLookupResponse)
@limiter.limit("5/minute")
async def case_lookup_endpoint(
    request: Request,
    body: CaseLookupRequest,
) -> CaseLookupResponse:
    """
    Search for a case by docket number, case name, or description.
    Returns attorneys, motion timelines, AI explanations, and similar available attorneys.
    All fields are optional -- the more information provided, the better the results.
    """
    intake_description: str | None = None

    # If client provides their intake case_id, fetch description for similarity scoring
    if body.intake_case_id:
        try:
            from db.session import get_db
            from db.queries import get_case
            async for db in get_db():
                case = await get_case(db, body.intake_case_id)
                if case:
                    intake_description = case.description
                break
        except Exception as exc:
            log.warning("case_lookup_intake_fetch_failed", error=str(exc))

    return await lookup_case(body.query, intake_description)
