# Depression Safety And Privacy Boundary

`assessSupportInput()` is the versioned deterministic gateway for structured input, free text, and explicit commands. Levels are safe, sensitive, high risk, and blocked. It is non-diagnostic and does not provide crisis-chat behavior.

Structured low-risk modules may retain authenticated aggregate metrics. Sensitive free text is confirmation-gated and raw text is never retained. High-risk input is blocked from ordinary execution, requests escalation, and returns only reason codes and a blocked persistence policy. Anonymous sensitive input remains ephemeral.

Executor calls the gateway before module launch. Policies cover structured low-risk Task Breakdown, Focus Session, and Gentle Activity; sensitive Cognitive Reframing and Evidence Journal; Social Connection; and Grounding. Void Whisper remains hidden and unavailable.

The boundary does not write raw text to lifecycle, outcomes, reflections, memory, personalization, or evidence. Deferred work is module-level wiring for Cognitive Reframing, Evidence Journal, Grounding, and Social Connection.
