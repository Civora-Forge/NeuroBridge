# Social Scenario Simulator

Canonical ID: `asd.social-scenarios`. Route: `/asd/social-scenarios`. ASD support module for practicing scripted, safe social conversations with guided, non-shaming feedback.

## Interaction model

A session is a deterministic conversation against a scripted scenario (12 scenarios across college, workplace, daily life and relationships). Difficulty changes session length, free-text matching strictness and how often the AI partner introduces an "unexpected" conversational beat:

- **Easy** — first 3 moments only, a single keyword match accepts free text, no unexpected beats.
- **Medium** — full scenario, two keyword matches required, occasional beats.
- **Hard** — full scenario, three keyword matches, frequent beats.

Scripted quick replies (exact option text) always match; the free-text threshold only applies to typed replies, so choosing a suggested reply never fails. Unmatched free text falls back to a gentle redirection without advancing.

Start creates an authenticated lifecycle intervention. Each reply advances (or stays) and is scored; completing the last moment (or consuming a final unexpected beat) completes the session. Pause/resume/restart/finish-early/exit-early are supported. Finishing records a feedback report; exit-early records an abandoned session. Anonymous use is local only.

## Adaptation (public engine outputs only)

`useScenarioAdaptation` consumes the Adaptive Engine's documented public outputs (`plan` + `trace` from `useAdaptiveBehavioralEngine`) and translates them into four self-applied signals only: simplify scenario, slow pace, reduce distractions, recommend an easier scenario. The module never modifies the engine. When the engine is disabled, errors, or yields nothing usable, it degrades to the default experience without changing behavior or persistence.

## Persistence & privacy

Local per-user store (`nb_asd_social_scenarios_v1_<userId>`) holds completed-session records: scenario id/title, difficulty, communication score, per-turn subscores, strengths, misunderstandings, alternatives, duration, turn count, completion timestamp, abandoned flag; plus favorites and the practice streak. One in-progress session is persisted so a refresh can resume; it is cleared on completion. No diagnosis, inferred mood, or raw reply wording is persisted — only the scored feedback aggregates.
