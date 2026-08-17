import os
import json
import google.generativeai as genai
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from ..models import ocd_models
from . import ai_service

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

class AgentOrchestrator:
    def __init__(self, db: Session, user_id: int):
        self.db = db
        self.user_id = user_id
        self.model = genai.GenerativeModel("gemini-2.5-pro")
        
    def _get_system_prompt(self) -> str:
        return """
You are the NeuroBridge Agentic AI Orchestrator, an intelligent support assistant for neurodivergent individuals (ADHD, OCD, ASD, Dyslexia, etc.).
Your job is to understand the user's intent, provide empathetic but structured support, and trigger the appropriate NeuroBridge tools when needed.
You have access to several specialized tools. If a tool is relevant, invoke it.
Always return your response in the following JSON format ONLY:
{
    "response": "Your natural language response to the user. Empathetic, concise, clear.",
    "action": {
        "type": "NAVIGATE" | "TOOL_EXECUTION" | "NONE",
        "path": "route path if NAVIGATE (e.g. /adhd/breakdown, /ocd/exposure-tracker)",
        "tool_name": "name of the tool if TOOL_EXECUTION",
        "tool_args": { "arg1": "value1" }
    }
}
If no action is needed, set action to null or type to "NONE".

Available tools you can suggest:
- 'breakdown_task': If the user is overwhelmed by a task (ADHD/Executive Function). Args: { "task": "description of the task" }. This tool generates a breakdown and suggests navigating to /adhd/breakdown.
- 'suggest_exposure': If the user needs OCD ERP exposure ideas. Args: { "category": "obsession category" }. This generates ideas and suggests /ocd/exposure-hierarchy.
- 'grounding_exercise': If the user is having high anxiety. Args: {}. Suggests navigating to /anxiety.
- 'social_practice': If the user wants to practice social scenarios (ASD). Args: {}. Suggests navigating to /asd/social-scenarios.
- 'simplify_text': If the user is struggling with reading (Dyslexia). Args: {}. Suggests /dyslexia/adaptive-reading.

Remember: Do NOT diagnose or give medical advice. Keep responses actionable.
        """

    def process_message(self, message: str, context: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Process a user message, determine intent, potentially execute a backend tool,
        and return the response + action payload.
        """
        if not api_key:
            return {
                "response": "I'm sorry, my AI backend is not configured properly (API key missing).",
                "action": None
            }

        prompt = self._get_system_prompt() + f"\n\nUser message: {message}"
        if context:
            prompt += f"\n\nRecent context: {json.dumps(context)}"

        try:
            res = self.model.generate_content(prompt)
            text = res.text.strip()
            if text.startswith("```json"):
                text = text[7:-3].strip()
            elif text.startswith("```"):
                text = text[3:-3].strip()
                
            parsed = json.loads(text)
            
            response_text = parsed.get("response", "I understand.")
            action = parsed.get("action", None)
            
            # Execute backend tool if needed before returning to UI
            if action and action.get("type") == "TOOL_EXECUTION":
                tool_name = action.get("tool_name")
                tool_args = action.get("tool_args", {})
                
                if tool_name == "breakdown_task":
                    # In a real scenario we might save to DB here. For now we will 
                    # just instruct the frontend to navigate to the breakdown tool
                    # with the task text pre-filled.
                    action = {
                        "type": "NAVIGATE",
                        "path": "/adhd/breakdown",
                        "data": { "initialTask": tool_args.get("task", "") }
                    }
                elif tool_name == "suggest_exposure":
                    action = {
                        "type": "NAVIGATE",
                        "path": "/ocd/exposure-hierarchy",
                        "data": { "initialCategory": tool_args.get("category", "") }
                    }
            
            return {
                "response": response_text,
                "action": action
            }

        except Exception as e:
            print(f"AgentOrchestrator error: {e}")
            return {
                "response": "I'm having a little trouble thinking right now. Let's try again in a moment.",
                "action": None
            }
