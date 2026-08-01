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

Persisted `InterventionStatus` is separate from immediate `ExecutionStatus`:

| ExecutionStatus | Persisted InterventionStatus |
| --- | --- |
| `created`, `validated`, `starting` | none yet |
| `running` | `shown`, `started`, `in_progress`, or `paused` |
| `completed` | `completed` or `partially_completed` |
| `abandoned` | `abandoned` |
| `cancelled` | `cancelled` |
| `failed` | `failed` |
| `blocked` | no intervention is created |

Legacy persisted states such as `accepted`, `progressed`, `dismissed`, `escalated`, and `rated` remain schema-compatible. New Role 4 commands use `in_progress` rather than adding plan states.

## Post-Start Commands

The public execution entrypoint also exports `progressSupportModule`, `pauseSupportModule`, `resumeSupportModule`, `completeSupportModule`, `abandonSupportModule`, `cancelSupportModule`, `failSupportModule`, and `rateSupportModule`.

Each command requires `userId`, `interventionId`, and `moduleId`; it verifies user ownership and module identity before writing through the existing user-scoped lifecycle store. Valid paths are:

```text
shown -> started -> in_progress <-> paused
in_progress -> completed | partially_completed | abandoned | cancelled | failed
paused -> in_progress | completed | partially_completed | abandoned | cancelled | failed
```

Completion, partial completion, abandonment, cancellation, and failure are terminal. Repeated terminal commands and progress after a terminal command return a structured `invalid_transition` result rather than throwing.

## Outcome and Rating Payloads

Progress metadata may include `progressType`, `completedUnits`, `totalUnits`, `progressRatio`, `elapsedMs`, and `details`.

Completion accepts `completionStatus`, `durationMs`, `metrics`, `finalConfiguration`, optional `userRating`, and optional `userFeedback`. Outcomes are persisted but not interpreted in this phase.

Ratings are bounded integers from 1 through 5. One rating is accepted after completed, partially completed, abandoned, or cancelled use; subsequent ratings return `rating_already_submitted`. Feedback is not persisted unless the caller explicitly supplies `metadata.storeFeedback: true`, and is capped at 500 characters.

## Idempotency

`executeSupportModule` accepts an optional `metadata.idempotencyKey`; repeating the same user/module/key returns the original intervention instead of creating a second one. Post-start commands use persisted transition validation, so local synchronous concurrent terminal requests allow only the first valid transition.

## React Hook

`useInterventionLifecycle` lives in `src/support/execution/useInterventionLifecycle.js` and calls only public execution APIs.

```js
const lifecycle = useInterventionLifecycle({
  userId,
  moduleId: "support.task_breakdown",
  planId: null,
  contextSnapshotId: null,
  triggerSource: "manual",
  selectionMode: "explicit_request",
  configuration: {},
});

await lifecycle.start();
await lifecycle.progress({ completedUnits: 1, totalUnits: 3 });
await lifecycle.complete({ durationMs: 120000 });
```

The hook exposes `start`, `progress`, `pause`, `resume`, `complete`, `abandon`, `cancel`, `fail`, and `rate`, plus `interventionId`, `status`, `isStarting`, `isUpdating`, `error`, `hasStarted`, and `isTerminal`. It resets local state when `userId` changes and does not infer abandonment when a component unmounts.

## Supported Triggers and Selection Modes

- Trigger sources: `manual`, `voice`, `chat`, `context`, `system`
- Selection modes: `explicit_request`, `adaptive_ranking`, `fallback`

## Role Boundaries

Role 2 may later supply a canonical module ID, configuration, and selection mode. It does not need to know execution internals. A future Reflection Engine will consume the persisted intervention lifecycle and later outcomes; reflection is not performed by this phase.
