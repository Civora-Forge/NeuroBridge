# Integration Readiness

Role 1 may provide `userId`, `contextSnapshotId`, `planId`, `triggerSource`, `selectionMode`, and configuration. Execution preserves identifiers in intervention records without copying full context snapshots. Anonymous users do not create durable lifecycle or learning records. Post-intervention context comparison is not connected.

Role 2 may call `getSupportEvidence(userId, candidateModuleIds)` and provide a normalized plan containing the same identifiers and configuration. Role 4 does not rank candidates, select modules, or invent fallbacks; execution safety remains mandatory. Remaining adapter work is a Role 2-to-Role 4 plan invocation bridge and optional post-outcome context comparison.

The Role 2-to-Role 4 adapter is now available under `src/support/integration/`. Its compatibility aliases are limited to `planId|id` and `selectedModuleId|moduleId|selectedModule.id` until Role 2 publishes a canonical schema. Remaining work is optional post-outcome context comparison.

The completed MVP executable set is Task Breakdown, Focus Session, Gentle Activity, Grounding, Social Connection, Cognitive Reframing, and Evidence Journal. Visual Timeline, Mood Check-in, Accountability Session, and Soundscape are registered/deferred and must not be adaptively launched. Void Whisper remains blocked.

The optional Role 1 context-comparison boundary accepts caller-supplied snapshot IDs, timestamps, available emotion/activity summaries, and confidence. It excludes raw user input, conversation, profile, environment, history, and reasoning. Comparisons are observational and optional; no stable public Role 1 lookup or fresh-snapshot API exists, so live retrieval remains deferred.
