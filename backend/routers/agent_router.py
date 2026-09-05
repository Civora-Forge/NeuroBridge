from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..auth import get_current_user, CurrentUser
from ..models import agent_models
from ..schemas import agent_schemas
from ..services.agent_service import AgentOrchestrator

router = APIRouter()


def _extract_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip() or None


@router.post("/chat", response_model=agent_schemas.AgentMessageResponse)
def chat_with_agent(
    request: agent_schemas.ChatRequest,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
    authorization: Optional[str] = Header(default=None),
):
    if request.conversation_id:
        conversation = db.query(agent_models.AgentConversation).filter(
            agent_models.AgentConversation.id == request.conversation_id,
            agent_models.AgentConversation.user_id == user.id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = agent_models.AgentConversation(user_id=user.id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    user_msg = agent_models.AgentMessage(
        conversation_id=conversation.id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    db.commit()

    history = db.query(agent_models.AgentMessage).filter(
        agent_models.AgentMessage.conversation_id == conversation.id
    ).order_by(agent_models.AgentMessage.created_at.asc()).limit(10).all()

    history_payload = [{"role": msg.role, "content": msg.content} for msg in history[:-1]]

    orchestrator = AgentOrchestrator(db, user, user_token=_extract_bearer_token(authorization))
    client_context = request.client_context.model_dump(exclude_none=True) if request.client_context else None
    result = orchestrator.process_message(request.message, history_payload, client_context)

    agent_msg = agent_models.AgentMessage(
        conversation_id=conversation.id,
        role="model",
        content=result["response"],
        action_payload=result["action"]
    )
    db.add(agent_msg)
    db.commit()
    db.refresh(agent_msg)

    return agent_msg


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
    outcome = orchestrator.execute_confirmed_tool(request.tool_name, request.tool_args)

    if outcome["status"] == "executed":
        message = "Done."
    elif outcome["status"] == "denied":
        message = outcome.get("error") or "That action isn't available."
    else:
        message = outcome.get("error") or "That action couldn't be completed."

    agent_msg = agent_models.AgentMessage(
        conversation_id=conversation.id,
        role="model",
        content=message,
        action_payload=outcome.get("action"),
    )
    db.add(agent_msg)
    db.commit()

    return agent_schemas.ToolExecuteResponse(
        status=outcome["status"], tool_name=request.tool_name, result=outcome.get("result"), message=message
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
