"""
Deterministic, non-LLM safety pre-filter for the agent.

Mirrors the intent of the existing client-side regex gateway
(src/support/framework/interventionSelection.js::assessSupportSafety) but runs
server-side, before any Gemini call — crisis language must never depend on an
LLM choosing to behave safely.
"""

import re
from enum import Enum


class SafetyLevel(str, Enum):
    STANDARD = "standard"
    CAUTION = "caution"
    ESCALATE = "escalate"

CRISIS_PATTERN = re.compile(r"\b(suicid\w*|self[- ]?harm\w*|kill myself|end my life|hurt myself)\b", re.IGNORECASE)
DIAGNOSIS_PATTERN = re.compile(
    r"\b(diagnos\w*|do i have|am i autistic|am i ocd|cure|medication|prescri\w*)\b", re.IGNORECASE
)

CRISIS_RESPONSE_TEXT = (
    "It sounds like you might be going through something really difficult right now, and I want to make sure "
    "you get real support, not just a chat message from me. I'm not able to help with a crisis safely — please "
    "reach out to a person who can.\n\n"
    "If you're in immediate danger, please contact your local emergency number right away.\n\n"
    "In India: AASRA — 91-22-27546669 (24x7), iCall — 9152987821.\n"
    "Elsewhere: please contact your local crisis line, a trusted person, or emergency services.\n\n"
    "You don't have to go through this alone."
)

DIAGNOSIS_DISCLAIMER = (
    " Just a note: I can offer support strategies and help you use NeuroBridge's tools, but I can't diagnose "
    "conditions, confirm a diagnosis, cure them, or prescribe medication — please talk to a licensed professional "
    "for that."
)


class SafetyAssessment:
    def __init__(self, level: SafetyLevel, allowed: bool, reason_codes: list[str], message: str | None = None):
        self.level = level
        self.allowed = allowed
        self.reason_codes = reason_codes
        self.message = message


def assess_message_safety(message: str) -> SafetyAssessment:
    text = message or ""

    if CRISIS_PATTERN.search(text):
        return SafetyAssessment(
            level=SafetyLevel.ESCALATE,
            allowed=False,
            reason_codes=["crisis_language_detected"],
            message=CRISIS_RESPONSE_TEXT,
        )

    if DIAGNOSIS_PATTERN.search(text):
        return SafetyAssessment(
            level=SafetyLevel.CAUTION,
            allowed=True,
            reason_codes=["clinical_claim_guardrail"],
            message=DIAGNOSIS_DISCLAIMER,
        )

    return SafetyAssessment(level=SafetyLevel.STANDARD, allowed=True, reason_codes=[])
