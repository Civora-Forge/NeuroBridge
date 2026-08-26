# Social Scenario Simulator

Canonical ID: `asd.social-scenarios`. Route: `/asd/social-scenarios`. ASD support module for actively practicing a SINGLE realistic social scenario: the learner reads one defined situation and a role, speaks or types one response, and receives gentle, structured feedback. It is deliberately distinct from Conversation Practice (multi-turn conversation, `/communication`) and Social Stories (passive learning, `/asd/stories`).

## Interaction model

Each round is a single-response exercise:

1. A scenario (title, setting, situation, role, the other person's words, observable cues, and an example good response) is presented. Scenarios come from Gemini through the shared AI facade when available and otherwise rotate through a deterministic fallback pool of 12 across college, workplace, daily life and relationships.
2. The learner replies once, by voice (Web Speech API) or text.
3. Structured feedback is shown immediately: an overall score (0-100) plus strengths, improvements, detected cues, an optional suggested response, and honest speech notes (pacing only, derived from browser timing — never emotion or confidence).
4. `Next` rotates to a fresh situation.

Difficulty (easy / medium / hard) shapes cue subtlety; the scoring heuristic stays deterministic so behaviour is stable and testable. When Gemini is available it may refine only the qualitative feedback wording — the score is always computed deterministically and never moved by the model.

## Adaptation (public engine outputs only)

The card consumes the Adaptive Engine's documented public outputs through the generic `useModuleAdaptation` hook (decision-only, `plan` + `trace` from `useAdaptiveBehavioralEngine`) and translates them into three self-applied signals only: provide hints (`GUIDE`), simplify the exercise and reduce cues (`SIMPLIFY`/`REDUCE`), and slow the pace (`DECREASE`). The module never modifies the engine. When the engine is disabled, errors, or yields nothing usable, it degrades to the default experience without changing behavior or persistence.

## Persistence & privacy

Local per-user store (`nb_asd_social_scenarios_attempts_v1_<userId>`) holds completed-round records: scenario id/title, category, difficulty, score, up to three strengths, whether the reply was spoken, whether AI refinement was used, and the completion timestamp. No diagnosis, inferred mood, transcript, or raw reply wording is persisted — scores and titles only. No raw audio is ever stored.
