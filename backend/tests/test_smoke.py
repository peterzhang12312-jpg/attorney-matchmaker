"""Smoke tests -- verify the three most critical flows work end-to-end."""
import pytest


@pytest.mark.asyncio
async def test_health_check(client):
    """Health endpoint should return ok."""
    res = await client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_intake_returns_case_id(client):
    """POST /api/intake should persist a case and return a case_id."""
    res = await client.post("/api/intake", json={
        "description": "I was rear-ended at a red light and injured my neck.",
        "urgency": "medium",
        "client_email": "smoketest@example.com",
    })
    assert res.status_code == 201
    data = res.json()
    assert "case_id" in data
    assert data["status"] == "received"


@pytest.mark.asyncio
async def test_reveal_requires_auth(client):
    """Lead reveal endpoint must reject requests with an invalid token."""
    res = await client.post(
        "/api/attorney/leads/fake-id/reveal",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert res.status_code in (401, 403)
