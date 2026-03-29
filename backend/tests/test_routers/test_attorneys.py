import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_get_attorney_by_static_id_returns_profile():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/attorneys/att-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "att-001"
    assert data["name"] == "Dr. Sarah Chen"
    assert "bio" in data
    assert "languages" in data
    assert "free_consultation" in data


@pytest.mark.asyncio
async def test_get_attorney_unknown_id_returns_404():
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/attorneys/att-9999")
    assert resp.status_code == 404
