def test_all_practice_areas_cost_twenty_dollars():
    from services.billing import get_lead_price, _PRICE_TIERS
    for area in _PRICE_TIERS:
        assert get_lead_price(area) == 2000, f"{area} should cost $20 (2000 cents)"

def test_unknown_practice_area_costs_twenty_dollars():
    from services.billing import get_lead_price
    assert get_lead_price("unknown_area") == 2000

def test_credit_pack_starter_is_three_credits_fifty_dollars():
    from services.billing import CREDIT_PACKAGES
    starter = next(p for p in CREDIT_PACKAGES if p["id"] == "pack_3")
    assert starter["credits"] == 3
    assert starter["amount_cents"] == 5000

def test_credit_pack_value_is_eight_credits_hundred_dollars():
    from services.billing import CREDIT_PACKAGES
    value = next(p for p in CREDIT_PACKAGES if p["id"] == "pack_8")
    assert value["credits"] == 8
    assert value["amount_cents"] == 10000

def test_credit_pack_pro_is_twenty_credits_two_hundred_dollars():
    from services.billing import CREDIT_PACKAGES
    pro = next(p for p in CREDIT_PACKAGES if p["id"] == "pack_20")
    assert pro["credits"] == 20
    assert pro["amount_cents"] == 20000
