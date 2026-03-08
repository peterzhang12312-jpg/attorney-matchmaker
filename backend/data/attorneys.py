"""
In-memory attorney database.

In production this would be backed by PostgreSQL with full-text search
and vector embeddings on attorney bios / case descriptions.  For the
MVP we keep everything in a Python list so the matching pipeline can
be developed and tested without infrastructure dependencies.

Every attorney record uses the canonical LegalArea enum *values*
(snake_case strings) in their specializations list so the matcher
can do direct string comparisons.
"""

from models.schemas import AttorneyProfile, Availability

ATTORNEYS: list[AttorneyProfile] = [
    # ---- 1. Intellectual Property / Patent Litigation ----
    AttorneyProfile(
        id="att-001",
        name="Dr. Sarah Chen",
        bar_number="CA-298451",
        firm="Chen & Associates IP Law",
        jurisdictions=["CA", "N.D. Cal.", "Fed. Cir.", "C.D. Cal."],
        specializations=["intellectual_property", "corporate"],
        years_experience=18,
        win_rate=0.82,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "Led patent infringement defense for SaaS company ($45M at stake), summary judgment granted",
            "Negotiated cross-licensing agreement between two Fortune 500 tech firms",
        ],
        hourly_rate=650,
        email="schen@chenip.com",
    ),
    # ---- 2. Employment / Wage-and-Hour ----
    AttorneyProfile(
        id="att-002",
        name="Marcus Williams",
        bar_number="NY-446712",
        firm="Williams Labor Group PLLC",
        jurisdictions=["NY", "S.D.N.Y.", "E.D.N.Y.", "NJ"],
        specializations=["employment", "civil_rights"],
        years_experience=14,
        win_rate=0.76,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "Class action wage-theft suit against national retailer, $12M settlement",
            "Title VII discrimination claim resulting in policy overhaul for Fortune 100 employer",
        ],
        hourly_rate=525,
        email="mwilliams@williamslabor.com",
    ),
    # ---- 3. Personal Injury / Med-Mal ----
    AttorneyProfile(
        id="att-003",
        name="Patricia Okafor",
        bar_number="IL-331890",
        firm="Okafor Trial Lawyers",
        jurisdictions=["IL", "N.D. Ill.", "IN"],
        specializations=["personal_injury", "healthcare"],
        years_experience=22,
        win_rate=0.88,
        availability=Availability.LIMITED,
        notable_cases=[
            "Traumatic brain injury verdict, $8.2M jury award",
            "Medical malpractice wrongful death, $5.5M settlement pre-trial",
        ],
        hourly_rate=600,
        email="pokafor@okafortrial.com",
    ),
    # ---- 4. Corporate / M&A ----
    AttorneyProfile(
        id="att-004",
        name="James Richardson",
        bar_number="DE-112045",
        firm="Richardson Marks LLP",
        jurisdictions=["DE", "NY", "S.D.N.Y.", "D. Del."],
        specializations=["corporate", "securities"],
        years_experience=25,
        win_rate=0.79,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "Represented target board in hostile takeover defense, $2.1B transaction",
            "Stockholder derivative suit in Chancery Court, demand refused upheld",
        ],
        hourly_rate=850,
        email="jrichardson@richardsonmarks.com",
    ),
    # ---- 5. Family Law ----
    AttorneyProfile(
        id="att-005",
        name="Diana Reyes",
        bar_number="TX-554321",
        firm="Reyes Family Law",
        jurisdictions=["TX", "S.D. Tex.", "W.D. Tex."],
        specializations=["family"],
        years_experience=12,
        win_rate=0.84,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "High-asset divorce involving community property dispute over $30M estate",
            "Interstate child custody modification under UCCJEA",
        ],
        hourly_rate=400,
        email="dreyes@reyesfamily.com",
    ),
    # ---- 6. Criminal Defense ----
    AttorneyProfile(
        id="att-006",
        name="Robert Kim",
        bar_number="FL-667890",
        firm="Kim Defense Group PA",
        jurisdictions=["FL", "S.D. Fla.", "M.D. Fla.", "11th Cir."],
        specializations=["criminal_defense"],
        years_experience=20,
        win_rate=0.72,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "Federal wire fraud defense, acquittal on all counts after 3-week trial",
            "State-level vehicular manslaughter charge reduced to misdemeanor reckless driving",
        ],
        hourly_rate=550,
        email="rkim@kimdefense.com",
    ),
    # ---- 7. Real Estate / Land Use ----
    AttorneyProfile(
        id="att-007",
        name="Angela Torres",
        bar_number="CA-778432",
        firm="Torres Land Use Law",
        jurisdictions=["CA", "C.D. Cal.", "9th Cir."],
        specializations=["real_estate", "environmental"],
        years_experience=16,
        win_rate=0.80,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "CEQA challenge to mixed-use development, injunction obtained for client coalition",
            "Eminent domain defense for commercial property owner, $4.8M just compensation award",
        ],
        hourly_rate=500,
        email="atorres@torreslanduse.com",
    ),
    # ---- 8. Immigration ----
    AttorneyProfile(
        id="att-008",
        name="Hassan Abdi",
        bar_number="DC-889012",
        firm="Abdi Immigration PLLC",
        jurisdictions=["DC", "MD", "VA", "4th Cir."],
        specializations=["immigration"],
        years_experience=10,
        win_rate=0.85,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "Asylum grant after BIA remand for Somali national",
            "Successful EB-1A petition for AI researcher with 200+ citations",
        ],
        hourly_rate=375,
        email="habdi@abdiimmigration.com",
    ),
    # ---- 9. Bankruptcy / Restructuring ----
    AttorneyProfile(
        id="att-009",
        name="Linda Kowalski",
        bar_number="IL-990134",
        firm="Kowalski Restructuring Group",
        jurisdictions=["IL", "N.D. Ill.", "7th Cir.", "DE", "D. Del."],
        specializations=["bankruptcy", "corporate"],
        years_experience=19,
        win_rate=0.77,
        availability=Availability.LIMITED,
        notable_cases=[
            "Chapter 11 restructuring for regional hospital chain, $380M in debt restructured",
            "Preference action defense for trade creditor, $6.2M claim dismissed",
        ],
        hourly_rate=625,
        email="lkowalski@kowalskirestructuring.com",
    ),
    # ---- 10. Environmental ----
    AttorneyProfile(
        id="att-010",
        name="David Nakamura",
        bar_number="WA-101234",
        firm="Nakamura Environmental Law",
        jurisdictions=["WA", "W.D. Wash.", "9th Cir.", "OR"],
        specializations=["environmental", "general_litigation"],
        years_experience=15,
        win_rate=0.74,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "Clean Water Act citizen suit against pulp mill, consent decree obtained",
            "CERCLA cost-recovery action for municipality, $11M recovered from PRPs",
        ],
        hourly_rate=475,
        email="dnakamura@nakamuraenv.com",
    ),
    # ---- 11. Healthcare / Regulatory ----
    AttorneyProfile(
        id="att-011",
        name="Dr. Priya Sharma",
        bar_number="MA-112567",
        firm="Sharma Health Law PC",
        jurisdictions=["MA", "D. Mass.", "1st Cir.", "CT"],
        specializations=["healthcare", "corporate"],
        years_experience=13,
        win_rate=0.81,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "False Claims Act defense for hospital system, case dismissed at summary judgment",
            "Stark Law self-disclosure and compliance restructuring for multi-state physician group",
        ],
        hourly_rate=575,
        email="psharma@sharmahealthlaw.com",
    ),
    # ---- 12. Securities / White-Collar ----
    AttorneyProfile(
        id="att-012",
        name="Thomas Grant",
        bar_number="NY-223456",
        firm="Grant Securities Defense LLP",
        jurisdictions=["NY", "S.D.N.Y.", "2nd Cir.", "D.C."],
        specializations=["securities", "criminal_defense"],
        years_experience=21,
        win_rate=0.73,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "SEC enforcement defense for hedge fund manager, no-admit settlement",
            "DOJ insider trading prosecution defense, acquittal at trial",
        ],
        hourly_rate=900,
        email="tgrant@grantsecurities.com",
    ),
    # ---- 13. Tax Controversy ----
    AttorneyProfile(
        id="att-013",
        name="Catherine Blake",
        bar_number="DC-334567",
        firm="Blake Tax Law",
        jurisdictions=["DC", "Tax Ct.", "Fed. Cl.", "D.C. Cir."],
        specializations=["tax", "corporate"],
        years_experience=17,
        win_rate=0.78,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "Tax Court trial on transfer pricing dispute, $28M deficiency vacated",
            "IRS Appeals resolution for partnership allocation controversy, $9M savings",
        ],
        hourly_rate=700,
        email="cblake@blaketax.com",
    ),
    # ---- 14. Civil Rights / Section 1983 ----
    AttorneyProfile(
        id="att-014",
        name="Andre Mitchell",
        bar_number="GA-445678",
        firm="Mitchell Civil Rights Law",
        jurisdictions=["GA", "N.D. Ga.", "11th Cir.", "AL"],
        specializations=["civil_rights", "employment"],
        years_experience=11,
        win_rate=0.70,
        availability=Availability.AVAILABLE,
        notable_cases=[
            "Section 1983 excessive force claim against municipality, $3.1M verdict",
            "ADA Title II class action for disability access, injunctive relief obtained",
        ],
        hourly_rate=425,
        email="amitchell@mitchellcr.com",
    ),
    # ---- 15. Employment / Non-Compete ----
    AttorneyProfile(
        id="att-015",
        name="Rachel Hoffman",
        bar_number="MA-556789",
        firm="Hoffman Employment PLLC",
        jurisdictions=["MA", "D. Mass.", "1st Cir.", "NH"],
        specializations=["employment", "intellectual_property"],
        years_experience=9,
        win_rate=0.83,
        availability=Availability.UNAVAILABLE,
        notable_cases=[
            "TRO obtained against former executive violating non-compete in biotech sector",
            "FLSA collective action for misclassified pharmaceutical sales reps, $7M settlement",
        ],
        hourly_rate=475,
        email="rhoffman@hoffmanemp.com",
    ),
]


def get_all_attorneys() -> list[AttorneyProfile]:
    """Return a copy of the full attorney roster."""
    return list(ATTORNEYS)


def get_attorney_by_id(attorney_id: str) -> AttorneyProfile | None:
    """Lookup a single attorney by ID. Returns None if not found."""
    for att in ATTORNEYS:
        if att.id == attorney_id:
            return att
    return None


def get_attorneys_by_specialization(area: str) -> list[AttorneyProfile]:
    """Filter attorneys who list the given area in their specializations."""
    return [a for a in ATTORNEYS if area in a.specializations]
