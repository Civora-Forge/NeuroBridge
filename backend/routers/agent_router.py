import json
import os
import queue
import threading

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db, SessionLocal
from ..auth import get_current_user, CurrentUser
from ..models import agent_models
from ..schemas import agent_schemas
from ..services.agent_service import AgentOrchestrator
from ..services.rate_limiter import SlidingWindowRateLimiter

router = APIRouter()

# Demo mode has no real credential behind it (see auth.py) — 20/hour there guards
# against reading the token format out of the public bundle and burning the
# GEMINI_API_KEY's quota for free. Real accounts are authenticated, but the cost
# exposure is identical per message, so they get a generous, configurable limit too.
_DEMO_RATE_LIMIT_MAX_MESSAGES = 20
_DEMO_RATE_LIMIT_WINDOW_SECONDS = 3600
_REAL_RATE_LIMIT_MAX_MESSAGES = int(os.getenv("AGENT_REAL_RATE_LIMIT_PER_HOUR", "60"))
_REAL_RATE_LIMIT_WINDOW_SECONDS = 3600
_demo_limiter = SlidingWindowRateLimiter(
    _DEMO_RATE_LIMIT_MAX_MESSAGES,
    _DEMO_RATE_LIMIT_WINDOW_SECONDS,
    "Demo mode is limited to a small number of messages per hour. Sign in with a real account for unlimited use, or try again later.",
)
_real_limiter = SlidingWindowRateLimiter(
    _REAL_RATE_LIMIT_MAX_MESSAGES,
    _REAL_RATE_LIMIT_WINDOW_SECONDS,
    "You've sent a lot of messages in a short time — please wait a bit before sending more.",
)
# Back-compat handles for existing tests, which reach into these directly.
_demo_chat_timestamps = _demo_limiter._buckets
_real_chat_timestamps = _real_limiter._buckets


def _enforce_rate_limit(user: CurrentUser) -> None:
    limiter = _demo_limiter if user.is_demo else _real_limiter
    limiter.max_events = _DEMO_RATE_LIMIT_MAX_MESSAGES if user.is_demo else _REAL_RATE_LIMIT_MAX_MESSAGES
    limiter.check(user.id)


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip() or None


