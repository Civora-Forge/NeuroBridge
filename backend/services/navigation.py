"""
Allowlisted navigation targets for the agent's `navigate_to_feature` tool.

The LLM only ever supplies a `feature` key from this map — it can never
construct or choose an arbitrary path. Keys mirror the routes registered in
src/App.jsx; keep the two in sync if routes change.
"""

FEATURE_ROUTES: dict[str, str] = {
    # OCD
    "ocd_home": "/ocd",
    "ocd_progress": "/ocd/progress",
    "ocd_exposure_tracker": "/ocd/exposure-tracker",
    "ocd_hierarchy": "/ocd/exposure-hierarchy",
    "ocd_suds_monitor": "/ocd/suds-monitor",
    "ocd_session_timer": "/ocd/exposure-session",
    # ADHD
    "adhd_home": "/adhd",
    "adhd_task_breakdown": "/adhd/breakdown",
    "adhd_focus_session": "/adhd/focus",
    "adhd_visual_timeline": "/adhd/timeline",
    "adhd_body_doubling": "/adhd/doubling",
    "adhd_emotion_coach": "/adhd/emotion-coach",
    # Anxiety
    "anxiety_home": "/anxiety",
    # ASD
    "asd_home": "/asd",
    "asd_social_scenarios": "/asd/social-scenarios",
    "asd_stories": "/asd/stories",
    "asd_emotion": "/asd/emotion",
    # Dyslexia
    "dyslexia_home": "/dyslexia",
    "dyslexia_adaptive_reading": "/dyslexia/adaptive-reading",
    "dyslexia_reinforcement": "/dyslexia/reinforcement",
    "dyslexia_writing_assistant": "/dyslexia/writing-assistant",
    "dyslexia_phonology": "/dyslexia/phonology",
    # Cross-disorder
    "communication_practice": "/communication",
}


FEATURE_LABELS: dict[str, str] = {
    "ocd_home": "OCD support",
    "ocd_progress": "your ERP progress tracker",
    "ocd_exposure_tracker": "the ERP exposure tracker",
    "ocd_hierarchy": "the exposure hierarchy builder",
    "ocd_suds_monitor": "the SUDS anxiety monitor",
    "ocd_session_timer": "the exposure session timer",
    "adhd_home": "focus & attention support",
    "adhd_task_breakdown": "task breakdown",
    "adhd_focus_session": "focus sessions",
    "adhd_visual_timeline": "the visual timeline",
    "adhd_body_doubling": "body doubling",
    "adhd_emotion_coach": "the emotion coach",
    "anxiety_home": "anxiety tools",
    "asd_home": "sensory & social support",
    "asd_social_scenarios": "the social scenario simulator",
    "asd_stories": "the social story builder",
    "asd_emotion": "the emotional check-in",
    "dyslexia_home": "reading support",
    "dyslexia_adaptive_reading": "the adaptive reading module",
    "dyslexia_reinforcement": "multi-sensory reinforcement",
    "dyslexia_writing_assistant": "the writing assistant",
    "dyslexia_phonology": "phonological training",
    "communication_practice": "conversation practice",
}

# Deterministic (non-LLM) navigation shortcuts: a small set of unambiguous
# phrases that skip the Gemini round trip entirely for latency (spec section
# 20). Anything not matched here still falls through to the full agent loop,
# where the LLM can call `navigate_to_feature` itself.
#
# Deliberately excludes any "show me my progress/history" phrasing — that's a
# data-retrieval intent (must go through get_ocd_progress and summarize real
# numbers), not a pure navigation intent, even though both end up pointing at
# the same screen. Collapsing the two here would silently skip the actual data
# lookup for anyone who phrases a data question as "show me my X".
NAVIGATION_KEYWORDS: dict[str, str] = {
    "open the suds monitor": "ocd_suds_monitor",
    "open focus sessions": "adhd_focus_session",
    "open task breakdown": "adhd_task_breakdown",
    "take me to the anxiety tools": "anxiety_home",
    "open the anxiety page": "anxiety_home",
    "take me to the social scenario": "asd_social_scenarios",
    "open the social scenario simulator": "asd_social_scenarios",
    "take me to reading support": "dyslexia_home",
    "open the reading module": "dyslexia_adaptive_reading",
}


def resolve_feature_route(feature_key: str) -> str | None:
    return FEATURE_ROUTES.get(feature_key)


def match_navigation_shortcut(message: str) -> str | None:
    """Best-effort exact/substring match against a small allowlisted phrase set."""
    normalized = (message or "").strip().lower()
    if not normalized:
        return None
    for phrase, feature_key in NAVIGATION_KEYWORDS.items():
        if phrase in normalized:
            return feature_key
    return None
