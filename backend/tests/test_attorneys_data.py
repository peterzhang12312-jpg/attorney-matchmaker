def test_all_static_attorneys_have_bio():
    from data.attorneys import get_all_attorneys
    for a in get_all_attorneys():
        assert a.bio is not None and len(a.bio) > 10, f"{a.name} missing bio"

def test_all_static_attorneys_have_languages():
    from data.attorneys import get_all_attorneys
    for a in get_all_attorneys():
        assert len(a.languages) >= 1, f"{a.name} missing languages"

def test_all_static_attorneys_have_response_time():
    from data.attorneys import get_all_attorneys
    for a in get_all_attorneys():
        assert a.response_time_hours is not None, f"{a.name} missing response_time_hours"
