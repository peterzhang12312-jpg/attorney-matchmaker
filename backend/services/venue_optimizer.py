"""
Venue Optimizer — automatic court selection from Gemini fact analysis.

Decision logic (NY-focused, priority order):
  1. Federal question  → SDNY or EDNY
  2. Diversity         → SDNY or EDNY  (plaintiff/defendant in different states)
  3. State-only        → Queens County Supreme Court
  4. Unknown defendant → Queens County + john_doe_protocol=True

All decisions are based solely on the GeminiAnalysis output — no user input
for jurisdiction is required.  This is the "black box" replacement for the
old JurisdictionPicker / VenueStep manual flow.
"""

from __future__ import annotations

import logging
from typing import Optional

from models.schemas import GeminiAnalysis, VenueRecommendation

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Court label map
# ---------------------------------------------------------------------------

_COURT_LABELS: dict[str, str] = {
    "nysd":    "S.D.N.Y. (Manhattan Federal Court)",
    "nyed":    "E.D.N.Y. (Brooklyn Federal Court)",
    "nysupct": "New York Supreme Court (Queens County)",
}

# Statutes / phrases that imply federal question jurisdiction
_FEDERAL_STATUTES = [
    "17 u.s.c", "15 u.s.c", "35 u.s.c", "18 u.s.c", "42 u.s.c",
    "copyright", "patent", "trademark", "lanham act",
    "securities", "rico", "civil rights", "section 1983",
    "ada", "title vii", "fmla", "flsa", "erisa",
    "federal", "fdcpa", "tcpa", "cfpb",
]

# US state abbreviations (for diversity detection from location strings)
_STATE_ABBREVS = {
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC",
}


def _extract_state(location: Optional[str]) -> Optional[str]:
    """Return 2-letter state abbreviation from 'City, ST' or bare 'ST' strings."""
    if not location:
        return None
    parts = location.strip().split(",")
    candidate = parts[-1].strip().upper()
    if candidate in _STATE_ABBREVS:
        return candidate
    return None


def _has_federal_question(analysis: GeminiAnalysis) -> bool:
    """
    Returns True when the key_issues or primary_legal_area reference a
    federal statute, copyright, patent, or other federal hook.
    """
    issues_text = " ".join(analysis.key_issues).lower()
    area_text = analysis.primary_legal_area.lower()
    combined = issues_text + " " + area_text
    return any(kw in combined for kw in _FEDERAL_STATUTES)


