"""Cross-user data isolation for the (previously unfiltered!) OCD endpoints,
plus ownership checks inside the agent tool handlers themselves."""

import pytest

from backend.database import SessionLocal
from backend.services import agent_tools
from backend.services.agent_tools import ToolContext, ToolError


def test_user_cannot_see_another_users_hierarchies(login_as, user_a, user_b):
    client_a = login_as(user_a)
    client_a.post("/api/ocd/hierarchies/", json={"title": "Contamination", "category": "contamination"})

    client_b = login_as(user_b)
    response = client_b.get("/api/ocd/hierarchies/")
    assert response.status_code == 200
    assert response.json() == []


def test_user_sees_only_their_own_hierarchies(login_as, user_a, user_b):
    # `login_as` swaps a single app-global dependency override, so it must be
    # re-applied immediately before each call — a stale client reference would
    # silently run as whichever user was logged in most recently.
    login_as(user_a).post("/api/ocd/hierarchies/", json={"title": "Contamination", "category": "contamination"})
    login_as(user_b).post("/api/ocd/hierarchies/", json={"title": "Symmetry", "category": "symmetry"})

    response = login_as(user_a).get("/api/ocd/hierarchies/")
    titles = [h["title"] for h in response.json()]
    assert titles == ["Contamination"]


def test_record_suds_rejects_session_owned_by_another_user(user_a, user_b):
    db = SessionLocal()
    try:
        ctx_a = ToolContext(db=db, user=user_a)
        session = agent_tools._start_erp_session({"exposure_description": "Touch doorknob", "pre_suds": 60}, ctx_a)

        ctx_b = ToolContext(db=db, user=user_b)
        with pytest.raises(ToolError):
            agent_tools._record_suds({"session_id": session["session_id"], "value": 40}, ctx_b)
    finally:
        db.close()


def test_complete_erp_session_rejects_session_owned_by_another_user(user_a, user_b):
    db = SessionLocal()
    try:
        ctx_a = ToolContext(db=db, user=user_a)
        session = agent_tools._start_erp_session({"exposure_description": "Touch doorknob", "pre_suds": 60}, ctx_a)

        ctx_b = ToolContext(db=db, user=user_b)
        with pytest.raises(ToolError):
            agent_tools._complete_erp_session({"session_id": session["session_id"], "post_suds": 20}, ctx_b)
    finally:
        db.close()


def test_get_ocd_progress_only_counts_own_data(user_a, user_b):
    db = SessionLocal()
    try:
        ctx_a = ToolContext(db=db, user=user_a)
        agent_tools._create_exposure({"description": "Touch doorknob", "category": "contamination"}, ctx_a)

        ctx_b = ToolContext(db=db, user=user_b)
        progress_b = agent_tools._get_ocd_progress({}, ctx_b)
        assert progress_b["hierarchy_count"] == 0

        progress_a = agent_tools._get_ocd_progress({}, ctx_a)
        assert progress_a["hierarchy_count"] == 1
    finally:
        db.close()
