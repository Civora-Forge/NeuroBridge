"""Deterministic minimization for content sent to Gemini."""

import re
from typing import Any

_DIRECT_IDENTIFIER = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b|(?<!\w)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\w)|\b\d{2}-\d{4}-\d{4}-\d{4}\b"
)


def redact_direct_identifiers(value: str) -> str:
    return _DIRECT_IDENTIFIER.sub("[identifier removed]", value or "")


def minimize_contents(contents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    minimized = []
    for content in contents:
        parts = []
        for part in content.get("parts", []):
            sanitized = dict(part)
            if isinstance(sanitized.get("text"), str):
                sanitized["text"] = redact_direct_identifiers(sanitized["text"])
            parts.append(sanitized)
        minimized.append({**content, "parts": parts})
    return minimized