def _get_or_create_conversation(db: Session, user: CurrentUser, conversation_id: Optional[int]) -> agent_models.AgentConversation:
    if conversation_id:
        conversation = db.query(agent_models.AgentConversation).filter(
            agent_models.AgentConversation.id == conversation_id,
            agent_models.AgentConversation.user_id == user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        return conversation
    conversation = agent_models.AgentConversation(user_id=user.id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def _recent_history(db: Session, conversation_id: int) -> list[dict]:
    history = db.query(agent_models.AgentMessage).filter(
        agent_models.AgentMessage.conversation_id == conversation_id
    ).order_by(agent_models.AgentMessage.created_at.asc()).limit(10).all()
    return [{"role": msg.role, "content": msg.content} for msg in history[:-1]]


@router.post("/chat", response_model=agent_schemas.AgentChatResponse)
def chat_with_agent(
    request: agent_schemas.ChatRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None),
):
    _enforce_rate_limit(user)

    conversation = _get_or_create_conversation(db, user, request.conversation_id)

    user_msg = agent_models.AgentMessage(conversation_id=conversation.id, role="user", content=request.message)
    db.add(user_msg)
    db.commit()

    history_payload = _recent_history(db, conversation.id)

    orchestrator = AgentOrchestrator(db, user, user_token=_extract_bearer_token(authorization))
    client_context = request.client_context.model_dump(exclude_none=True) if request.client_context else None
    result = orchestrator.process_message(request.message, history_payload, client_context, conversation_id=conversation.id)

    agent_msg = agent_models.AgentMessage(
        conversation_id=conversation.id, role="model", content=result["response"], action_payload=result["action"]
    )
    db.add(agent_msg)
    db.commit()
    db.refresh(agent_msg)

    return agent_schemas.AgentChatResponse(
        id=agent_msg.id, conversation_id=agent_msg.conversation_id, role=agent_msg.role, content=agent_msg.content,
        action_payload=agent_msg.action_payload, created_at=agent_msg.created_at,
        execution_id=result.get("execution_id"), state=result.get("state"),
    )


@router.post("/chat/stream")
def chat_with_agent_stream(
    request: agent_schemas.ChatRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None),
):
    """Server-Sent Events variant of /chat: emits real backend state transitions
    (execution_started, state_changed, tool_started, tool_completed,
    confirmation_required, execution_completed/failed) as they actually happen,
    instead of making the UI wait silently for the whole execution to finish.

    Runs the orchestrator on its own DB session in a background thread — the
    request's injected `db` session is only used here, synchronously, to look up/
    create the conversation and save the final message, never concurrently with
    the background thread's session.
    """
    _enforce_rate_limit(user)
    conversation = _get_or_create_conversation(db, user, request.conversation_id)
    user_msg = agent_models.AgentMessage(conversation_id=conversation.id, role="user", content=request.message)
    db.add(user_msg)
    db.commit()
    history_payload = _recent_history(db, conversation.id)
    client_context = request.client_context.model_dump(exclude_none=True) if request.client_context else None
    user_token = _extract_bearer_token(authorization)
    conversation_id = conversation.id

    event_queue: "queue.Queue" = queue.Queue()

    def on_event(event: dict) -> None:
        # Every event carries conversation_id — without it, the frontend could
        # never learn a newly-created conversation's id from the stream alone,
        # and would start a fresh conversation on every subsequent message.
        event_queue.put({**event, "conversation_id": conversation_id})

    def run() -> None:
        thread_db = SessionLocal()
        try:
            orchestrator = AgentOrchestrator(thread_db, user, user_token=user_token)
            result = orchestrator.process_message(
                request.message, history_payload, client_context, conversation_id=conversation_id, on_event=on_event
            )
            agent_msg = agent_models.AgentMessage(
                conversation_id=conversation_id, role="model", content=result["response"], action_payload=result["action"]
            )
            thread_db.add(agent_msg)
            thread_db.commit()
            final_state = result.get("state")
            event_type = {
                "COMPLETED": "execution_completed",
                "CONFIRMATION_REQUIRED": "confirmation_required",
            }.get(final_state, "execution_failed")
            event_queue.put({
                "type": event_type, "conversation_id": conversation_id,
                "execution_id": result.get("execution_id"), "state": final_state,
                "content": result["response"], "action_payload": result["action"],
            })
        except Exception as e:
            event_queue.put({"type": "execution_failed", "conversation_id": conversation_id, "error": "internal_error"})
            print(f"[agent] stream execution failed: {e}")
        finally:
            thread_db.close()
            event_queue.put(None)

    threading.Thread(target=run, daemon=True).start()

    def event_stream():
        while True:
            item = event_queue.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/tool/execute", response_model=agent_schemas.ToolExecuteResponse)
def execute_tool(
    request: agent_schemas.ToolExecuteRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None),
):
    """Confirms and runs a tool the agent proposed but did not execute
    (risk_level == write_confirm). Re-validates auth/ownership/schema itself —
    never trusts that the frontend correctly gated the click."""
    conversation = db.query(agent_models.AgentConversation).filter(
        agent_models.AgentConversation.id == request.conversation_id,
        agent_models.AgentConversation.user_id == user.id
    ).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    orchestrator = AgentOrchestrator(db, user, user_token=_extract_bearer_token(authorization))
    outcome = orchestrator.execute_confirmed_tool(request.tool_name, request.tool_args, conversation_id=request.conversation_id)

    is_replay = outcome.get("idempotent_replay", False)
    if outcome["status"] == "executed":
        message = "This was already completed." if is_replay else "Done."
    elif outcome["status"] == "denied":
        message = outcome.get("error") or "That action isn't available."
    else:
        message = outcome.get("error") or "That action couldn't be completed."

    if not is_replay:
        agent_msg = agent_models.AgentMessage(
            conversation_id=conversation.id, role="model", content=message, action_payload=outcome.get("action"),
        )
        db.add(agent_msg)
        db.commit()

    return agent_schemas.ToolExecuteResponse(
        status=outcome["status"], tool_name=request.tool_name, result=outcome.get("result"), message=message,
        idempotent_replay=is_replay, action=outcome.get("action"),
    )


@router.get("/conversations", response_model=List[agent_schemas.AgentConversationResponse])
def get_conversations(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return db.query(agent_models.AgentConversation).filter(
        agent_models.AgentConversation.user_id == user.id
    ).order_by(agent_models.AgentConversation.updated_at.desc()).all()

@router.get("/conversations/{conversation_id}", response_model=agent_schemas.AgentConversationResponse)
def get_conversation_history(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    conv = db.query(agent_models.AgentConversation).filter(
        agent_models.AgentConversation.id == conversation_id,
        agent_models.AgentConversation.user_id == user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv
