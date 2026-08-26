# Role 4 Reflection-Derived Memory

## Purpose

The Role 4 Memory System converts repeated, sanitized reflection records into durable, inspectable, user-scoped memory. It records observed associations only. It does not rank modules, select interventions, alter Role 2, personalize UI defaults, infer diagnosis or mental-health state, or modify reflection behavior.

## Architecture

```text
user-scoped v1 reflections
  -> deriveMemoryFromReflections(userId, moduleId)
  -> deterministic module rules and evidence aggregation
  -> user-scoped Role 4 memory records
```

The public boundary is `src/support/memory/index.js`. It uses the existing Role 4 `memories` collection and never exposes persistence APIs to UI consumers.

## API

- `deriveMemoryFromReflections(userId, moduleId)` derives and upserts memory, returning `created`, `updated`, `superseded`, and `unchanged` collections.
- `listUserMemories(userId, filters)` lists active records by default; deleted and superseded records require explicit filters.
- `getMemoryById(userId, memoryId)` retrieves one user-scoped record.
- `deleteMemory(userId, memoryId)` tombstones one record.
- `clearModuleMemories(userId, moduleId)` tombstones active records for a module.
- `setLearningEnabled(userId, enabled)` and `isLearningEnabled(userId)` control user-scoped derivation.

## Schema

```js
{
  memoryId: "stable memory identifier",
  userId: "user-id",
  moduleId: "support.task_breakdown",
  category: "preferred_configuration",
  key: "selected_style",
  value: { observedAssociation: "Standard" },
  evidenceCount: 3,
  supportingReflectionIds: ["reflection-1", "reflection-2", "reflection-3"],
  confidence: 0.65,
  confidenceLevel: "moderate",
  firstObservedAt: "ISO-8601",
  lastUpdatedAt: "ISO-8601",
  version: 1,
  status: "active",
  contradictionCount: 0
}
```

Records use one stable ID per user-scoped module/category/key. Existing legacy Role 4 memory records remain schema-compatible; the reflection-derived fields are additive.

## Categories And Thresholds

Allowed categories are `preferred_configuration`, `successful_strategy`, `unsuccessful_configuration`, `completion_pattern`, and `feedback_pattern`.

- One observation creates no durable memory.
- Two consistent reflections create a low-confidence record at `0.40`.
- Three or four consistent reflections produce `0.65` moderate confidence.
- Five or more consistent reflections produce `0.85` high confidence.

Conflicting values are retained as a contradiction count. Confidence is reduced by `0.10` per contradiction, capped at `0.30`; the engine does not silently treat the newest value as correct. Values are stored as `observedAssociation`, not causal claims.

## Task Breakdown Rules

`support.task_breakdown` derives aggregate-only observations for completion-rate bands, rating bands, timer-associated completion, short-breakdown completion, high-step-count abandonment, and low satisfaction by style. Selected style and requested step count are read only from allowlisted sanitized reflection configuration metadata when it exists.

Reflection v1 does not currently emit configuration metadata for normal Task Breakdown outcomes. Therefore normal v1 records derive completion, timer, duration, and rating patterns now; configuration-specific rules activate only when sanctioned configuration metadata is present in a reflection. This phase does not modify the Reflection Engine to add it.

## Learning Control And Deletion

Learning is enabled by default when the caller supplies an authenticated, non-empty `userId`. Disabling it prevents new derivation only; interventions, outcomes, reflections, and existing memories remain available. Re-enabling resumes derivation and never occurs silently.

Deletion is a user-scoped tombstone in the existing memory collection, not a hard delete. A deleted memory is not recreated from unchanged reflection evidence. It can become active again only when the derivation sees new supporting or contradictory reflection IDs. Module clearing applies the same tombstone behavior.

## Privacy And Versioning

Only validated v1 reflections for the requested user and module are consumed. Memory stores allowlisted aggregate outcomes, typed insights, reflection IDs, and optional sanitized configuration fields. It never copies raw tasks, steps, feedback, conversation or journal text, full context snapshots, diagnostic labels, or reasoning traces.

Memory version `1` and reflection version `1` are explicit. Unsupported reflection versions are ignored. Future rule changes require a new memory version rather than reinterpretation of v1 records.

## Relationship To Other Systems

Memory consumes Reflection Engine output but never writes or changes reflections. A future Support Evidence API may inspect memory records. Future personalization may consume these records only through a separate phase. This Memory System does not rank modules or influence intervention selection.
