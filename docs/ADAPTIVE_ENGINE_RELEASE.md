# Adaptive Engine — Release Readiness (Tasks 1–6)

Branch: `adaptive-engine-release`. This document describes what ships, what is
switched on in production, where data lives, how safety is enforced, and how
to roll forward or back.

## 1. Architecture

```
ContextSnapshot (Role 1)
  → buildUserState            backend/adaptive/state          normalized dimensions + confidence + staleness
  → evaluatePolicies          backend/adaptive/reasoning      Task 1: evidence-gated (stale/weak evidence suppressed)
  → applyLearnedPreferences   engine/learning.js              Task 4: bounded (±0.15) supporting evidence
       (+ profile evidence)   engine/personalization.js       Task 5: explicit preferred modes > live feedback > promoted stances
  → stabilizeCandidates       engine/hysteresis.js            Task 2: confirmation windows, holds, withdrawals
  → module restrictions → conflict resolution (D4)
  → D14 preferences           engine/preferences.js           explicit requests / restrictions (Tier 2–4)
  → profile constraints       engine/personalization.js       Task 5: avoided modes removed, calmer-only shaping
  → safety gate               engine/safetyGate.js            ALLOW / MODIFY / BLOCK / ESCALATE (fails closed)
  → hysteresis stage → planner → DecisionTrace
  → resolvePlanExecution      src/adaptive/execution          Task 3: flag, safety, consent, reducedIntensity
  → AdaptiveUIRuntime         src/components/adaptive         applies effective UI mode; support cards; feedback capture
```

Live wiring: `App.jsx` mounts `AdaptiveRuntimeProvider` (route → module,
user, D14 fragment, personalization profile) and `AdaptiveUIRuntime`.

Precedence (lower tier wins): Safety (1) › explicit request (2) › explicit
restriction (3) › explicit preference (4) › goals / module / task › current
state (8) › learned (9). Learned and profile influence only ever touch tier
≥ 8 candidates.

## 2. Feature flags (build-time, `import.meta.env`)

| Flag | Production (`.env.production`) | Effect |
|---|---|---|
| `VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME` | `true` | Engine decides on every context change; traces produced; support-card offers shown. |
| `VITE_NEUROBRIDGE_ADAPTIVE_REFLECTION` | `true` | Learned feedback + promoted profile stances used as supporting evidence; feedback promotion runs. |
| `VITE_NEUROBRIDGE_ADAPTIVE_UI_EXECUTION` | **unset → OFF** | UI adaptations are **not applied** in production. |

**What production actually does today:** decisions are computed and traced,
offers (support cards) are shown and their feedback is learned, explicit
personalization preferences are honoured for offers (e.g. "no unrequested
offers"). **No adaptive UI mode change (low-stimulation, focus, simplified,
guided) is applied**, and no consent prompt is ever shown *for a UI
adaptation*, because `resolvePlanExecution` rejects every UI action while the
flag is off (covered by `releaseHardening.test.jsx`). Do not describe
production as "adapting the UI" until Stage C is on.

