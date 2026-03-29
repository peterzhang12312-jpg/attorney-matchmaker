"""
Stripe billing service — pay-per-lead model.

Lead prices by practice area (charged at reveal time):
  All practice areas -> $20 flat
"""
from __future__ import annotations

import os
from typing import Optional

import stripe
import structlog

log = structlog.get_logger()

# Lead price tiers in cents — flat $20 across all practice areas
_PRICE_TIERS: dict[str, int] = {
    "personal_injury":       2000,
    "immigration":           2000,
    "criminal_defense":      2000,
    "employment":            2000,
    "employment_employee":   2000,
    "intellectual_property": 2000,
    "corporate":             2000,
    "securities":            2000,
    "real_estate":           2000,
    "family_law":            2000,
    "bankruptcy":            2000,
    "estate_planning":       2000,
    "landlord_tenant":       2000,
    "civil_litigation":      2000,
    "contract_dispute":      2000,
    "tax":                   2000,
}

_DEFAULT_PRICE = 2000  # $20 fallback


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
    {"id": "pack_3",  "credits": 3,  "amount_cents": 5000,  "label": "Starter — 3 credits",  "per_credit": "$16.67"},
    {"id": "pack_8",  "credits": 8,  "amount_cents": 10000, "label": "Value — 8 credits",     "per_credit": "$12.50"},
    {"id": "pack_20", "credits": 20, "amount_cents": 20000, "label": "Pro — 20 credits",      "per_credit": "$10.00"},
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
