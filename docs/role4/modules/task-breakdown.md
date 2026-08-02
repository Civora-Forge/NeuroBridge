# Task Breakdown Lifecycle Integration

## Scope

`src/pages/adhd/TaskBreakdown.jsx` uses the canonical `support.task_breakdown` module through the public `@/support/execution` API. Its deterministic checklist generation and outcome shaping live in `src/support/modules/taskBreakdown/`.

## Lifecycle Rules

- Generating or editing a checklist does not create an intervention.
- An authenticated intervention starts only when the user explicitly starts the breakdown, checks the first step, or starts the next-step timer.
- Step changes emit aggregate progress only. Persisted metadata and outcomes do not include task text or step text.
- Completion is emitted only after every generated step is checked. Timer expiry is not completion.
- Replacing or discarding an active unfinished checklist abandons it with aggregate progress. Unmounting, generating before start, and resetting before start do not create abandonment records.
- After a terminal or abandoned checklist, the UI resets only its local lifecycle session before another generated checklist can start. It never mutates the prior persisted intervention.

## Outcome Contract

Completion records `stepsCreated`, `stepsCompleted`, `completionRate`, selected style, priority, timer use, edit/reorder counts, duration, and final configuration. Optional ratings are integers from 1 through 5. Optional feedback is persisted only after the user submits it with `storeFeedback: true` and is limited to 500 characters by the shared lifecycle API.

## Authentication and Privacy

Without `user.id`, the checklist remains local to the mounted page and shows a sign-in explanation. No anonymous or synthetic lifecycle, outcome, or task persistence is created.

## Exclusions

This integration does not invoke reflection, derive memory, personalize future recommendations, interpret ratings, or persist raw task content.
