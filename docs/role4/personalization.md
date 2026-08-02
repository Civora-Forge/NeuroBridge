# Role 4 Personalization Hints

## Purpose

The personalization boundary converts active, evidence-backed Role 4 memories into conservative, module-specific advisory hints. It does not rank or select modules, alter Role 2, change UI defaults, update memory, modify reflections, or persist data.

## Architecture

```text
active user-scoped memories
  -> getPersonalizationHints(userId, moduleId)
  -> validated advisory hints
```

The public API is `src/support/personalization/index.js`:

- `getPersonalizationHints(userId, moduleId)`
- `getPersonalizationHintsForModules(userId, moduleIds)`
- `resolveAdvisoryConfiguration({ moduleDefaults, personalizationHints, explicitConfiguration })`

The resolver is pure and unintegrated. It exists only to make the future Role 2/module boundary explicit.

## Hint Schema

```js
{
  userId: "user-id",
  moduleId: "support.task_breakdown",
  hints: [{
    id: "hint-memory-id",
    key: "timerEnabled",
    value: true,
    sourceMemoryIds: ["memory-id"],
    evidenceCount: 5,
    confidence: 0.85,
    advisory: "strong",
    reasonCode: "timer_associated_high_completion"
  }],
  generatedAt: "latest memory evidence timestamp",
  evidenceCount: 5,
  confidence: 0.85,
  version: 1
}
```

Responses are deterministic and serializable. No-memory and unsupported-module responses are valid empty results with confidence and evidence count of zero.

## Confidence And Advisory Levels

- Below `0.40`: no hint is emitted.
- `0.40` to below `0.65`: `observational`; it is visible evidence only and cannot be applied by the resolver.
- `0.65` to below `0.85`: `usable`; a downstream consumer may offer it as a user-overridable default.
- `0.85` or higher: `strong`; still advisory and user-overridable.

`resolveAdvisoryConfiguration` only considers usable or strong hints, only for keys present in supplied module defaults, and overlays explicit user parameters last. It never performs current-state adjustment or persists output.

## Task Breakdown Rules

Supported hints are emitted only from active sanitized memories:

- `selectedStyle` from an observed preferred style.
- `timerEnabled: true` from timer-associated high completion.
- `suggestSmallerFirstStep: true` from repeated partial completion.
- `avoidHighStepCount: true` from repeated high-step-count abandonment.
- `avoidSelectedStyle` from repeated low satisfaction for a style.
- `lowHelpfulnessObserved: true` from repeated low satisfaction.

The latter four are advisory signals, not forced configuration changes. No module UI currently imports or applies these hints.

Reflection v1 does not normally provide selected style or requested-step-count metadata for normal Task Breakdown outcomes. The hint layer does not invent them. Style and step-count hints are unavailable unless active memory was already derived from sanctioned sanitized configuration metadata.

## Conflict And Learning Behavior

Deleted and superseded memories are ignored. If active memories produce different values for the same hint key, the response emits one `conflicting_evidence` observational hint with no value and reduced confidence. It does not silently use the newest memory or create an applicable recommendation.

When learning is disabled for a user, hint generation returns an empty response. Existing memories are neither changed nor deleted, and hint generation never enables learning.

## Privacy And Precedence

Hints contain only allowlisted structured memory values, evidence IDs, counts, confidence, and reason codes. They never contain raw task text, steps, feedback, journal text, conversation content, or context snapshots.

The intended future precedence is:

1. Safety constraints
2. Explicit user parameters
3. Role 2 current-state configuration
4. Role 4 personalization hints
5. Module defaults

This phase provides level 4 only. It neither creates an AdaptationPlan nor invokes Role 2. Future Support Evidence APIs and module UI integration can consume this boundary separately.
