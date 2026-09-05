"""
The agent's tool registry.

Every capability the agent can actually invoke is declared here as a `Tool`:
a name, a description (fed to Gemini), a JSON-schema parameter spec (fed to
Gemini as a function declaration), a risk level that drives the confirmation
policy, and a handler that does the real, ownership-checked database work.

This is the single source of truth — the Gemini tool declarations are
generated from this registry (see `build_gemini_tool_declarations`), so the
prompt and the actual executable surface can never drift apart.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional

import httpx
from sqlalchemy.orm import Session

from ..auth import CurrentUser
from ..models import adhd_models, agent_models, anxiety_models, ocd_models
from . import ai_service
from .navigation import FEATURE_ROUTES, resolve_feature_route


class RiskLevel(str, Enum):
    READ = "read"  # always executes immediately
    WRITE_LOW = "write_low"  # executes immediately (low-stakes / reversible / continuation of an in-flight flow)
    WRITE_CONFIRM = "write_confirm"  # backend proposes; requires an explicit user confirmation to actually run


@dataclass
class ToolContext:
    db: Session
    user: CurrentUser
    user_token: Optional[str] = None  # raw bearer token, only forwarded to tools that need it (e.g. dyslexia)
    genai_model: Any = None  # lazily-supplied Gemini model handle for tools that need a sub-generation


@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    risk_level: RiskLevel
    handler: Callable[[dict, ToolContext], dict]


class ToolError(Exception):
    """Raised by a handler for a user-facing, non-fatal failure (e.g. not found)."""


# ---------------------------------------------------------------------------
# OCD tools — backed by the real ocd_models tables
# ---------------------------------------------------------------------------

def _get_ocd_progress(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    hierarchies = db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user.id).all()
    sessions = (
        db.query(ocd_models.ERPSession)
        .filter_by(owner_id=user.id, status="completed")
        .order_by(ocd_models.ERPSession.created_at.desc())
        .limit(20)
        .all()
    )
    total_tasks = sum(len(h.tasks) for h in hierarchies)
    completed_tasks = sum(1 for h in hierarchies for t in h.tasks if t.is_completed)
    suds_drops = [s.pre_suds - s.post_suds for s in sessions if s.post_suds is not None]
    avg_drop = round(sum(suds_drops) / len(suds_drops), 1) if suds_drops else None
    resisted_count = sum(1 for s in sessions if s.resisted_compulsion)

    return {
        "hierarchy_count": len(hierarchies),
        "total_exposure_tasks": total_tasks,
        "completed_exposure_tasks": completed_tasks,
        "completed_erp_sessions": len(sessions),
        "average_suds_reduction": avg_drop,
        "sessions_with_resisted_compulsion": resisted_count,
        "most_recent_session_at": sessions[0].created_at.isoformat() if sessions else None,
    }


def _get_exposure_hierarchy(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    title = (args.get("hierarchy_title") or "").strip()
    query = db.query(ocd_models.ExposureHierarchy).filter_by(owner_id=user.id)
    hierarchy = (
        query.filter(ocd_models.ExposureHierarchy.title.ilike(f"%{title}%")).first()
        if title
        else query.order_by(ocd_models.ExposureHierarchy.created_at.desc()).first()
    )
    if not hierarchy:
        raise ToolError("No exposure hierarchy found. You may need to create one first.")

    tasks = sorted(hierarchy.tasks, key=lambda t: t.order_index)
    return {
        "id": hierarchy.id,
        "title": hierarchy.title,
        "category": hierarchy.category,
        "tasks": [
            {"id": t.id, "description": t.description, "estimated_suds": t.estimated_suds, "is_completed": t.is_completed}
            for t in tasks
        ],
    }


def _create_exposure(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    description = (args.get("description") or "").strip()
    category = (args.get("category") or "general").strip()
    estimated_suds = int(args.get("estimated_suds") or 50)
    hierarchy_title = (args.get("hierarchy_title") or category.title()).strip()

    if not description:
        raise ToolError("An exposure description is required.")

    hierarchy = (
        db.query(ocd_models.ExposureHierarchy)
        .filter_by(owner_id=user.id)
        .filter(ocd_models.ExposureHierarchy.title.ilike(hierarchy_title))
        .first()
    )
    if not hierarchy:
        hierarchy = ocd_models.ExposureHierarchy(title=hierarchy_title, category=category, owner_id=user.id)
        db.add(hierarchy)
        db.flush()

    next_index = len(hierarchy.tasks)
    task = ocd_models.ExposureTask(
        description=description,
        estimated_suds=estimated_suds,
        order_index=next_index,
        hierarchy_id=hierarchy.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "hierarchy_id": hierarchy.id,
        "hierarchy_title": hierarchy.title,
        "task_id": task.id,
        "description": task.description,
        "estimated_suds": task.estimated_suds,
    }


def _start_erp_session(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    description = (args.get("exposure_description") or "").strip()
    pre_suds = args.get("pre_suds")
    if not description or pre_suds is None:
        raise ToolError("An exposure description and a starting SUDS (0-100) are required.")

    session = ocd_models.ERPSession(
        title=description,
        pre_suds=int(pre_suds),
        status="in_progress",
        owner_id=user.id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {"session_id": session.id, "title": session.title, "pre_suds": session.pre_suds, "status": session.status}


def _record_suds(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    session_id = args.get("session_id")
    value = args.get("value")
    if value is None:
        raise ToolError("A SUDS value (0-100) is required.")

    if session_id is not None:
        session = db.query(ocd_models.ERPSession).filter_by(id=session_id, owner_id=user.id).first()
        if not session:
            raise ToolError("That ERP session wasn't found.")

    log = ocd_models.SUDSLog(
        value=int(value),
        context_tag=args.get("context_tag"),
        session_id=session_id,
        owner_id=user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"log_id": log.id, "value": log.value, "session_id": log.session_id}


def _complete_erp_session(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    session_id = args.get("session_id")
    session = db.query(ocd_models.ERPSession).filter_by(id=session_id, owner_id=user.id).first()
    if not session:
        raise ToolError("That ERP session wasn't found.")

    post_suds = args.get("post_suds")
    if post_suds is None:
        raise ToolError("An ending SUDS value (0-100) is required to complete the session.")

    session.post_suds = int(post_suds)
    session.resisted_compulsion = bool(args.get("resisted_compulsion", False))
    session.notes = args.get("notes")
    session.status = "completed"
    session.completed_at = datetime.utcnow()
    session.duration_seconds = int((session.completed_at - session.created_at).total_seconds())
    session.ai_summary = ai_service.summarize_erp_session(
        session.pre_suds, session.post_suds, session.duration_seconds, session.resisted_compulsion, session.notes or ""
    )
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "pre_suds": session.pre_suds,
        "post_suds": session.post_suds,
        "resisted_compulsion": session.resisted_compulsion,
        "ai_summary": session.ai_summary,
    }


# ---------------------------------------------------------------------------
# ADHD tools — backed by adhd_models
# ---------------------------------------------------------------------------

def _get_recent_tasks(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    breakdowns = (
        db.query(adhd_models.TaskBreakdown)
        .filter_by(user_id=user.id)
        .order_by(adhd_models.TaskBreakdown.created_at.desc())
        .limit(5)
        .all()
    )
    sessions = (
        db.query(adhd_models.FocusSession)
        .filter_by(user_id=user.id)
        .order_by(adhd_models.FocusSession.created_at.desc())
        .limit(5)
        .all()
    )
    return {
        "recent_task_breakdowns": [
            {"id": b.id, "original_task": b.original_task, "step_count": len(b.steps)} for b in breakdowns
        ],
        "recent_focus_sessions": [
            {"id": s.id, "intent": s.intent, "duration_minutes": s.duration_minutes, "status": s.status}
            for s in sessions
        ],
    }


def _create_task_breakdown(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    task = (args.get("task") or "").strip()
    if not task:
        raise ToolError("A task description is required.")

    steps_data = None
    if ctx.genai_model is not None:
        prompt = (
            "Break down the following task into 3-5 small, manageable steps for someone with ADHD. "
            "Return ONLY a JSON array of objects with 'description' and 'estimated_minutes'. "
            f"Task: {task}"
        )
        try:
            response = ctx.genai_model.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```json"):
                text = text[7:-3]
            elif text.startswith("```"):
                text = text[3:-3]
            steps_data = json.loads(text)
        except Exception:
            steps_data = None

    if not steps_data:
        steps_data = [{"description": "Start with the smallest possible first step", "estimated_minutes": 5}]

    breakdown = adhd_models.TaskBreakdown(user_id=user.id, original_task=task)
    db.add(breakdown)
    db.flush()

    saved_steps = []
    for step in steps_data:
        db_step = adhd_models.TaskStep(
            breakdown_id=breakdown.id,
            description=step.get("description", "Step"),
            estimated_minutes=int(step.get("estimated_minutes", 5)),
        )
        db.add(db_step)
        saved_steps.append(db_step)
    db.commit()

    return {
        "id": breakdown.id,
        "original_task": breakdown.original_task,
        "steps": [
            {"id": s.id, "description": s.description, "estimated_minutes": s.estimated_minutes, "is_completed": False}
            for s in saved_steps
        ],
    }


def _start_focus_session(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    duration_minutes = int(args.get("duration_minutes") or 25)
    intent = args.get("intent")

    session = adhd_models.FocusSession(user_id=user.id, intent=intent, duration_minutes=duration_minutes)
    db.add(session)
    db.commit()

    if duration_minutes:
        db.add(
            agent_models.AgentLearning(
                user_id=user.id, category="focus_preference", key="preferred_duration", value=str(duration_minutes)
            )
        )
        db.commit()

    return {"id": session.id, "intent": session.intent, "duration_minutes": session.duration_minutes, "status": session.status}


# ---------------------------------------------------------------------------
# Anxiety tools — backed by anxiety_models
# ---------------------------------------------------------------------------

def _get_anxiety_history(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    sessions = (
        db.query(anxiety_models.GroundingSession)
        .filter_by(user_id=user.id)
        .order_by(anxiety_models.GroundingSession.created_at.desc())
        .limit(10)
        .all()
    )
    return {
        "recent_grounding_sessions": [
            {
                "id": s.id,
                "exercise_type": s.exercise_type,
                "pre_anxiety": s.pre_anxiety,
                "post_anxiety": s.post_anxiety,
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions
        ]
    }


def _start_grounding_activity(args: dict, ctx: ToolContext) -> dict:
    db, user = ctx.db, ctx.user
    anxiety_level = int(args.get("anxiety_level") or 5)
    exercise = "5-4-3-2-1 Senses" if anxiety_level > 7 else "Box Breathing"

    session = anxiety_models.GroundingSession(user_id=user.id, exercise_type=exercise, pre_anxiety=anxiety_level)
    db.add(session)
    db.commit()
    db.refresh(session)

    return {"id": session.id, "exercise_type": session.exercise_type}


# ---------------------------------------------------------------------------
# Dyslexia — the one module that's genuinely Supabase-backed. We forward the
# user's own JWT to Supabase's REST API so existing RLS policies enforce
# ownership; the backend never needs a service-role key for this.
# ---------------------------------------------------------------------------

def _get_reading_preferences(args: dict, ctx: ToolContext) -> dict:
    import os

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not supabase_url or not anon_key or not ctx.user_token:
        return {"available": False, "reason": "Reading preferences aren't available right now."}

    try:
        response = httpx.get(
            f"{supabase_url}/rest/v1/reader_preferences",
            headers={
                "Authorization": f"Bearer {ctx.user_token}",
                "apikey": anon_key,
            },
            params={"select": "*", "limit": "1"},
            timeout=5.0,
        )
        response.raise_for_status()
        rows = response.json()
    except Exception:
        return {"available": False, "reason": "Couldn't reach reading preferences right now."}

    if not rows:
        return {"available": True, "has_preferences": False}

    return {"available": True, "has_preferences": True, "preferences": rows[0]}


# ---------------------------------------------------------------------------
# ASD — backend has no real data store for this yet (see plan). Honest,
# navigation-only tool: it does not claim to create/fetch anything server-side.
# ---------------------------------------------------------------------------

def _start_social_scenario(args: dict, ctx: ToolContext) -> dict:
    return {"path": FEATURE_ROUTES["asd_social_scenarios"], "context_hint": args.get("scenario_context")}


# ---------------------------------------------------------------------------
# Cross-cutting
# ---------------------------------------------------------------------------

def _navigate_to_feature(args: dict, ctx: ToolContext) -> dict:
    feature = args.get("feature")
    path = resolve_feature_route(feature)
    if not path:
        raise ToolError(f"Unknown feature '{feature}'.")
    return {"path": path}


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

def _schema(properties: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": properties, "required": required or []}


TOOL_REGISTRY: dict[str, Tool] = {
    "get_ocd_progress": Tool(
        name="get_ocd_progress",
        description="Retrieve the user's real OCD/ERP progress summary: hierarchy count, completed exposures, average SUDS reduction.",
        parameters=_schema({}),
        risk_level=RiskLevel.READ,
        handler=_get_ocd_progress,
    ),
    "get_exposure_hierarchy": Tool(
        name="get_exposure_hierarchy",
        description="Retrieve the user's exposure hierarchy (a list of exposure tasks) — optionally filtered by title.",
        parameters=_schema({"hierarchy_title": {"type": "string", "description": "Optional partial title to search for."}}),
        risk_level=RiskLevel.READ,
        handler=_get_exposure_hierarchy,
    ),
    "create_exposure": Tool(
        name="create_exposure",
        description="Add a new exposure task to (or create) an exposure hierarchy for ERP practice.",
        parameters=_schema(
            {
                "description": {"type": "string", "description": "The exposure itself, e.g. 'Touch a door handle'."},
                "category": {"type": "string", "description": "OCD category, e.g. 'contamination'."},
                "estimated_suds": {"type": "integer", "description": "Expected distress 0-100."},
                "hierarchy_title": {"type": "string", "description": "Which hierarchy to add it to (created if new)."},
            },
            required=["description"],
        ),
        risk_level=RiskLevel.WRITE_CONFIRM,
        handler=_create_exposure,
    ),
    "start_erp_session": Tool(
        name="start_erp_session",
        description="Start a real ERP exposure session for the user, recording their starting SUDS level.",
        parameters=_schema(
            {
                "exposure_description": {"type": "string"},
                "pre_suds": {"type": "integer", "description": "Starting distress 0-100."},
            },
            required=["exposure_description", "pre_suds"],
        ),
        risk_level=RiskLevel.WRITE_LOW,
        handler=_start_erp_session,
    ),
    "record_suds": Tool(
        name="record_suds",
        description="Record a SUDS (distress) reading, optionally tied to an in-progress ERP session.",
        parameters=_schema(
            {
                "session_id": {"type": "integer", "description": "The ERP session this reading belongs to, if any."},
                "value": {"type": "integer", "description": "Distress 0-100."},
                "context_tag": {"type": "string"},
            },
            required=["value"],
        ),
        risk_level=RiskLevel.WRITE_LOW,
        handler=_record_suds,
    ),
    "complete_erp_session": Tool(
        name="complete_erp_session",
        description="Complete an in-progress ERP session with the ending SUDS level and outcome.",
        parameters=_schema(
            {
                "session_id": {"type": "integer"},
                "post_suds": {"type": "integer", "description": "Ending distress 0-100."},
                "resisted_compulsion": {"type": "boolean"},
                "notes": {"type": "string"},
            },
            required=["session_id", "post_suds"],
        ),
        # Unlike start_erp_session/record_suds (low-stakes, easily-corrected data points),
        # completing finalizes a clinical record — status, an AI-generated summary, and a
        # resisted_compulsion outcome all become permanent. Confirm before writing it.
        risk_level=RiskLevel.WRITE_CONFIRM,
        handler=_complete_erp_session,
    ),
    "get_recent_tasks": Tool(
        name="get_recent_tasks",
        description="Retrieve the user's recent ADHD task breakdowns and focus sessions.",
        parameters=_schema({}),
        risk_level=RiskLevel.READ,
        handler=_get_recent_tasks,
    ),
    "create_task_breakdown": Tool(
        name="create_task_breakdown",
        description="Break a task down into small manageable steps and save it for the user.",
        parameters=_schema({"task": {"type": "string", "description": "The task to break down."}}, required=["task"]),
        risk_level=RiskLevel.WRITE_CONFIRM,
        handler=_create_task_breakdown,
    ),
    "start_focus_session": Tool(
        name="start_focus_session",
        description="Start a real focus/Pomodoro-style session for the user.",
        parameters=_schema(
            {
                "intent": {"type": "string", "description": "What the user intends to focus on."},
                "duration_minutes": {"type": "integer"},
            }
        ),
        risk_level=RiskLevel.WRITE_LOW,
        handler=_start_focus_session,
    ),
    "get_anxiety_history": Tool(
        name="get_anxiety_history",
        description="Retrieve the user's recent grounding/anxiety session history.",
        parameters=_schema({}),
        risk_level=RiskLevel.READ,
        handler=_get_anxiety_history,
    ),
    "start_grounding_activity": Tool(
        name="start_grounding_activity",
        description="Start a real grounding exercise session appropriate to the user's anxiety level.",
        parameters=_schema({"anxiety_level": {"type": "integer", "description": "Self-reported anxiety 0-10."}}),
        risk_level=RiskLevel.WRITE_LOW,
        handler=_start_grounding_activity,
    ),
    "get_reading_preferences": Tool(
        name="get_reading_preferences",
        description="Retrieve the user's saved dyslexia reading preferences/accessibility settings, if any.",
        parameters=_schema({}),
        risk_level=RiskLevel.READ,
        handler=_get_reading_preferences,
    ),
    "start_social_scenario": Tool(
        name="start_social_scenario",
        description="Send the user into the ASD social scenario practice tool for a given situation.",
        parameters=_schema({"scenario_context": {"type": "string", "description": "Brief description of the upcoming social situation."}}),
        risk_level=RiskLevel.READ,
        handler=_start_social_scenario,
    ),
    "navigate_to_feature": Tool(
        name="navigate_to_feature",
        description=(
            "Navigate the user to a known NeuroBridge screen. `feature` must be one of: "
            + ", ".join(sorted(FEATURE_ROUTES.keys()))
        ),
        parameters=_schema({"feature": {"type": "string", "enum": sorted(FEATURE_ROUTES.keys())}}, required=["feature"]),
        risk_level=RiskLevel.READ,
        handler=_navigate_to_feature,
    ),
}


def build_gemini_tool_declarations() -> list[dict]:
    return [
        {
            "function_declarations": [
                {"name": tool.name, "description": tool.description, "parameters": tool.parameters}
                for tool in TOOL_REGISTRY.values()
            ]
        }
    ]


def get_user_learnings(user_id: str, db: Session) -> dict:
    learnings = db.query(agent_models.AgentLearning).filter(agent_models.AgentLearning.user_id == user_id).all()
    return {l.key: l.value for l in learnings}