**Consent prompts DO appear in production for module-owned (non-UI)
adaptations in CAUTION modules.** The `uiExecution` flag gates UI actions
only. On a CAUTION module route (e.g. `support.grounding`,
`support.cognitive_reframing`, `anxiety.hub`), the module's own policies
(TASK / PACING / CONTENT / …) are marked `requireConfirmation` by the safety
gate, and `AdaptiveUIRuntime` asks *"Apply "…" to this activity?"*. A grant is
stored in the shared execution store and applied by that page's
`useModuleAdaptation` consumer, with the action's parameters intact
(`reducedIntensity` reshapes UI actions only). Covered by
`releaseHardening.test.jsx` ("a real CAUTION module still asks consent for
module-owned actions").

Support offers are surfaced only when the plan carries a state-driven action
(Tier 1 safety or Tier ≥ 8 current-state / learned); an explicit preference
action alone (e.g. `accessibility.reduceMotion`, Tier 4) never surfaces an
offer.

### Why Stage C stays off (blocker)

1. Flags are inlined at build time, so enabling it is all-or-nothing for
   every user of a build; there is no per-user cohort or runtime kill switch.
2. The live rendering effect of each UI mode has been verified by component
   tests only, not in a real browser session against production data.
3. Execution outcomes are recorded in an in-memory ledger only; there is no
   production telemetry to detect a bad rollout.

### Controlled rollout of Stage C (when the blockers are addressed)

1. Staging: build with `VITE_NEUROBRIDGE_ADAPTIVE_UI_EXECUTION=true`
   (`npm run build -- --mode staging` with a `.env.staging`, or a staging
   hosting target), verify each mode in a browser, including consent prompts
   (CAUTION modules) and reduced intensity.
2. Add a per-user cohort gate (e.g. allowlist / hashed-id percentage) in
   `featureFlags.js` before enabling for real users; start with internal
   accounts.
3. Production: add `VITE_NEUROBRIDGE_ADAPTIVE_UI_EXECUTION=true` to
   `.env.production`, `npm run build`, `firebase deploy --only hosting`.

### Rollback (any flag)

1. Set the flag to `false` (or delete the line) in `.env.production`.
2. `npm run build`
3. `firebase deploy --only hosting --project <project-id>` (see
   `deploy/redeploy.ps1`), or roll back to the previous release in the
   Firebase Hosting console (fastest; no rebuild).

Turning `RUNTIME` off makes the whole adaptive layer inert (no decisions, no
offers). Turning `REFLECTION` off stops learned influence and promotion;
explicit preferences keep working. Stored data is unaffected by rollback.

## 3. Persistence boundaries

| Data | Where | Scope | Cleared by |
|---|---|---|---|
| Feedback events (Task 4) | localStorage `nb_role4:v1:<user>:adaptation_feedback` (memory fallback) | device, per user; max 300 events, 14-day half-life | sign-out wipe, "Reset learned", "Reset everything", "Delete all my data" |
| Personalization profile (Task 5) | localStorage `…:adaptive_profile` + Supabase `support_personalization_profiles` (RLS, one row per user, cascade on account deletion) | device + account | sign-out wipes the device copy; resets sync to all devices; "Delete all my data" deletes the row |
| Temporary "for now" state | memory only | tab session | reload, sign-out |
| Behavioural baseline (context-to-state inference) | localStorage `…:behavioural_baseline` (memory fallback) | device, per user; numeric aggregates per activity type only (no states, labels or events); never updated while a temporary state or self-reported distress is active | sign-out wipe, "Reset everything", "Delete all my data" |
| Interaction evidence + self-reports | memory only (`src/adaptive/context/interactionEvidence.js`) | tab; 15-min window (self-reports 60 min) | reload, user switch, sign-out |
| Consent decisions / offer dismissals | sessionStorage `neurobridge.adaptive.execution.v1` | tab session, **bound to one user** (Task 6), ≤ 200 entries, expired pruned | user switch, sign-out |
| Hysteresis state | memory, keyed `user|module|target` (app-level path) and `user@module:<id>|module|target` (each `useModuleAdaptation` path), ≤ 10 000 entries, idle-pruned | tab session | sign-out (all scopes of the user) |

Cross-device sync works only for authenticated Supabase users **after the
migration `20261120000000_adaptive_personalization_profiles.sql` is applied**;
until then the client detects the missing table and stays device-local. Demo
and Firebase-only identities are device-local by design.

## 4. Safety behaviour

- Missing, stale, malformed or out-of-range evidence never triggers an
  adaptation; evidence below the supporting floor (0.25) also cannot *hold*
  an active adaptation (Task 6 fix).
- The safety gate runs after every preference/personalization stage; BLOCK /
  ESCALATE remove the action, and a BLOCK/ESCALATE decision suppresses every
  non-Tier-1 adaptation and every offer at execution time.
- Profiles can never suppress or reduce `critical_urgency` /
  `overwhelm_simplification`; learning never promotes "avoid" for them.
- Explicit user choices (D14 restrictions, profile avoidances) always beat
  learned signals; learning never writes explicit preferences.
- `requireConfirmation` adaptations wait for explicit consent; consent is
  per user and never carries over to another user in the same tab.
- `reducedIntensity` keeps only protective motion/colour flags on UI actions;
  module-owned (non-UI) actions keep their parameters.
- The app-level runtime and each module-level `useModuleAdaptation` path keep
  separate hysteresis state (`decide` option `stateScope`), so one path's
  snapshot cannot advance or reset the other's confirmation windows.
- Scheduled re-evaluations: one timer, delay clamped to 1 s – 10 min, at most
  12 refreshes per minute.
- Engine or input failures fall back to the baseline UI (no stale adaptation).

## 4a. Context-to-state inference

One shared, module-aware inference layer (`backend/adaptive/state/contextualInference.js`,
`activityProfiles.js`) infers temporary, non-clinical states — cognitive overload,
frustration, attention fragmentation, cognitive fatigue — from timestamped evidence
(corrections, undo, task lifecycle outcomes, response latency, typing rhythm,
navigation and window switching, scroll backtracks), read relative to the user's
behavioural baseline where one exists. Explicit check-ins are a separate
self-report channel. A state needs converging evidence from independent sensor
families (or a persistent, activity-specific primary signal) to reach the 0.5
trigger floor; evidence decays and states expire. The states feed five policies
(`CONTEXTUAL_POLICIES`) on non-UI targets with per-module hysteresis; existing
evidence, safety, consent and execution gates are unchanged.

Evidence is recorded once and attributed to the active route's module;
the app-level runtime reads the merged view and each page-level
(`useModuleAdaptation`) path reads only its own module's view, decided in its
own hysteresis scope. Signal sources: DOM interaction (tracker), the support
lifecycle hook, failed emotion-decoder attempts, chat clarification requests
(a local phrase check — only a count is kept, never the text), and explicit
self-reports from the mood check-in and the anxiety reset "How are you
feeling now?" (better / worse only). The frustration response opens a
dedicated `contextual_help` intervention with its own dismissal lifecycle.

**Behaviour change:** page navigation alone (task-switch rate, the complexity
derived from it, the page's activity name) is one sensor and is capped below
the trigger floor, so a single page switch no longer enters guided /
minimal / focus mode or surfaces an offer. Converging contextual evidence
(e.g. switching plus window interruptions) lifts the cap for an agreeing value.

**Behaviour change:** a mood produced only by a pointer-movement burst (mood
`basis: "interaction"`) is no longer read as an emotion; it is weak corroborating
evidence only. A burst alone therefore no longer produces a low-stimulation
adaptation or a support offer.

## 5. Known limitations

- Stage C (UI execution) is off in production (see §2).
- Cross-device sync is unverified against the live Supabase project; needs
  the migration applied. Field conflicts resolve by device clock.
- `/api/privacy/export` does not include the personalization profile
  (Supabase-native table); deletion does (client-side, before sign-out).
- Profile edits made offline and not yet synced are lost if the user signs
  out first (sign-out wipes local data by design for shared devices).
- Task 4 feedback history is device-local; only promoted stances travel.
- Two open tabs reconcile only on the next load or write.
- Pre-existing failing tests unrelated to the adaptive engine:
  `src/test/AgentChatVoice.test.jsx` (1), `src/test/TaskBreakdownLifecycle.test.jsx` (3);
  pre-existing lint parse errors in `src/adaptive/context/moodAgent.js` and
  `src/test/moodAgentInteraction.test.js`.
- Backend (Python) tests need `google-genai` installed to import
  `backend/main.py`.
