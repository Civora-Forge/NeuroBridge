# Role 2 Adaptation Plan Adapter

Role 2 owns planning, ranking, selection, and fallbacks. Role 4 only normalizes a supplied plan and executes its selected module through existing safety and availability checks.

The repository has no canonical Role 2 plan schema. The adapter accepts `planId` or `id`, and `selectedModuleId`, `moduleId`, or `selectedModule.id`. This is compatibility mapping only; it does not import Role 2 planning code or rank candidates.

Normalized plans preserve plan/user/context IDs, selected module, target needs, reason codes, trigger source, selection mode, configuration, alternatives, fallbacks, safety, confidence, and explanation. Explicit requests and adaptive plans execute only the declared selected module. Unavailable modules return `module_unavailable`; fallbacks are returned unchanged and never executed automatically. Safety is delegated to `executeSupportModule()`. Full context snapshots and reasoning traces are not passed to persistence. `getSupportEvidence()` is exported from the integration boundary.
