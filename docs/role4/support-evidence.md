# Role 4 Support Evidence API

## Purpose

`getSupportEvidence(userId, candidateModuleIds)` gives Role 2 historical, user-scoped evidence for each supplied candidate. It does not rank, select, filter, or recommend modules and does not create an AdaptationPlan.

## Response

Each deduplicated input ID is returned in first-occurrence order. Canonical `support.*` IDs receive neutral evidence when unused; legacy and unknown IDs receive an entry with `invalid_module_id`.

Each entry includes aggregate counts, nullable completion/effectiveness/rating metrics, recent trend, advisory preferred configuration, sanitized unsuccessful configurations, hints, last-use time, confidence, reason codes, and version 1. No history returns null metrics, not zero.

## Metrics

- `startedCount`: interventions with a persisted `started` or later lifecycle event.
- `completedCount`, `partiallyCompletedCount`, `abandonedCount`: terminal v1 reflection statuses.
- `completionRate`: `(completed + 0.5 * partiallyCompleted) / startedCount`; null without starts.
- `effectivenessRate`: positive evidence divided by sufficient effectiveness evidence. Positive means `completed` with rating 4-5 or explicit `intervention_quality: strong`. Completion alone is not effective evidence.
- `averageUserRating`: mean of valid reflected ratings; null without ratings.
- `evidenceCount`: terminal interventions with valid v1 reflections.

## Confidence And Trend

Base confidence is 0, .25, .40, .65, and .85 for 0, 1, 2, 3-4, and 5+ reflections. It subtracts .10 with no rating evidence, up to .20 for memory contradictions, and .05 for mixed recent outcomes.

Trend uses the last five reflected outcomes and requires at least three. Positive quality is the same conservative effectiveness signal. The API compares first and latter halves: delta at least .25 is improving, at most -.25 declining, uniform values stable, and remaining variable values mixed.

## Personalization And Privacy

Only usable/strong, non-conflicting `selectedStyle` and `timerEnabled` hints enter `preferredConfiguration`; all hints remain advisory. Active unsuccessful memory becomes sanitized observed-association evidence only. With learning disabled, lifecycle/reflection aggregates remain available but hints, preferred configuration, and memory-derived negatives are omitted.

The API exposes no raw tasks, steps, feedback, conversations, journals, lifecycle metadata, or context snapshots. It reads persisted data only and never changes reflection, memory, module configuration, UI defaults, or Role 2.
