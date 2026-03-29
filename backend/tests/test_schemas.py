def test_attorney_profile_accepts_new_fields():
    from models.schemas import AttorneyProfile, Availability
    a = AttorneyProfile(
        id="att-test",
        name="Test Attorney",
        bar_number="NY-000001",
        firm="Test Firm",
        jurisdictions=["NY"],
        specializations=["employment"],
        years_experience=5,
        win_rate=0.75,
        availability=Availability.AVAILABLE,
        bio="Experienced employment attorney.",
        languages=["English", "Spanish"],
        free_consultation=True,
        photo_url="https://example.com/photo.jpg",
        response_time_hours=24,
    )
    assert a.bio == "Experienced employment attorney."
    assert a.languages == ["English", "Spanish"]
    assert a.free_consultation is True
    assert a.photo_url == "https://example.com/photo.jpg"
    assert a.response_time_hours == 24

def test_attorney_profile_new_fields_default_to_none_or_empty():
    from models.schemas import AttorneyProfile, Availability
    a = AttorneyProfile(
        id="att-test",
        name="Test Attorney",
        bar_number="NY-000001",
        firm="Test Firm",
        jurisdictions=["NY"],
        specializations=["employment"],
        years_experience=5,
        win_rate=0.75,
        availability=Availability.AVAILABLE,
    )
    assert a.bio is None
    assert a.languages == []
    assert a.free_consultation is False
    assert a.photo_url is None
    assert a.response_time_hours is None
