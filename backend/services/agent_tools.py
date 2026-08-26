import json
from sqlalchemy.orm import Session
from ..models import adhd_models, anxiety_models, asd_models, agent_models, ocd_models

def tool_create_task_breakdown(task: str, user_id: int, db: Session, genai_model) -> dict:
    prompt = f"Break down the following task into 3-5 small, manageable steps for someone with ADHD. Return a JSON array of objects with 'description' and 'estimated_minutes'. Task: {task}"
    response = genai_model.generate_content(prompt)
    text = response.text.strip()
    if text.startswith("```json"): text = text[7:-3]
    elif text.startswith("```"): text = text[3:-3]
    
    try:
        steps_data = json.loads(text)
    except json.JSONDecodeError:
        steps_data = [{"description": "Start the task", "estimated_minutes": 5}]
        
    breakdown = adhd_models.TaskBreakdown(user_id=user_id, original_task=task)
    db.add(breakdown)
    db.flush()
    
    saved_steps = []
    for step in steps_data:
        db_step = adhd_models.TaskStep(
            breakdown_id=breakdown.id,
            description=step.get("description", "Step"),
            estimated_minutes=step.get("estimated_minutes", 5)
        )
        db.add(db_step)
        saved_steps.append(db_step)
        
    db.commit()
    return {
        "id": breakdown.id,
        "original_task": breakdown.original_task,
        "steps": [{"id": s.id, "description": s.description, "estimated_minutes": s.estimated_minutes, "is_completed": False} for s in saved_steps]
    }

def tool_create_focus_session(intent: str, duration_minutes: int, user_id: int, db: Session) -> dict:
    session = adhd_models.FocusSession(user_id=user_id, intent=intent, duration_minutes=duration_minutes)
    db.add(session)
    db.commit()
    
    # Save a learning preference if they explicitly requested a length
    if duration_minutes:
        learning = agent_models.AgentLearning(user_id=user_id, category="focus_preference", key="preferred_duration", value=str(duration_minutes))
        db.add(learning)
        db.commit()
        
    return {
        "id": session.id,
        "intent": session.intent,
        "duration_minutes": session.duration_minutes,
        "status": session.status
    }

def tool_suggest_grounding(anxiety_level: int, user_id: int, db: Session) -> dict:
    exercise = "5-4-3-2-1 Senses" if anxiety_level > 7 else "Box Breathing"
    session = anxiety_models.GroundingSession(user_id=user_id, exercise_type=exercise)
    db.add(session)
    db.commit()
    return {
        "id": session.id,
        "exercise_type": session.exercise_type
    }

def get_user_learnings(user_id: int, db: Session) -> dict:
    learnings = db.query(agent_models.AgentLearning).filter(agent_models.AgentLearning.user_id == user_id).all()
    result = {}
    for l in learnings:
        result[l.key] = l.value
    return result
