"""
Deterministic, keyword-based relevance detection for context building.

The failure mode to avoid is under-fetching (missing context the agent
genuinely needs) — so ambiguous or general messages deliberately broaden to
"everything" rather than guessing narrow. This only trims the *obviously*
irrelevant case (e.g. a clearly ADHD-only message doesn't also need to pull
anxiety/OCD summaries).
"""

MODULE_KEYWORDS: dict[str, list[str]] = {
    "ocd": ["ocd", "erp", "exposure", "suds", "compulsion", "obsession", "ritual", "intrusive thought"],
    "adhd": [
        "adhd", "task breakdown", "focus session", "assignment", "procrastinat", "distract",
        "can't start", "cant start", "todo", "to-do", "focus flow",
    ],
    "anxiety": ["anxiety", "anxious", "grounding", "panic", "overwhelm", "calm down", "breathing exercise"],
}

ALL_MODULES = frozenset(MODULE_KEYWORDS.keys())


def infer_relevant_modules(message: str) -> frozenset[str]:
    text = (message or "").lower()
    matched = {module for module, keywords in MODULE_KEYWORDS.items() if any(k in text for k in keywords)}
    return frozenset(matched) if matched else ALL_MODULES
