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

import structlog
from typing import Optional

from models.schemas import GeminiAnalysis, VenueRecommendation
from data.federal_courts import FEDERAL_COURTS, STATE_TO_PRIMARY_COURT

log = structlog.get_logger()

# ---------------------------------------------------------------------------
# Court label map
# ---------------------------------------------------------------------------

_COURT_LABELS: dict[str, str] = {
    "nysd":    "S.D.N.Y. (Manhattan Federal Court)",
    "nyed":    "E.D.N.Y. (Brooklyn Federal Court)",
    "nysupct": "New York Supreme Court (Queens County)",
    "cand":    "N.D. Cal. (San Francisco Federal Court)",
    "cacd":    "C.D. Cal. (Los Angeles Federal Court)",
    "cal":     "California Superior Court",
}
# Populate all federal court labels from the data file
_COURT_LABELS.update({k: v["label"] for k, v in FEDERAL_COURTS.items()})

# Phrases that indicate a California jurisdiction
_CA_INDICATORS = [
    "n.d. cal", "s.d. cal", "c.d. cal", "e.d. cal",
    "northern district of california", "southern district of california",
    "central district of california",
    ", ca", "california", " ca ", "bay area", "los angeles", "san francisco",
    "san jose", "san diego", "sacramento",
]


def _is_california(analysis: GeminiAnalysis) -> bool:
    """Returns True when Gemini's jurisdiction string indicates California."""
    jur = (analysis.jurisdiction or "").lower()
    loc_p = (analysis.inferred_plaintiff_location or "").lower()
    loc_d = (analysis.inferred_defendant_location or "").lower()
    combined = f"{jur} {loc_p} {loc_d}"
    return any(ind in combined for ind in _CA_INDICATORS)

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


def _infer_state(analysis: GeminiAnalysis) -> Optional[str]:
    """Extract 2-letter US state from Gemini jurisdiction string."""
    import re
    jur = (analysis.jurisdiction or "").upper()
    state_patterns = {
        "TEX": "TX", "TEXAS": "TX", "FLA": "FL", "FLORIDA": "FL",
        "ILL": "IL", "ILLINOIS": "IL", "MICH": "MI", "MICHIGAN": "MI",
        "PENN": "PA", "PENNSYLVANIA": "PA", "OHIO": "OH", "WASH": "WA",
        "WASHINGTON": "WA", "COLO": "CO", "COLORADO": "CO",
        "MASS": "MA", "MASSACHUSETTS": "MA", "CONN": "CT",
        "ORE": "OR", "OREGON": "OR",
        "MINN": "MN", "MINNESOTA": "MN", "WISC": "WI", "WISCONSIN": "WI",
        "MISS": "MS", "MISSISSIPPI": "MS", "ARIZ": "AZ", "ARIZONA": "AZ",
        "TENN": "TN", "TENNESSEE": "TN", "KAN": "KS", "KANSAS": "KS",
        "NEV": "NV", "NEVADA": "NV", "ARK": "AR", "ARKANSAS": "AR",
        "OKLA": "OK", "OKLAHOMA": "OK", "UTAH": "UT", "IOWA": "IA",
        "D.C.": "DC", "COLUMBIA": "DC",
    }
    for pattern, state in state_patterns.items():
        if pattern in jur:
            return state
    for state in _STATE_ABBREVS:
        if re.search(rf'\b{state}\b', jur):
            return state
    return None


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
            log.info(
                "Corporate HQ diversity override: hq=%s -> federal venue",
                corporate_hq_state,
            )

    is_ca = _is_california(analysis)

    log.info(
        "Venue optimizer: federal_q=%s, diversity=%s, unknown_defendant=%s, corp_hq=%s, is_ca=%s",
        federal_q, diversity, unknown_defendant, corporate_hq_state, is_ca,
    )

    # ---- California routing (overrides NY defaults) --------------------------
    if is_ca:
        primary = "cand" if "n.d. cal" in (analysis.jurisdiction or "").lower() else "cacd"
        secondary = "cacd" if primary == "cand" else "cand"
        if federal_q:
            return VenueRecommendation(
                recommended_court=primary,
                recommended_court_label=_COURT_LABELS[primary],
                reasoning=(
                    f"Federal question jurisdiction detected. {_COURT_LABELS[primary]} is "
                    "recommended as the primary California federal venue based on the "
                    "identified jurisdiction and legal issues."
                ),
                alternatives=[
                    {
                        "court": secondary,
                        "label": _COURT_LABELS[secondary],
                        "rationale": f"Alternative California federal district if operative events occurred there.",
                    },
                    {
                        "court": "cal",
                        "label": _COURT_LABELS["cal"],
                        "rationale": "California state court if federal claims are dropped.",
                    },
                ],
                john_doe_protocol=False,
            )
        return VenueRecommendation(
            recommended_court="cal",
            recommended_court_label=_COURT_LABELS["cal"],
            reasoning=(
                "California state-law matter. California Superior Court is recommended. "
                "Federal court may be appropriate if diversity or a federal hook is established."
            ),
            alternatives=[
                {
                    "court": primary,
                    "label": _COURT_LABELS[primary],
                    "rationale": "Federal court if diversity jurisdiction or a federal statute applies.",
                },
            ],
            john_doe_protocol=unknown_defendant,
        )

    # ---- Other US states (route to primary federal district) ----------------
    inferred_state = _infer_state(analysis)
    if inferred_state and inferred_state not in ("NY", "CA") and inferred_state in STATE_TO_PRIMARY_COURT:
        primary_court_id = STATE_TO_PRIMARY_COURT[inferred_state]
        court_info = FEDERAL_COURTS.get(primary_court_id, {})
        court_label = court_info.get("label", primary_court_id.upper())
        coverage = court_info.get("coverage", "limited")
        coverage_note = (
            "" if coverage == "full"
            else f" Note: CourtListener RECAP coverage for {inferred_state} is {coverage} — results may be less precise."
        )
        if federal_q or diversity:
            return VenueRecommendation(
                recommended_court=primary_court_id,
                recommended_court_label=court_label,
                reasoning=(
                    f"{'Federal question' if federal_q else 'Diversity'} jurisdiction detected. "
                    f"{court_label} is the primary federal venue for {inferred_state}.{coverage_note}"
                ),
                alternatives=[],
                john_doe_protocol=False,
            )

    # ---- Priority 1: Federal Question (NY) -----------------------------------
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
