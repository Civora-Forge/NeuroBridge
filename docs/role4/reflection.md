# Role 4 Reflection Engine

## Purpose

The Reflection Engine deterministically converts one persisted terminal intervention into one structured reflection. It is a narrow boundary between intervention outcomes and future consumers such as the Memory System, Support Evidence API, and Role 2.

It does not perform adaptation, ranking, recommendation, memory writes, evidence updates, notification, language-model calls, or inference about emotions, diagnoses, or mental health.

## Architecture

```text
terminal intervention + lifecycle history + aggregate outcomes
  -> reflectIntervention(intervention)
  -> generic rules + module-specific aggregate rules
  -> user-scoped reflection persistence
```

`reflectIntervention(intervention)` is exported from `src/support/reflection/index.js`. It is an explicit separate operation after `completeSupportModule()` or `abandonSupportModule()`; lifecycle commands do not invoke it automatically.

## Schema

Each persisted reflection is serializable and versioned:

```js
{
  reflectionId: "reflection-intervention-id-v1",
  interventionId: "intervention-id",
  moduleId: "support.task_breakdown",
  userId: "user-id",
  timestamp: "ISO-8601 timestamp from persisted evidence",
  version: 1,
  outcomeSummary: {
    completionStatus: "completed" | "partially_completed" | "abandoned",
    completionRate: 0.0,
    durationMs: 0,
    rating: 1
  },
  insights: [{ type: "completion_rate", value: 1, confidence: 1 }],
  confidence: 0.85,
  metadata: { version: 1, evidence: {} }
}
```

The ID is derived from intervention ID and reflection version. Re-reflecting unchanged persisted evidence replaces the same record with the same content.

## Rules

Generic rules derive only observable outcome facts:

- completion status and success flag
- completion rate and engagement level
- duration category: short under 5 minutes, standard from 5 through 30 minutes, long over 30 minutes
- user satisfaction from rating: low 1-2, neutral 3, high 4-5
- intervention quality: strong for completed plus high rating, adequate for completed or rating 3+, otherwise limited

`support.task_breakdown` adds aggregate-only insights for high or partial completion, timer use, and many edits (two or more). It never reads task text, step text, feedback, conversation content, or other PHI.

## Confidence

Reflection confidence is the sum of independent available-evidence weights, rounded to two decimals:

| Evidence | Weight |
| --- | --- |
| terminal completion status | 0.30 |
| observed completion rate | 0.30 |
| observed duration | 0.15 |
| observed user rating | 0.15 |
| recognized module aggregate metrics | 0.10 |

Missing evidence contributes zero. The resulting confidence is always between 0 and 1 and does not represent a clinical, emotional, or diagnostic assessment.

## Privacy And Versioning

Reflections are saved through the existing Role 4 `reflections` collection, scoped by `userId`, schema-versioned, and JSON serializable. The engine copies only allowlisted aggregate fields into reflections. It does not persist raw task content, steps, feedback, conversation text, or PHI.

Reflection version `1` is stored in the record and ID. A future semantic rule change must introduce a new reflection version rather than reinterpret stored v1 records.

## Relationship To Memory

The Reflection Engine only stores reflections. Phase 7 may read these records to derive user-scoped memory. This phase does not call the Memory System, Support Evidence API, or Role 2.
