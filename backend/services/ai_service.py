import os
import json
import re
import google.generativeai as genai
from typing import List

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# Mirrors the frontend guard in src/support/specialized/ocdStore.js
# (containsReassurance) — AI-generated OCD copy must pass through this too,
# since Gemini output isn't otherwise vetted before being stored/shown.
REASSURANCE_PATTERN = re.compile(
    r"(you('re| are) safe|nothing bad|it'?s? okay|everything will|don'?t worry|you'?ll be fine|"
    r"i (can |)guarantee|definitely (safe|fine|okay)|100% (safe|certain|sure))",
    re.IGNORECASE,
)


def _contains_reassurance(text: str) -> bool:
    return bool(text) and bool(REASSURANCE_PATTERN.search(text))


def generate_exposure_suggestions(category: str) -> List[str]:
    """Generates a list of exposure tasks for a specific OCD category."""
    if not api_key:
        return [f"Sample exposure task for {category}"]

    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = (
        f"Suggest a JSON list of 5 progressive ERP (Exposure and Response Prevention) practice steps, "
        f"ordered from easiest to hardest, for the OCD theme: '{category}'. "
        f"Each item should be a concrete, doable situation to practice — not a claim about outcomes or safety. "
        f"Do not tell the user anything is safe, harmless, or guaranteed to be fine; only describe the practice step. "
        f"Return ONLY a JSON array of strings, nothing else."
    )

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3]
        elif text.startswith("```"):
            text = text[3:-3]
        suggestions = json.loads(text)
        safe = [s for s in suggestions if not _contains_reassurance(s)]
        return safe or ["Touch a doorknob", "Don't wash hands for 1 minute"]
    except Exception as e:
        print(f"Error generating exposure tasks: {e}")
        return ["Touch a doorknob", "Don't wash hands for 1 minute"]


def summarize_erp_session(pre_suds: int, post_suds: int, duration: int, resisted: bool, notes: str) -> str:
    """Provides a brief, factual summary of an ERP session without reassurance."""
    fallback = "Session logged. Notice what happened to your anxiety over time, without judging it as good or bad."
    if not api_key:
        return fallback

    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"""
    Write a brief, factual 2-sentence summary of this ERP (Exposure and Response Prevention) session.
    Describe what happened — do not reassure the user, do not claim anything is safe or will be fine,
    and do not tell them their fear is irrational. Focus on the practice of staying present and tolerating
    uncertainty, not on resolving it.

    Pre-SUDS: {pre_suds}/100, Post-SUDS: {post_suds}/100.
    Duration: {duration} seconds.
    Resisted compulsion: {resisted}.
    Notes: {notes}
    """
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        return fallback if _contains_reassurance(text) else text
    except Exception:
        return fallback


def analyze_journal_entry(trigger: str, obsession: str, emotion: str, anxiety: int) -> str:
    """Analyzes a journal entry and suggests an ERP approach, without reassurance."""
    fallback = "Track when this trigger shows up to find patterns. Consider a small, planned ERP step for it next."
    if not api_key:
        return fallback

    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"""
    Analyze this OCD journal entry and suggest one small, concrete ERP (Exposure and Response Prevention)
    exercise for it, in 2 sentences total. Do not reassure the user that the feared outcome won't happen,
    do not say anything is safe or fine, and do not debate whether the obsession is true or false —
    only describe a practice step.

    Trigger: {trigger}
    Obsession: {obsession}
    Emotion: {emotion}
    Anxiety: {anxiety}/100
    """
    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        return fallback if _contains_reassurance(text) else text
    except Exception:
        return fallback
