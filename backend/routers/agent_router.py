from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import agent_models
from ..schemas import agent_schemas
from ..services.agent_service import AgentOrchestrator

router = APIRouter()

@router.post("/chat", response_model=agent_schemas.AgentMessageResponse)
def chat_with_agent(request: agent_schemas.ChatRequest, db: Session = Depends(get_db)):
    # Default user_id = 1 for now (to match ocd_router mock auth)
    user_id = 1
    
    # Get or create conversation
    if request.conversation_id:
        conversation = db.query(agent_models.AgentConversation).filter(
            agent_models.AgentConversation.id == request.conversation_id,
            agent_models.AgentConversation.user_id == user_id
        ).first()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conversation = agent_models.AgentConversation(user_id=user_id)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

    # Save user message
    user_msg = agent_models.AgentMessage(
        conversation_id=conversation.id,
        role="user",
        content=request.message
    )
    db.add(user_msg)
    db.commit()

    # Get recent context (last 10 messages)
    history = db.query(agent_models.AgentMessage).filter(
        agent_models.AgentMessage.conversation_id == conversation.id
    ).order_by(agent_models.AgentMessage.created_at.asc()).limit(10).all()
    
    context = [{"role": msg.role, "content": msg.content} for msg in history[:-1]] # exclude the one we just added

    # Orchestrate
    orchestrator = AgentOrchestrator(db, user_id)
    result = orchestrator.process_message(request.message, context)

    # Save agent message
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

@router.get("/conversations", response_model=List[agent_schemas.AgentConversationResponse])
def get_conversations(db: Session = Depends(get_db)):
    user_id = 1
    return db.query(agent_models.AgentConversation).filter(
        agent_models.AgentConversation.user_id == user_id
    ).order_by(agent_models.AgentConversation.updated_at.desc()).all()

@router.get("/conversations/{conversation_id}", response_model=agent_schemas.AgentConversationResponse)
def get_conversation_history(conversation_id: int, db: Session = Depends(get_db)):
    user_id = 1
    conv = db.query(agent_models.AgentConversation).filter(
        agent_models.AgentConversation.id == conversation_id,
        agent_models.AgentConversation.user_id == user_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv
