# Module Audit

| Module | Route | Safety | Executor | Lifecycle/UI | Privacy | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `support.task_breakdown` | `/adhd/breakdown` | structured low risk | registered | complete on all steps | aggregate only | integrated |
| `support.focus_session` | `/adhd/focus` | structured low risk | registered | timer completion/reset abandon | aggregate only | integrated |
| `support.gentle_activity` | `/depression/mvh` | structured low risk | registered | explicit steps | aggregate only | integrated |
| `support.grounding` | `/depression/anxietydissolver` | grounding support | registered | confirmed techniques | aggregate only | integrated |
| `support.social_connection` | `/depression/social` | social action | registered | explicit plan confirmation | no templates/clipboard retained | integrated |
| `support.cognitive_reframing` | `/depression/reality` | sensitive free text | registered | explicit confirmation | raw text ephemeral | integrated |
| `support.evidence_journal` | `/depression/evidence` | sensitive free text | registered | explicit session completion | isolated user-scoped journal store | integrated |

Deferred: Visual Timeline and Mood Check-in are registered-only with no canonical Role 4 lifecycle/learning completion. Accountability Session is experimental only: it has no peer or external accountability service and must not claim live body-doubling. Soundscape is unavailable for missing verified assets. All four return `module_unavailable` from public execution. Void Whisper is hidden, unregistered, and blocked from ordinary execution.
