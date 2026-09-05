"""
The agent orchestrator: USER -> UNDERSTAND -> PLAN -> USE TOOLS -> EXECUTE -> OBSERVE -> ADAPT.

Pipeline for every message:
  1. Safety pre-filter (deterministic, no LLM call) — crisis language short-circuits here.
  2. Deterministic navigation shortcut (deterministic, no LLM call) — obvious "take me to X" requests.
  3. Minimal relevant context assembly (real DB summaries + optional client-supplied context).
  4. Gemini native function-calling loop (up to MAX_TOOL_ROUNDS), enforcing the confirmation policy:
     - read / write_low tools execute immediately
     - write_confirm tools are proposed, never silently executed
  5. Every tool attempt is logged to AgentActionLog; successful writes also log an InterventionOutcome.
"""

from __future__ import annotations

import os
import time
from typing import Any, Optional

import google.generativeai as genai
from sqlalchemy.orm import Session

from ..auth import CurrentUser
from ..models import agent_models
from . import agent_tools, safety
from .agent_tools import RiskLevel, Tool, ToolContext, ToolError
from .navigation import FEATURE_LABELS, match_navigation_shortcut, resolve_feature_route

MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash")
MAX_TOOL_ROUNDS = 4

api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

NO_ACTION_TOOLS = set()  # reserved for future read-only tools that also shouldn't set an action

# Maps a successfully executed tool to the frontend action it should trigger.
# Kept deterministic and backend-owned — the LLM never constructs paths/card types itself.
_TOOL_ACTION_MAP: dict[str, dict] = {
    "navigate_to_feature": {"kind": "navigate_from_result"},
    "start_social_scenario": {"kind": "navigate_from_result"},
    "create_task_breakdown": {"path": "/adhd/breakdown", "card_type": "TASK_BREAKDOWN"},
    "start_focus_session": {"path": "/adhd/focus", "card_type": "FOCUS_SESSION"},
    "start_grounding_activity": {"path": "/anxiety", "card_type": "GROUNDING_SESSION"},
    "create_exposure": {"path": "/ocd/exposure-hierarchy", "card_type": "EXPOSURE_CREATED"},
    "start_erp_session": {"path": "/ocd/exposure-session", "card_type": "ERP_SESSION_STARTED"},
    "complete_erp_session": {"path": "/ocd/progress", "card_type": "ERP_SESSION_COMPLETE"},
}

_OUTCOME_MODULE_BY_TOOL_PREFIX = {
    "get_ocd": "ocd",
    "create_exposure": "ocd",
    "start_erp": "ocd",
    "record_suds": "ocd",
    "complete_erp": "ocd",
    "get_recent_tasks": "adhd",
    "create_task_breakdown": "adhd",
    "start_focus_session": "adhd",
    "get_anxiety": "anxiety",
    "start_grounding": "anxiety",
    "get_reading": "dyslexia",
    "start_social_scenario": "asd",
}


def _outcome_module_for(tool_name: str) -> str:
    for prefix, module in _OUTCOME_MODULE_BY_TOOL_PREFIX.items():
        if tool_name.startswith(prefix):
            return module
    return "general"


