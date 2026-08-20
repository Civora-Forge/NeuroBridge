import os
import json
import google.generativeai as genai
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from . import agent_tools

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
        # Retrieve user learnings/preferences for context
        learnings = agent_tools.get_user_learnings(self.user_id, self.db)
        learning_str = json.dumps(learnings) if learnings else "None yet."

        return f"""
You are the NeuroBridge Agentic AI Orchestrator, an intelligent support assistant for neurodivergent individuals.
Your job is to understand the user's intent, plan a workflow, execute backend tools, and return the result.

USER PREFERENCES & LEARNINGS:
{learning_str}
(Use this context to personalize your recommendations. E.g., if they prefer 15m focus sessions, suggest that).

AVAILABLE TOOLS:
- 'breakdown_task': Splits a large task. Args: {{ "task": "description" }}
- 'create_focus_session': Creates a focus session in the database. Args: {{ "intent": "what to focus on", "duration_minutes": 15 }}
- 'suggest_grounding': Creates an anxiety grounding session. Args: {{ "anxiety_level": 1-10 }}

You must return your response in the following JSON format ONLY:
{{
    "response": "Your natural language response to the user. Explain what action you just took.",
    "action": {{
        "type": "NAVIGATE" | "TOOL_EXECUTION" | "NONE",
        "tool_name": "name of the tool to execute right now",
        "tool_args": {{ "arg1": "value" }}
    }}
}}
If you trigger a TOOL_EXECUTION, the backend will execute it and send the resulting data to the frontend so the user can see it immediately.
If no action is needed, set type to "NONE".
        """

    def process_message(self, message: str, context: List[Dict[str, str]] = None) -> Dict[str, Any]:
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
            
            # Real Tool Execution on the backend
            if action and action.get("type") == "TOOL_EXECUTION":
                tool_name = action.get("tool_name")
                tool_args = action.get("tool_args", {})
                
                if tool_name == "breakdown_task":
                    result_data = agent_tools.tool_create_task_breakdown(tool_args.get("task", ""), self.user_id, self.db, self.model)
                    action = {
                        "type": "NAVIGATE_WITH_DATA",
                        "path": "/adhd/breakdown",
                        "card_type": "TASK_BREAKDOWN",
                        "data": result_data
                    }
                elif tool_name == "create_focus_session":
                    result_data = agent_tools.tool_create_focus_session(tool_args.get("intent", ""), tool_args.get("duration_minutes", 25), self.user_id, self.db)
                    action = {
                        "type": "NAVIGATE_WITH_DATA",
                        "path": "/adhd/focus",
                        "card_type": "FOCUS_SESSION",
                        "data": result_data
                    }
                elif tool_name == "suggest_grounding":
                    result_data = agent_tools.tool_suggest_grounding(tool_args.get("anxiety_level", 5), self.user_id, self.db)
                    action = {
                        "type": "NAVIGATE_WITH_DATA",
                        "path": "/anxiety",
                        "card_type": "GROUNDING_SESSION",
                        "data": result_data
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
