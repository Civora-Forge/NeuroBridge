# Shared Intervention Executor

## Purpose

`executeSupportModule(request)` is Role 4's domain-neutral launch boundary. It starts a registered canonical support module without importing a disorder page or manipulating React state.

## Architecture

```text
caller -> request validation -> canonical module resolution -> availability and safety checks
       -> intervention record + STARTED lifecycle event -> placeholder module executor -> result
```

The public API is `src/support/execution/index.js`. Internal files define serializable request/result schemas and a placeholder executor map for currently available canonical modules.

## Request Schema

```js
{
  moduleId: "support.task_breakdown",
  userId: "user-id",
  contextSnapshotId: "context-id" | null,
  triggerSource: "manual" | "voice" | "chat" | "context" | "system",
  selectionMode: "explicit_request" | "adaptive_ranking" | "fallback",
  configuration: {},
  metadata: {}
}
```

`contextSnapshotId` is accepted and persisted as execution metadata, but this phase does not read Role 1 context or invoke Role 2 ranking.

## Response Schema

```js
{
  ok: true,
  status: "running",
  interventionId: "intervention-...",
  moduleId: "support.task_breakdown",
  userId: "user-id",
  contextSnapshotId: "context-id" | null,
  triggerSource: "manual",
  selectionMode: "explicit_request",
  configuration: {},
  lifecycle: [],
  error: null,
  reasonCodes: ["execution_started"]
}
```

## Execution Lifecycle

Execution states are `created`, `validated`, `starting`, `running`, `completed`, `abandoned`, `cancelled`, `failed`, and `blocked`.

The executor currently persists the existing Role 4 `SHOWN` and `STARTED` intervention lifecycle states. Completion, abandonment, reflection, memory, and adaptation are intentionally deferred.

## Supported Triggers and Selection Modes

- Trigger sources: `manual`, `voice`, `chat`, `context`, `system`
- Selection modes: `explicit_request`, `adaptive_ranking`, `fallback`

## Role Boundaries

Role 2 may later supply a canonical module ID, configuration, and selection mode. It does not need to know execution internals. A future Reflection Engine will consume the persisted intervention lifecycle and later outcomes; it is not called by the executor.
