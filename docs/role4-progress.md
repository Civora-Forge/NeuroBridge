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
- [ ] Phase 1: Finalize ADHD and depression module contracts
- [ ] Phase 2: Align feature, module, and support registries
- [ ] Phase 3: Add shared module execution and lifecycle integration boundary
- [ ] Phase 4: Integrate ADHD Task Breakdown lifecycle and outcomes
- [ ] Phase 5: Implement reflection for canonical intervention outcomes
- [ ] Phase 6: Derive user-scoped memory from reflected outcomes
- [ ] Phase 7: Add memory-informed personalization hints
- [ ] Phase 8: Integrate ADHD Focus Sessions lifecycle and outcomes
- [ ] Phase 9: Restore depression dashboard routing and MVH lifecycle
- [ ] Phase 10: Add depression free-text safety and escalation boundary
- [ ] Phase 11: Integrate remaining retained ADHD and depression modules
- [ ] Phase 12: Add agent-ready module executor interfaces
- [ ] Phase 13: Add component, integration, privacy, and accessibility tests
- [ ] Phase 14: Complete end-to-end verification and documentation

## Commits and Notes

- `ac9c5c6`: Baseline inherited from `origin/main`; 107 documented tests pass.
- Pending: `chore(role4): establish implementation baseline`.