class AgentOrchestrator:
    def __init__(self, db: Session, user: CurrentUser, user_token: Optional[str] = None):
        self.db = db
        self.user = user
        self.ctx = ToolContext(db=db, user=user, user_token=user_token)

    # -- context -------------------------------------------------------

    def _build_context_bundle(self, client_context: Optional[dict]) -> str:
        learnings = agent_tools.get_user_learnings(self.user.id, self.db)
        try:
            ocd_summary = agent_tools._get_ocd_progress({}, self.ctx)
        except Exception:
            ocd_summary = None
        try:
            adhd_summary = agent_tools._get_recent_tasks({}, self.ctx)
        except Exception:
            adhd_summary = None
        try:
            anxiety_summary = agent_tools._get_anxiety_history({}, self.ctx)
        except Exception:
            anxiety_summary = None

        parts = [f"Learned preferences: {learnings or 'none yet'}."]
        if ocd_summary:
            parts.append(f"OCD/ERP summary: {ocd_summary}")
        if adhd_summary:
            parts.append(f"ADHD summary: {adhd_summary}")
        if anxiety_summary:
            parts.append(f"Anxiety summary: {anxiety_summary}")
        if client_context:
            parts.append(
                "Additional self-reported context from the app (not verified server-side, use as soft signal only): "
                f"{client_context}"
            )
        return "\n".join(parts)

    def _system_prompt(self, context_bundle: str) -> str:
        return f"""You are the NeuroBridge Agentic AI Assistant — an orchestration layer that helps neurodivergent
users actually use NeuroBridge's real support tools (OCD/ERP, ADHD focus & task tools, anxiety grounding,
ASD social practice, dyslexia reading support), not a generic chatbot.

Hard rules:
- You are NOT a therapist, doctor, or diagnostic tool. Never diagnose, confirm/rule out a condition, prescribe
  or recommend medication, or claim to cure anything.
- Only claim an action succeeded if a tool call actually returned success. Never say "I've created/started/saved..."
  without having called the matching tool.
- Prefer calling a real tool over giving generic advice whenever one of your tools can actually do the thing.
- Ask a brief clarifying question only when you genuinely can't proceed without it (e.g. which exposure they mean).
- Keep responses short, warm, and concrete.

Relevant user context (already retrieved for you — do not re-ask for this):
{context_bundle}
"""

    # -- tool dispatch ---------------------------------------------------

    def _execute_tool(self, tool: Tool, args: dict) -> dict:
        start = time.monotonic()
        status = "executed"
        error_message = None
        result: dict[str, Any] = {}
        try:
            result = tool.handler(args, self.ctx)
        except ToolError as e:
            status = "error"
            error_message = str(e)
        except Exception as e:  # never leak internals to the model/user
            status = "error"
            error_message = "Something went wrong performing that action."
            print(f"[agent] tool '{tool.name}' failed: {e}")
        latency_ms = int((time.monotonic() - start) * 1000)

        self.db.add(
            agent_models.AgentActionLog(
                user_id=self.user.id,
                tool_name=tool.name,
                tool_args=args,
                risk_level=tool.risk_level.value,
                status=status,
                error_message=error_message,
                latency_ms=latency_ms,
            )
        )
        self.db.commit()

        if status == "executed" and tool.risk_level != RiskLevel.READ:
            self.db.add(
                agent_models.InterventionOutcome(
                    user_id=self.user.id,
                    module=_outcome_module_for(tool.name),
                    tool_name=tool.name,
                    outcome_type="completed" if "complete" in tool.name else "started",
                )
            )
            self.db.commit()

        return {"status": status, "result": result, "error": error_message}

    def _build_action(self, tool_name: str, result: dict) -> Optional[dict]:
        mapping = _TOOL_ACTION_MAP.get(tool_name)
        if not mapping:
            return None
        if mapping.get("kind") == "navigate_from_result":
            path = result.get("path")
            return {"type": "NAVIGATE", "path": path} if path else None
        return {
            "type": "NAVIGATE_WITH_DATA",
            "path": mapping["path"],
            "card_type": mapping["card_type"],
            "data": result,
        }

    def execute_confirmed_tool(self, tool_name: str, tool_args: dict) -> dict:
        """Entry point for POST /api/agent/tool/execute — runs a previously-proposed write_confirm tool now.

        Deliberately restricted to write_confirm tools: read/write_low tools already run inline during
        process_message, so allowing them here too would blur what this endpoint is for and let a caller
        bypass the "propose, then confirm" flow by simply not proposing anything first.
        """
        tool = agent_tools.TOOL_REGISTRY.get(tool_name)
        if not tool:
            return {"status": "denied", "result": None, "error": "Unknown tool."}
        if tool.risk_level != RiskLevel.WRITE_CONFIRM:
            return {
                "status": "denied",
                "result": None,
                "error": "This action doesn't require confirmation and can't be run through this endpoint.",
            }
        outcome = self._execute_tool(tool, tool_args)
        outcome["action"] = self._build_action(tool_name, outcome["result"]) if outcome["status"] == "executed" else None
        return outcome

    # -- main entry point -------------------------------------------------

    def process_message(self, message: str, history: list[dict] | None = None, client_context: Optional[dict] = None) -> dict:
        assessment = safety.assess_message_safety(message)
        if not assessment.allowed:
            self.db.add(
                agent_models.AgentActionLog(
                    user_id=self.user.id, tool_name=None, status="escalated", risk_level=None
                )
            )
            self.db.commit()
            return {"response": assessment.message, "action": None}

        shortcut_feature = match_navigation_shortcut(message)
        if shortcut_feature:
            path = resolve_feature_route(shortcut_feature)
            label = FEATURE_LABELS.get(shortcut_feature, "that screen")
            self.db.add(
                agent_models.AgentActionLog(
                    user_id=self.user.id,
                    tool_name="navigate_to_feature",
                    tool_args={"feature": shortcut_feature},
                    risk_level=RiskLevel.READ.value,
                    status="executed",
                    latency_ms=0,
                )
            )
            self.db.commit()
            return {"response": f"Taking you to {label}.", "action": {"type": "NAVIGATE", "path": path}}

        disclaimer = assessment.message if assessment.level == safety.SafetyLevel.CAUTION else ""

        if not api_key:
            return {
                "response": "The assistant isn't fully configured yet (missing GEMINI_API_KEY on the backend).",
                "action": None,
            }

        context_bundle = self._build_context_bundle(client_context)
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            tools=agent_tools.build_gemini_tool_declarations(),
            system_instruction=self._system_prompt(context_bundle),
        )

        gemini_history = [
            {"role": turn["role"], "parts": [turn["content"]]}
            for turn in (history or [])
            if turn.get("role") in ("user", "model") and turn.get("content")
        ]

        try:
            chat = model.start_chat(history=gemini_history)
            response = chat.send_message(message)
        except Exception as e:
            print(f"[agent] Gemini call failed: {e}")
            return {
                "response": "I'm having a little trouble thinking right now. Please try again in a moment.",
                "action": None,
            }

        last_action: Optional[dict] = None
        pending_confirmation: Optional[dict] = None
        any_tool_failed = False

        for _ in range(MAX_TOOL_ROUNDS):
            function_calls = [
                part.function_call
                for part in getattr(response.candidates[0].content, "parts", [])
                if getattr(part, "function_call", None) and part.function_call.name
            ]
            if not function_calls:
                break

            call = function_calls[0]
            tool_name = call.name
            tool_args = dict(call.args) if call.args else {}
            tool = agent_tools.TOOL_REGISTRY.get(tool_name)

            if not tool:
                function_response_payload = {"error": f"Unknown tool '{tool_name}'."}
                any_tool_failed = True
            elif tool.risk_level == RiskLevel.WRITE_CONFIRM:
                self.db.add(
                    agent_models.AgentActionLog(
                        user_id=self.user.id,
                        tool_name=tool.name,
                        tool_args=tool_args,
                        risk_level=tool.risk_level.value,
                        status="pending_confirmation",
                    )
                )
                self.db.commit()
                pending_confirmation = {"tool_name": tool.name, "tool_args": tool_args}
                break
            else:
                outcome = self._execute_tool(tool, tool_args)
                if outcome["status"] == "executed":
                    last_action = self._build_action(tool.name, outcome["result"]) or last_action
                    function_response_payload = outcome["result"]
                else:
                    function_response_payload = {"error": outcome["error"] or "That action couldn't be completed."}
                    any_tool_failed = True

            try:
                response = chat.send_message(
                    genai.protos.Content(
                        parts=[
                            genai.protos.Part(
                                function_response=genai.protos.FunctionResponse(
                                    name=tool_name, response={"result": function_response_payload}
                                )
                            )
                        ]
                    )
                )
            except Exception as e:
                print(f"[agent] Gemini follow-up call failed: {e}")
                break

        try:
            response_text = response.text.strip()
        except Exception:
            response_text = "Done." if last_action else "I understand."

        if disclaimer:
            response_text = f"{response_text}{disclaimer}"

        if any_tool_failed and not pending_confirmation:
            # Deterministic guarantee, independent of whatever Gemini's own wording happened to be:
            # a failed tool call must never be allowed to read as an unqualified success.
            response_text = (
                f"{response_text}\n\n(Note: one of the actions I tried didn't go through, so nothing was "
                "saved for that step — you may want to try again.)"
            )

        if pending_confirmation:
            tool = agent_tools.TOOL_REGISTRY[pending_confirmation["tool_name"]]
            proposal = (
                f"I'd like to {tool.description[0].lower()}{tool.description[1:]} "
                f"Shall I go ahead?"
            )
            return {
                "response": response_text or proposal,
                "action": {
                    "type": "PENDING_CONFIRMATION",
                    "tool_name": pending_confirmation["tool_name"],
                    "tool_args": pending_confirmation["tool_args"],
                },
            }

        return {"response": response_text, "action": last_action}
