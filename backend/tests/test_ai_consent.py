from fastapi import HTTPException

from backend.auth import CurrentUser, require_ai_consent
from backend.services.ai_privacy import minimize_contents


def test_real_account_requires_saved_ai_consent():
    try:
        require_ai_consent(CurrentUser(id="user"))
        assert False, "Expected consent enforcement"
    except HTTPException as error:
        assert error.status_code == 403


def test_demo_requires_explicit_consent_header():
    require_ai_consent(CurrentUser(id="demo:user:session", is_demo=True), "accepted")


def test_proxy_redacts_common_direct_identifiers():
    contents = minimize_contents([{"parts": [{"text": "Email a@b.com, call +91 9876543210, ABHA 12-3456-7890-1234"}]}])
    text = contents[0]["parts"][0]["text"]
    assert "a@b.com" not in text
    assert "9876543210" not in text
    assert "12-3456-7890-1234" not in text
