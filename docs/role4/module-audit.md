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

Final verification confirms the seven integrated rows above are the complete executable MVP set. Deferred availability is checked before adapter registry lookup so Soundscape returns `module_unavailable`, while truly unknown IDs return `unknown_module`.

## Home Card Contract

- Home cards resolve legacy module IDs to canonical support IDs before filtering and deduplication. The first candidate establishes deterministic order and the canonical registry supplies the title, description, and route.
- `adhd` is navigation-only and is never a support-tool card. Its child modules are represented individually.
- Aliases resolve as follows: Emotion Coach to Mood Check-in, Body Doubling to Accountability Session, Focus Sessions to Focus Session, MVH Protocol to Gentle Activity, Anxiety Dissolver to Grounding, Social Broadcaster to Social Connection, and Cognitive Reframer to Cognitive Reframing.
- Visual Timeline, Mood Check-in, and Accountability Session remain clearly labeled manual tools. They are not promoted to integrated Role 4 learning modules. Soundscape and unregistered/deferred free-text routes remain absent from home cards.
- Verification for this card contract: focused composition, navigation, and visible-language tests passed; full suite passed 49 files / 278 tests; production build passed. Lint remains blocked only by the existing parser error in `src/adaptive/context/jitaiService.js:118`.
