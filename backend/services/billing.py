"""
Stripe billing service — pay-per-lead model.

Lead prices by practice area (charged at reveal time):
  PI / Immigration / Criminal Defense  -> $75
  Employment / IP / Corporate          -> $50
  Real Estate / Family / Bankruptcy    -> $35
  Landlord-Tenant / Other              -> $25
"""
from __future__ import annotations

import os
from typing import Optional

import stripe
import structlog

log = structlog.get_logger()

# Lead price tiers in cents
_PRICE_TIERS: dict[str, int] = {
    "personal_injury":       7500,
    "immigration":           7500,
    "criminal_defense":      7500,
    "employment":            5000,
    "employment_employee":   5000,
    "intellectual_property": 5000,
    "corporate":             5000,
    "securities":            5000,
    "real_estate":           3500,
    "family_law":            3500,
    "bankruptcy":            3500,
    "estate_planning":       3500,
    "landlord_tenant":       2500,
    "civil_litigation":      2500,
    "contract_dispute":      2500,
    "tax":                   2500,
}

_DEFAULT_PRICE = 2500  # $25 fallback


def get_lead_price(practice_area: str) -> int:
    """Return price in cents for a lead in the given practice area."""
    return _PRICE_TIERS.get(practice_area.lower(), _DEFAULT_PRICE)


def _client() -> stripe.StripeClient:
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key:
        raise RuntimeError("STRIPE_SECRET_KEY not set")
    return stripe.StripeClient(key)


async def create_payment_intent(
    amount_cents: int,
    lead_id: str,
    attorney_id: str,
    practice_area: str,
) -> str:
    """
    Create a Stripe PaymentIntent and return the client_secret.
    The client_secret is sent to the frontend to confirm payment.
    """
    import asyncio
    import functools

    sc = _client()
    pi = await asyncio.to_thread(
        functools.partial(
            sc.payment_intents.create,
            amount=amount_cents,
            currency="usd",
            metadata={
                "lead_id": lead_id,
                "attorney_id": attorney_id,
                "practice_area": practice_area,
            },
            description=f"Lead reveal: {practice_area} case",
        )
    )
    log.info("payment_intent_created", lead_id=lead_id, amount=amount_cents)
    return pi.client_secret


async def verify_payment_succeeded(payment_intent_id: str) -> bool:
    """
    Synchronously verify that a PaymentIntent status is 'succeeded'.
    Called after the frontend confirms payment to prevent spoofing.
    """
    import asyncio
    import functools

    sc = _client()
    try:
        pi = await asyncio.to_thread(
            functools.partial(sc.payment_intents.retrieve, payment_intent_id)
        )
        return pi.status == "succeeded"
    except Exception as exc:
        log.warning("payment_verify_failed", error=str(exc))
        return False


def verify_webhook_signature(payload: bytes, sig_header: str) -> Optional[dict]:
    """
    Verify Stripe webhook signature and return the parsed event dict.
    Returns None if signature is invalid.
    """
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        log.warning("STRIPE_WEBHOOK_SECRET not set -- skipping signature check")
        import json
        return json.loads(payload)
    try:
        event = stripe.WebhookSignature.verify_header(
            payload.decode(), sig_header, secret
        )
        return event
    except stripe.error.SignatureVerificationError as exc:
        log.warning("stripe_webhook_signature_invalid", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Credit packs
# ---------------------------------------------------------------------------

CREDIT_PACKAGES: list[dict] = [
    {"id": "pack_2",  "credits": 2,  "amount_cents": 10000, "label": "Starter — 2 credits",  "per_credit": "$50"},
    {"id": "pack_5",  "credits": 5,  "amount_cents": 20000, "label": "Value — 5 credits",     "per_credit": "$40"},
    {"id": "pack_15", "credits": 15, "amount_cents": 50000, "label": "Pro — 15 credits",      "per_credit": "$33"},
]

_PACK_INDEX: dict[str, dict] = {p["id"]: p for p in CREDIT_PACKAGES}


def get_credit_package(package_id: str) -> dict | None:
    """Return a credit package dict by id, or None if not found."""
    return _PACK_INDEX.get(package_id)


async def create_credit_purchase_intent(
    package_id: str,
    attorney_id: str,
) -> str:
    """
    Create a Stripe PaymentIntent for a credit pack purchase.
    Returns the client_secret.
    """
    import asyncio
    import functools

    pack = get_credit_package(package_id)
    if not pack:
        raise ValueError(f"Unknown package_id: {package_id}")

    sc = _client()
    pi = await asyncio.to_thread(
        functools.partial(
            sc.payment_intents.create,
            amount=pack["amount_cents"],
            currency="usd",
            metadata={
                "type": "credit_purchase",
                "attorney_id": attorney_id,
                "package_id": package_id,
                "credits": pack["credits"],
            },
            description=f"Credit pack: {pack['label']}",
        )
    )
    log.info("credit_purchase_intent_created", attorney_id=attorney_id, package_id=package_id)
    return pi.client_secret
