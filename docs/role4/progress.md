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
- [x] Phase 7: Derive user-scoped memory from reflected outcomes
- [x] Phase 8: Add memory-informed personalization hints
- [x] Phase 9: Add support evidence API
- [x] Phase 10: Integrate Focus Sessions lifecycle and outcomes
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
- Phase 7: Added `src/support/memory/` as the public reflection-derived memory boundary. Its user-scoped APIs derive, inspect, tombstone-delete, clear by module, and control memory learning without exposing Role 4 persistence internals to UI callers.
- Phase 7: Memory records are versioned, evidence-backed, module-scoped, and inspectable. Two consistent reflections create 0.40 confidence, three to four create 0.65, and five or more create 0.85; each contradictory reflection deducts 0.10 up to 0.30. Unsupported reflection versions are ignored.
- Phase 7: Task Breakdown rules use aggregate completion, duration, timer, satisfaction, and sanctioned configuration metadata only. Reflection v1 does not normally expose selected style or step count, so those configuration-specific rules remain inactive until sanitized metadata is available. No ranking, Role 2 changes, UI personalization, or reflection changes were made.
- Phase 7 tests: added thresholds, conflict, idempotency, unsupported-version, user-scope, tombstone deletion, module clearing, learning-toggle, serialization, privacy, and Task Breakdown aggregate rule coverage. Commit: `2e1268f feat(role4): add reflection-derived memory system`.
- Phase 8: Added `src/support/personalization/` with `getPersonalizationHints(userId, moduleId)`, module-batch lookup, and a pure unintegrated advisory configuration resolver. Hints consume active user-scoped memory only and neither rank/select modules nor write memory, invoke Role 2, alter reflections, or change module UI defaults.
- Phase 8: Hints below 0.40 are omitted; 0.40-0.64 are observational; 0.65-0.84 are usable recommendations; 0.85+ are strong recommendations. All remain user-overridable. Conflicting values emit non-applicable `conflicting_evidence` hints rather than using the latest memory.
- Phase 8: Task Breakdown supports style, timer, partial-completion, high-step abandonment, low-satisfaction style, and low-helpfulness signals only where matching active sanitized memory exists. Reflection v1 normally lacks style and requested-step-count metadata, so those hint types are not invented.
- Phase 8 tests: added empty, disabled-learning, lifecycle-status filtering, confidence, conflict, determinism, user scope, Task Breakdown, privacy, serialization/schema, and pure resolver coverage. Commit: `0c7f8df feat(role4): add memory-informed personalization hints`.
- Phase 9: Added `getSupportEvidence(userId, candidateModuleIds)` under `src/support/evidence/`. It returns ordered, user-scoped historical evidence for each candidate without ranking, selecting, filtering, or creating plans.
- Phase 9: Completion uses completed plus half partial completions over starts. Effectiveness requires completed plus rating 4-5 or explicit strong quality. Evidence count is valid terminal v1 reflections; trend uses the last five reflected quality outcomes.
- Phase 9: Preferred configuration includes only usable/strong non-conflicting hints. Learning-disabled use returns lifecycle/reflection aggregates but omits hints and memory-derived configuration. Raw private text and context are never exposed. Commit message: `feat(role4): add support evidence API`.
- Phase 10: Focus Sessions now uses `support.focus_session` lifecycle start, milestone progress, pause/resume, natural completion, and explicit-reset abandonment while preserving its timer UI and `focusforge-streak` compatibility key.
- Phase 10 verification: feature `7cbc0a9`, lifecycle fix `c3c7d2d`, component coverage `0e589f8`, pipeline fix `b61ea77`, and cleanup `f32aa72`. Focused Focus Session suite passed: 3 files / 11 tests. Full suite passed: 19 files / 180 tests. Focus test numeric-separator parser errors were corrected. Lint remains blocked only by existing `src/adaptive/context/jitaiService.js:118`. Known limitation: `preferredBreakMinutes` remains unavailable because Reflection v1 does not expose break-duration evidence.
- Gentle Activity complete: implementation `c4f7866`, lifecycle coverage `43c8bb7`, learning pipeline `2c5661c`, and service coverage `1d206b7`. Focused suite passed: 3 files / 8 tests. Full suite passed: 22 files / 188 tests. Lint remains blocked only by existing `src/adaptive/context/jitaiService.js:118`. Known limitation: preferred pacing requires future sanitized reflected configuration evidence.
- Safety/privacy boundary complete: feature `dac153b`; focused gateway/execution verification passed 2 files / 7 tests and full suite passed 24 files / 195 tests. Lint remains blocked only by existing `src/adaptive/context/jitaiService.js:118`. Raw sensitive text is blocked from ordinary Role 4 persistence. Deferred modules remain Cognitive Reframing, Evidence Journal, Grounding, Social Connection, and Void Whisper.
- Grounding complete: focused suite passed 3 files / 3 tests and full suite passed 27 files / 198 tests. It uses structured timer and confirmed-technique lifecycle events without free-text persistence. Lint remains blocked only by existing `src/adaptive/context/jitaiService.js:118`.
- Social Connection complete: focused suite passed 3 files / 3 tests and full suite passed 30 files / 201 tests. Lint remains blocked only by existing `src/adaptive/context/jitaiService.js:118`. It prepares built-in templates locally, requires explicit confirmation to complete, and never sends messages or persists template, contact, clipboard, or conversation content. Commit: `feat(role4): integrate social connection learning pipeline`.
- Cognitive Reframing complete: focused suite passed 3 files / 5 tests and full suite passed 33 files / 206 tests. Lint remains blocked only by existing `src/adaptive/context/jitaiService.js:118`. Sensitive text passes through the safety gateway; blocked input creates no ordinary records; lifecycle persists structured stages only. Clipboard copy excludes original text by default and supports explicit local-only opt-in. Commit: `feat(role4): integrate cognitive reframing learning pipeline`.
- Evidence Journal complete: focused suite passed 4 files / 4 tests and full suite passed 37 files / 210 tests. Lint remains blocked only by existing `src/adaptive/context/jitaiService.js:118`. Journal content is isolated in a dedicated authenticated user-scoped store; anonymous entries remain ephemeral; legacy `evidence-folder-v1` is not migrated. Lifecycle records only aggregate save/delete/category metrics and optional ratings. Commit: `feat(role4): complete evidence journal integration`.
- Audit readiness: canonical Evidence Journal executor registration was aligned with its completed UI/lifecycle integration. `module-audit.md` and `integration-readiness.md` document deferred modules and Role 1/Role 2 adapter gaps.