def _has_diversity(analysis: GeminiAnalysis) -> bool:
    """
    Returns True when plaintiff and defendant are in different states
    (inferred by Gemini from the facts).
    """
    p_state = _extract_state(analysis.inferred_plaintiff_location)
    d_state = _extract_state(analysis.inferred_defendant_location)
    if p_state and d_state and p_state != d_state:
        return True
    return False


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def recommend_venue(
    analysis: GeminiAnalysis,
    case_description: str = "",  # noqa: ARG001 — reserved for future LLM call
    corporate_hq_state: Optional[str] = None,
) -> VenueRecommendation:
    """
    Determine the optimal venue from Gemini's fact analysis.

    Returns a VenueRecommendation with the primary court, reasoning,
    alternative options, and John Doe protocol flag.

    Parameters
    ----------
    corporate_hq_state : str, optional
        Two-letter US state abbreviation of the corporate defendant's registered
        HQ (from OpenCorporates lookup).  If set and not 'NY', forces diversity
        jurisdiction routing to federal court even if Gemini did not infer it.
    """
    federal_q = _has_federal_question(analysis)
    diversity = _has_diversity(analysis)
    unknown_defendant = analysis.defendant_location_unknown

    # Corporate HQ diversity override: if we resolved the defendant's HQ to a
    # non-NY state, force diversity=True so we route to federal court.
    if corporate_hq_state and corporate_hq_state.upper() not in ("NY", ""):
        if not diversity:
            diversity = True
            unknown_defendant = False
            logger.info(
                "Corporate HQ diversity override: hq=%s -> federal venue",
                corporate_hq_state,
            )

    logger.info(
        "Venue optimizer: federal_q=%s, diversity=%s, unknown_defendant=%s, corp_hq=%s",
        federal_q, diversity, unknown_defendant, corporate_hq_state,
    )

    # ---- Priority 1: Federal Question ----------------------------------------
    if federal_q:
        return VenueRecommendation(
            recommended_court="nysd",
            recommended_court_label=_COURT_LABELS["nysd"],
            reasoning=(
                "Federal question jurisdiction detected based on the identified legal issues "
                "(federal statute, copyright, patent, or civil rights claim). "
                "S.D.N.Y. (Manhattan) is recommended as the primary federal venue for "
                "New York-area matters of this type, offering a well-developed body of "
                "precedent and experienced federal judiciary."
            ),
            alternatives=[
                {
                    "court": "nyed",
                    "label": _COURT_LABELS["nyed"],
                    "rationale": "E.D.N.Y. (Brooklyn) is an alternative federal venue; "
                                 "consider if operative events occurred in Brooklyn, Queens, "
                                 "Long Island, or Staten Island.",
                },
                {
                    "court": "nysupct",
                    "label": _COURT_LABELS["nysupct"],
                    "rationale": "State court may be appropriate if federal claims are dropped "
                                 "or pendent state claims predominate.",
                },
            ],
            john_doe_protocol=False,
        )

    # ---- Priority 2: Diversity -----------------------------------------------
    if diversity:
        p_state = _extract_state(analysis.inferred_plaintiff_location) or "unknown"
        d_state = corporate_hq_state or _extract_state(analysis.inferred_defendant_location) or "unknown"
        corp_note = (
            f" Corporate defendant headquarters resolved to {corporate_hq_state} via registry lookup."
            if corporate_hq_state and corporate_hq_state.upper() not in ("NY", "")
            else ""
        )
        return VenueRecommendation(
            recommended_court="nysd",
            recommended_court_label=_COURT_LABELS["nysd"],
            reasoning=(
                f"Diversity jurisdiction appears available: plaintiff is in {p_state} "
                f"and defendant is in {d_state}, suggesting complete diversity under "
                f"28 U.S.C. § 1332.{corp_note} S.D.N.Y. (Manhattan) is recommended assuming the "
                "amount in controversy exceeds $75,000. Federal venue provides access "
                "to federal procedural rules and an Article III judiciary."
            ),
            alternatives=[
                {
                    "court": "nyed",
                    "label": _COURT_LABELS["nyed"],
                    "rationale": "E.D.N.Y. (Brooklyn) is a valid alternative diversity venue "
                                 "if the defendant's principal place of business or the events "
                                 "at issue are located in the Eastern District.",
                },
                {
                    "court": "nysupct",
                    "label": _COURT_LABELS["nysupct"],
                    "rationale": "New York Supreme Court (state) is available if federal "
                                 "diversity is not met or the amount in controversy is below the "
                                 "$75,000 threshold.",
                },
            ],
            john_doe_protocol=False,
        )

    # ---- Priority 3 / 4: State-only or Unknown Defendant --------------------
    if unknown_defendant:
        return VenueRecommendation(
            recommended_court="nysupct",
            recommended_court_label=_COURT_LABELS["nysupct"],
            reasoning=(
                "The defendant's location could not be determined from the provided facts. "
                "New York Supreme Court (Queens County) is recommended as a provisional "
                "state-court venue pending defendant identification. A John Doe complaint "
                "or jurisdictional discovery may be necessary before service can be effected."
            ),
            alternatives=[
                {
                    "court": "nysd",
                    "label": _COURT_LABELS["nysd"],
                    "rationale": "Federal court (S.D.N.Y.) may become appropriate once "
                                 "defendant identity and domicile are established, if federal "
                                 "question or diversity jurisdiction arises.",
                },
            ],
            john_doe_protocol=True,
            john_doe_recommendation=(
                "Defendant location is unknown. We recommend filing a John Doe summons "
                "in New York Supreme Court or seeking an expedited order for jurisdictional "
                "discovery (e.g., a subpoena to a platform or registrar) before service. "
                "Once the defendant is identified, evaluate whether to amend and re-file "
                "in federal court."
            ),
        )

    # Pure state-law / both parties in NY (or insufficiently identified diversity)
    return VenueRecommendation(
        recommended_court="nysupct",
        recommended_court_label=_COURT_LABELS["nysupct"],
        reasoning=(
            "No federal hook detected (no federal statute and no diversity of citizenship). "
            "New York Supreme Court (Queens County) is recommended for this state-law matter. "
            "State court provides access to New York substantive law and local procedural "
            "rules well-suited to this type of claim."
        ),
        alternatives=[
            {
                "court": "nysd",
                "label": _COURT_LABELS["nysd"],
                "rationale": "S.D.N.Y. (federal) may become appropriate if a federal claim "
                             "is added or complete diversity is established.",
            },
            {
                "court": "nyed",
                "label": _COURT_LABELS["nyed"],
                "rationale": "E.D.N.Y. (Brooklyn federal) is an alternative if events "
                             "occurred in the Eastern District and federal jurisdiction attaches.",
            },
        ],
        john_doe_protocol=False,
    )
