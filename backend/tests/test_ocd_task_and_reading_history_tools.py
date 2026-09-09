"""
Two genuine agent-operability gaps found by codebase audit:

1. OCD ExposureHierarchyBuilder.jsx has real delete/reorder actions
   (ocd_router.py's DELETE /tasks/{id} and PATCH .../order_index) with no
   agent tool at all. reorder_exposure_task (write_low, reversible) and
   delete_exposure_task (write_confirm, irreversible) close that gap.

2. src/lib/readingFilesService.js's real Supabase-backed reading_files
   table had zero tool coverage — get_reading_history closes it, mirroring
   get_reading_preferences' existing JWT-forwarding pattern exactly.
"""

from unittest.mock import patch

import httpx
import pytest

from backend.database import SessionLocal
from backend.models import ocd_models
from backend.services.agent_tools import (
    ToolContext, ToolError,
    _delete_exposure_task, _reorder_exposure_task, _get_reading_history,
)


def _seed_hierarchy_with_two_tasks(db, user):
    hierarchy = ocd_models.ExposureHierarchy(title="Contamination", category="contamination", owner_id=user.id)
    db.add(hierarchy)
    db.flush()
    t1 = ocd_models.ExposureTask(description="Touch a doorknob", estimated_suds=30, order_index=0, hierarchy_id=hierarchy.id)
    t2 = ocd_models.ExposureTask(description="Shake a hand", estimated_suds=50, order_index=1, hierarchy_id=hierarchy.id)
    db.add_all([t1, t2])
    db.commit()
    db.refresh(t1)
    db.refresh(t2)
    return t1, t2


def test_reorder_exposure_task_changes_the_real_order_index(user_a):
    db = SessionLocal()
    try:
        t1, t2 = _seed_hierarchy_with_two_tasks(db, user_a)
        result = _reorder_exposure_task({"task_id": t2.id, "new_order_index": 0}, ToolContext(db=db, user=user_a))
        db.refresh(t2)
    finally:
        db.close()

    assert result["order_index"] == 0
    assert t2.order_index == 0


def test_reorder_exposure_task_cannot_touch_another_users_task(user_a, user_b):
    db = SessionLocal()
    try:
        t1, _ = _seed_hierarchy_with_two_tasks(db, user_a)
        with pytest.raises(ToolError):
            _reorder_exposure_task({"task_id": t1.id, "new_order_index": 5}, ToolContext(db=db, user=user_b))
        db.refresh(t1)
        assert t1.order_index == 0  # untouched
    finally:
        db.close()


def test_delete_exposure_task_removes_the_real_row(user_a):
    db = SessionLocal()
    try:
        t1, t2 = _seed_hierarchy_with_two_tasks(db, user_a)
        result = _delete_exposure_task({"task_id": t1.id}, ToolContext(db=db, user=user_a))
        remaining = db.query(ocd_models.ExposureTask).filter_by(hierarchy_id=t1.hierarchy_id).all()
    finally:
        db.close()

    assert result["deleted_task_id"] == t1.id
    assert len(remaining) == 1
    assert remaining[0].id == t2.id


def test_delete_exposure_task_cannot_touch_another_users_task(user_a, user_b):
    db = SessionLocal()
    try:
        t1, _ = _seed_hierarchy_with_two_tasks(db, user_a)
        with pytest.raises(ToolError):
            _delete_exposure_task({"task_id": t1.id}, ToolContext(db=db, user=user_b))
        still_there = db.query(ocd_models.ExposureTask).filter_by(id=t1.id).first()
        assert still_there is not None
    finally:
        db.close()


def test_delete_exposure_task_is_registered_as_write_confirm_not_auto_executed():
    from backend.services.agent_tools import TOOL_REGISTRY, RiskLevel
    assert TOOL_REGISTRY["delete_exposure_task"].risk_level == RiskLevel.WRITE_CONFIRM


def test_reorder_exposure_task_is_registered_as_write_low():
    from backend.services.agent_tools import TOOL_REGISTRY, RiskLevel
    assert TOOL_REGISTRY["reorder_exposure_task"].risk_level == RiskLevel.WRITE_LOW


def test_delete_via_the_real_confirmation_flow_end_to_end(login_as, user_a, install_fake_gemini):
    """The full request -> PENDING_CONFIRMATION -> confirm -> real delete chain,
    through the real HTTP endpoints, exactly as the frontend would call them."""
    db = SessionLocal()
    try:
        t1, t2 = _seed_hierarchy_with_two_tasks(db, user_a)
        task_id = t1.id
    finally:
        db.close()

    from backend.tests.conftest import FakeFunctionCall, FakePart, FakeResponse

    tool_call = FakeResponse(parts=[FakePart(function_call=FakeFunctionCall("delete_exposure_task", {"task_id": task_id}))])
    install_fake_gemini([tool_call])

    client = login_as(user_a)
    chat_response = client.post("/api/agent/chat", json={"message": "remove the doorknob exposure"})

    assert chat_response.status_code == 200
    body = chat_response.json()
    assert body["action_payload"]["type"] == "PENDING_CONFIRMATION"
    assert body["action_payload"]["tool_name"] == "delete_exposure_task"

    db = SessionLocal()
    try:
        still_there = db.query(ocd_models.ExposureTask).filter_by(id=task_id).first()
        assert still_there is not None  # not deleted yet
    finally:
        db.close()

    execute_response = client.post(
        "/api/agent/tool/execute",
        json={
            "conversation_id": body["conversation_id"],
            "tool_name": "delete_exposure_task",
            "tool_args": {"task_id": task_id},
        },
    )
    assert execute_response.status_code == 200
    assert execute_response.json()["status"] == "executed"

    db = SessionLocal()
    try:
        gone = db.query(ocd_models.ExposureTask).filter_by(id=task_id).first()
        assert gone is None
    finally:
        db.close()


def test_get_reading_history_returns_real_supabase_rows(user_a):
    class FakeResponse:
        status_code = 200
        def raise_for_status(self):
            pass
        def json(self):
            return [
                {"file_name": "chapter3.pdf", "file_type": "pdf", "page_count": 12, "ocr_status": "completed",
                 "metadata": {"progress": 0.4}, "created_at": "2026-09-01T00:00:00Z"},
            ]

    with patch("backend.services.agent_tools.httpx.get", return_value=FakeResponse()), \
         patch.dict("os.environ", {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_ANON_KEY": "anon"}):
        result = _get_reading_history({}, ToolContext(db=None, user=user_a, user_token="real-jwt"))

    assert result["available"] is True
    assert result["recent_files"][0]["file_name"] == "chapter3.pdf"
    assert result["recent_files"][0]["progress"] == 0.4


def test_get_reading_history_handles_no_token_gracefully(user_a):
    result = _get_reading_history({}, ToolContext(db=None, user=user_a, user_token=None))
    assert result["available"] is False


def test_get_reading_history_handles_supabase_failure_gracefully(user_a):
    with patch("backend.services.agent_tools.httpx.get", side_effect=httpx.ConnectError("boom")), \
         patch.dict("os.environ", {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_ANON_KEY": "anon"}):
        result = _get_reading_history({}, ToolContext(db=None, user=user_a, user_token="real-jwt"))
    assert result["available"] is False
