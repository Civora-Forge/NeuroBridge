# Role 4 ADHD and Depression Learning Loop

## Baseline

- Branch: `role4-adhd-depression-learning-loop`
- Baseline commit: `ac9c5c61a6454a5c61153fb17ce7a8780dba8c31`
- Baseline remote: `origin/main`
- Baseline test command: `npm.cmd test`
- Baseline test result: passed, 6 files and 107 tests
- Existing failures: none from the documented test command
- Working tree at baseline: clean
- Preserved unrelated work: `stash@{0}` (`preserve role2 reasoning changes before role4 work`), not applied on this branch

## Role 4 Starting State

- Canonical Zod schemas, user-scoped local persistence, module selection, and intervention lifecycle are implemented under `src/support/`.
- ADHD registry coverage exists for Task Breakdown, Focus Sessions, and Emotion Coach; no ADHD UI currently calls the lifecycle API.
- Depression registry coverage exists for MVH Protocol and Cognitive Reframer; no depression UI currently calls the lifecycle API.
- `src/adaptive/reflection/reflectionEngine.js` is a stub, and the current memory APIs are not connected to ADHD or depression outcomes.
- Shared coordination files: `src/support/schemas/supportSchemas.js`, `src/support/persistence/role4Store.js`, `src/support/framework/supportModuleRegistry.js`, `src/support/framework/interventionSelection.js`, `src/support/lifecycle/interventionLifecycle.js`, `src/adaptive/reflection/reflectionEngine.js`, `src/adaptive/memory/memorySystem.js`, `src/lib/featureRegistry.js`, `src/data/modulesRegistry.js`, and `src/App.jsx`.

## Phase Checklist

- [x] Phase 0: Establish branch and implementation baseline
- [x] Phase 1: Finalize ADHD and depression module contracts
- [x] Phase 2: Align feature, module, and support registries
- [x] Phase 3: Add shared module execution and lifecycle integration boundary
- [x] Phase 4: Complete reusable intervention lifecycle boundary and hook
- [x] Phase 5: Integrate Task Breakdown lifecycle and canonical outcomes
- [x] Phase 6: Implement reflection for canonical intervention outcomes
- [ ] Phase 7: Derive user-scoped memory from reflected outcomes
- [ ] Phase 8: Add memory-informed personalization hints
- [ ] Phase 9: Integrate ADHD Focus Sessions lifecycle and outcomes
- [ ] Phase 10: Restore depression dashboard routing and MVH lifecycle
- [ ] Phase 11: Add depression free-text safety and escalation boundary
- [ ] Phase 12: Integrate remaining retained ADHD and depression modules
- [ ] Phase 13: Add agent-ready module executor interfaces
- [ ] Phase 14: Add component, integration, privacy, and accessibility tests
- [ ] Phase 15: Complete end-to-end verification and documentation

## Commits and Notes

- `ac9c5c6`: Baseline inherited from `origin/main`; 107 documented tests pass.
- `b727b62`: Established the Role 4 branch and baseline tracker.
- Phase 1: Replaced Role 4 ADHD/depression registry identities with need-based `support.*` IDs. Canonical IDs are `support.focus_session`, `support.task_breakdown`, `support.visual_timeline`, `support.mood_checkin`, `support.gentle_activity`, `support.grounding`, `support.cognitive_reframing`, `support.social_connection`, `support.evidence_journal`, `support.accountability_session`, and `support.soundscape`. `support.routine_support` has no dedicated retained ADHD/depression implementation; Visual Timeline declares `routine_support` as a supported need instead.
- Phase 1 safety decision: Void Whisper (`depression.void-whisper`) is not standardized or aliased until Phase 10 establishes its free-text safety and escalation boundary.
- Phase 1 commit: `refactor(role4): standardize support module definitions`.
- Compatibility: legacy feature IDs such as `adhd.task-breakdown` and `depression.mvh` resolve to their canonical `support.*` definitions. Existing routes and feature flags remain unchanged for Phase 2.
- Phase 2: `ADHDPage.jsx` is the sole `/adhd` landing page; its visible cards link to Visual Timeline, Task Breakdown, Focus Sessions, Mood Check-in, and Accountability Session. `ADHDDashboard.jsx` was merged and removed.
- Phase 2: `DepressionDashboard.jsx` is the `/depression` landing page; its visible cards link to Gentle Activity, Grounding, Social Connection, and Cognitive Reframing.
- Deferred: Soundscapes is hidden because checked-in audio assets and playback error handling are absent. Evidence Folder is hidden because it stores sensitive free text globally. Void Whisper is hidden pending Phase 10 free-text safety and escalation work.
- Phase 2 tests: navigation coverage was added for canonical landing pages, visible card routes, deferred modules, and feature resolution. `npm.cmd test` passed: 7 files, 115 tests.
- Phase 2 commit: `fix(role4): unify ADHD and depression navigation`.
- Phase 3: Added `src/support/execution/` with the public `executeSupportModule(request)` API, serializable request/result contracts, execution states, canonical placeholder executors, availability checks, safety checks, and start-lifecycle persistence.
- Phase 3 limitations: the executor does not render UI, invoke Role 1 or Role 2, complete or abandon sessions, reflect, write memory, or launch deferred Soundscape/Evidence Journal modules.
- Phase 3 tests: `src/test/supportExecution.test.js` covers validation, module IDs, availability, lifecycle start persistence, canonical module independence, and safety blocking. `npm.cmd test` passed: 8 files, 121 tests.
- Phase 3 commit: `feat(role4): add shared intervention executor`.
- Phase 4: Added public post-start lifecycle commands and `src/support/execution/useInterventionLifecycle.js`. Execution `running` maps to persisted `shown`/`started`/`in_progress`/`paused`; terminal execution states map to completed, partially completed, abandoned, cancelled, failed, or blocked behavior.
- Phase 4: Commands validate ownership, module identity, transitions, ratings, and idempotency. Completion persists outcomes only; no reflection, memory, evidence aggregation, Role 1 context processing, or Role 2 ranking is performed.
- Phase 4 tests: lifecycle command and hook coverage includes duplicate starts, progress, pause/resume, terminal states, ratings, wrong-user/module rejection, unmount behavior, and user switching. `npm.cmd test` passed: 10 files, 136 tests.
- Phase 4 commit: `feat(role4): complete intervention lifecycle boundary`.
- Phase 5: Task Breakdown now starts `support.task_breakdown` only through the shared execution API. Checklist generation is deterministic and local until an explicit start, first checked step, or timer start. Completion requires every step; replacement/discard abandons active unfinished work, while unmount and pre-start reset do not.
- Phase 5: Canonical outcomes contain aggregate step, configuration, timer, edit/reorder, and duration metrics only. Raw task and step text are not persisted. Missing `user.id` keeps the checklist local and displays a non-destructive sign-in message. Reflection and memory remain deferred to Phases 6 and 7.
- Phase 5 tests: added deterministic Task Breakdown service tests, component/lifecycle coverage for explicit and implicit start, completion, privacy, and unauthenticated local-only operation, plus hook reset coverage.
- Phase 6: Added the deterministic, explicit `reflectIntervention(intervention)` boundary under `src/support/reflection/`. It turns one completed, partially completed, or abandoned intervention into a versioned user-scoped reflection without adapting, ranking, recommending, writing memory, updating evidence, or notifying Role 2.
- Phase 6: Generic reflections cover completion, completion rate, duration category, engagement, satisfaction, and intervention quality. `support.task_breakdown` rules use only aggregate completion, timer, and edit metrics. The reflection store never copies raw task text, steps, feedback, conversation text, or PHI.
- Phase 6: Confidence is a deterministic 0-1 sum of available terminal status, completion rate, duration, rating, and recognized module-metric evidence. `docs/role4/reflection.md` documents the schema, rules, weights, privacy, and versioning.
