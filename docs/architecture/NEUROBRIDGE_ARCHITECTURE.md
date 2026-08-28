# NEUROBRIDGE — SOURCE-GROUNDED ARCHITECTURE (Presentation Pack)

**How to read this document:** every claim is grounded in a real file path + function/component name. Each component is classified in one of six states:

- **IMPLEMENTED** — real source exists
- **TESTED** — covered by automated tests (counts included)
- **RUNTIME-WIRED** — connected in a production code path (App.jsx → …)
- **PARTIALLY IMPLEMENTED** — some parts exist/wired, others missing
- **DORMANT/LEGACY** — implemented & tested but no production caller, or superseded
- **PLANNED** — designed/documented, not implemented

> **One correction up front (based on source, not docs):** the README describes a Flask backend. **There is no Flask backend.** Everything runs in the browser. The folder `backend/adaptive/` is deliberately *named* `backend` but is frontend JavaScript, imported through the Vite alias `@backend` (`vite.config.js`). "Backend" here means *decision engine code that runs client-side*.

---

## PART 1 — WHAT IS NEUROBRIDGE?

**NeuroBridge** is a **browser-based adaptive neurodivergence support platform** — a single-page React application that (a) personalizes *which* support modules a user gets via an onboarding questionnaire, and (b) continuously perceives in-browser user state and *adapts the experience* (pacing, difficulty, hints, UI stimulation) through a multi-stage decision engine. It covers OCD, ADHD, Dyslexia, Dyscalculia, Dyspraxia, ASD, Anxiety, Depression, and APD.

| Concern | Truth (source) |
|---|---|
| Frontend | React 18 + Vite 5 (`package.json`), JSX + Tailwind CSS, shadcn/ui components (`src/components/ui/`), framer-motion, lucide-react, react-router v6 (`BrowserRouter` in `src/App.jsx:459`) |
| Backend | **None (no HTTP server).** Decision engine is client-side JS under `backend/adaptive/` (alias `@backend`). External REST calls exist for **Gemini** (`src/adaptive/context/conversationAgent.js` → `callGeminiForAnalysis`, 4 s AbortController + heuristic fallback) and separate API tools (`API_BASE_URL` config) |
| Database | **Dual-stack:** `localStorage` is authoritative in practice (`nb_auth`, `nb_role4:v1:<id>:<collection>`, …); **Supabase** client exists (`src/lib/supabaseClient.js`, tables `support_interventions`, `support_lifecycle_events`, `support_outcomes`, dyslexia tables, auth) but **its env vars are not present in any active `.env` file** (only `.env.example`), so at runtime it degrades to local |
| Authentication | **Dual-track.** Real Supabase calls exist (`signInWithPassword`, `signUp`, `onAuthStateChange`) but the practical path is `MOCK_USERS` + `localStorage` in `src/context/AuthContext.jsx:87–114`; roles: `user`, `guardian`, `support`, `admin` |
| Layers | Auth/profile → Feature gating → Onboarding/personalization → **Role 1** Context & Perception → **Role 2** Adaptive Intelligence → **Role 3** Adaptive UI / interventions → **Role 4** Support modules & Outcomes |
| Conditions/modules | 9 hubs; feature keys in `src/lib/featureRegistry.js` (`FEATURES`, ~45 keys); ~24 support-module definitions in `src/support/framework/supportModuleRegistry.js` |
| Adaptive architecture | A 10-stage decision pipeline: `COLLECT → REASON → POLICY → CONFLICT → PREFERENCE → SAFETY → HYSTERESIS → PLAN → TRACE` in `backend/adaptive/engine/adaptiveEngine.js` (`decide()`, verified at line 318) |
| Support/intervention architecture | Role 4 registry + eligibility/safety + lifecycle (`src/support/framework/*`, `src/support/lifecycle/*`); navigation executed in-app (no server orchestration) |

### High-level architecture (verified order)

```
User
  ↓  (login: MOCK_USERS / Supabase → localStorage "nb_auth")
React Application  (App.jsx — QueryClient → Auth → Tooltip → Router)
  ↓
Authentication / Profile  (AuthContext — disorders, enabledModules, hasFeature)
  ↓                     ⇩ feature gating drives routes (ProtectedRoute) & sidebar (AppLayout)
Onboarding  (DisorderSelection → OnboardingFlow → selectModulesForUser → enabledModules)
  ↓
Context & Perception (Role 1)  (ContextProvider → contextEngine → contextStore → ContextSnapshot)
  ↓
Adaptive Intelligence (Role 2) (useAdaptiveBehavioralEngine → adaptiveEngine.decide())
  ↓
UI Adaptation / Support (Role 3) (AdaptiveUIRuntime; InterventionResolver; module cards)
  ↓
Outcome Tracking / Persistence (Role 4) (role4Store, nb_role4:*; anxiety nb_anxiety_outcomes_*)
  ↓
Future adaptation consumes evidence  (reflection & Tier-9 learning — PLANNED/DORMANT, flag OFF)
```

---

## PART 2 — FRONTEND ARCHITECTURE

### Bootstrap & provider hierarchy (exact nesting, `src/App.jsx`)

```
App.jsx:453
 └─ QueryClientProvider            (@tanstack/react-query)
    └─ AuthProvider                 (src/context/AuthContext.jsx)
       └─ TooltipProvider           (shadcn)
          ├─ <Toaster />, <Sonner />
          └─ BrowserRouter          (react-router)
             ├─ /login*             (public)  Login, LoginUser, LoginGuardian, LoginSupport
             ├─ /onboarding/disorders  (ProtectedRoute, no feature)
             └─ /* → ShellRoutes (App.jsx:77)
                  └─ ContextProvider             (src/context/ContextProvider.jsx)
                     └─ AdaptiveRuntimeProvider    (src/components/adaptive/adaptiveRuntimeContext.jsx)
                        └─ AdaptiveUIRuntime        (src/components/adaptive/AdaptiveUIRuntime.jsx)
                           └─ AppLayout              (src/components/AppLayout.jsx → sidebar + main)
                              └─ <Routes>            (all module routes)
                     └─ <ContextInspector />        (dev-only, context debug)
```

**Global state:** QueryClient, Auth state (user/role/disorders/enabledModules/hasFeature), live ContextSnapshot (`useContextState`/`useContextStateOptional`). **Module-specific state:** each page owns local state; the anxiety engine owns its pipeline; OCD uses a zustand store (`useOcdStore.js`, in-memory only).

**Key hooks that expose each system:**

| System | Hook | File |
|---|---|---|
| Auth/profile/features | `useAuth()` → `{user, disorders, enabledModules, hasFeature}` | `src/context/AuthContext.jsx` |
| Live context snapshot | `useContextStateOptional()` | `src/context/ContextProvider.jsx` |
| Global adaptive engine | `useAdaptiveRuntime()` | `src/components/adaptive/adaptiveRuntimeContext.jsx` |
| Module-scoped adaptation | `useModuleAdaptation()` | `src/hooks/useModuleAdaptation.js` |
| Raw engine (hook-level) | `useAdaptiveBehavioralEngine()` | `src/hooks/useAdaptiveBehavioralEngine.js` |
| Support-module launch | `executeAdaptationPlan()` | `src/support/integration/adaptationPlanAdapter.js` |

**Routing status:** every module route is wrapped in `<ProtectedRoute feature={FEATURES.X}>` (`src/App.jsx:130–440`). The sidebar is built by `USER_NAV.filter(item => item.featureKey === null || hasFeature(item.featureKey))` (`src/components/AppLayout.jsx:45`).

---

## PART 3 — AUTHENTICATION & USER PROFILE

**Flow:** `LoginUser.jsx`/`Login.jsx` → `AuthProvider` (`signInWithPassword` if Supabase configured, else `MOCK_USERS`) → merged user profile → onboarding gate.

- **Where identity comes from:** `MOCK_USERS` (`AuthContext.jsx:87`) — e.g. `nb-user-042` (Arun Kumar), plus real Supabase auth path (`buildProfileFromSupabase`, `AuthContext.jsx:7–27`).
- **Where disorders are stored:** `user.disorders` (array of `DISORDERS` ids). **enabledModules:** `user.enabledModules` (array of module ids). Both persisted in localStorage key **`nb_auth`** (whole merged object) and mirrored in **`nb_prefs_<userId>`** (`AuthContext.jsx` updates at lines ~513/521/535/543).
- **localStorage vs Supabase:** writes go to localStorage only; Supabase `user_metadata` is write-once registration fields that get **merged over** by localStorage on each login (`{...profile, ...persisted}`).
- **How profile reaches downstream:** `resolveEnabledFeatures({disorders, enabledModules})` (`src/lib/featureRegistry.js:313`) builds an `enabledFeatures` Set exposed as `hasFeature`; enforced at **route level** (`ProtectedRoute`) and **render level** (`FeatureGate`), and read by `AppLayout`, `Home`, `Index.jsx`, ADHD landing, plus `ContextProvider.syncProfile` feeds the context engine.
- **How disorders affect the app:** they unlock features via `FEATURE_REGISTRY[key].disorders` intersect (`featureRegistry.js`), and gate intervention eligibility via `checkModuleEligibility` (`src/support/framework/interventionSelection.js:130`).

---

## PART 4 — ONBOARDING & PERSONALIZATION

**This is initial personalization, not runtime adaptation.** Evidence: `selectModulesForUser` has exactly **one production call site** — `src/components/OnboardingFlow.jsx` — and `tagProfile` is stored but **never re-consumed** to re-select modules.

**Flow (verified):**
```
Challenge cards (Modular: src/data/modulesRegistry.js CHALLENGE_CATEGORIES)
  → Questionnaire (src/components/Questionnaire.jsx; answers = {[questionId]: optionText})
  → questionsRegistry (src/data/questionsRegistry.js, 515 lines; option.tagScores; Often→+2, Sometimes→+1)
  → buildTagScores (backend/adaptive/reasoning/questionEngine.js + moduleSelector.js)
  → scoreModules via sharedModuleScorer.scoreModule = Σ(tagScores[tag]) over module.tags
  → keep score ≥ THRESHOLD(2); enforce MIN_MODULES(2) / MAX_MODULES(8)
  → ensureChallengeCoverage(...) — one module per selected challenge
  → selectModulesForUser returns {enabledModules, tagProfile(userTags), ...}  (moduleSelector.js:93)
  → DisorderSelection.handleComplete → updateDisorders() + updateUser({enabledModules, tagProfile, onboardingResponses, onboardingVersion:"adaptive-v2"})
  → navigate("/")
```
`Home.jsx` renders `composeHomeModules(enabledModules)` (`src/data/modulesRegistry.js`) into `ModuleCard`s. Later edits happen **only** in `UserSettings.jsx` ("My Support Plan" manual toggles → reconstructs `disorders` inversely via `deriveDisordersFromModules`).

> **Flag for your talk:** two independent module registries exist and do not feed each other — `src/data/modulesRegistry.js` (used by onboarding) and `backend/adaptive/reasoning/disorderFeatureRegistry.js` (`SUPPORT_MODULE_REGISTRY`, used by UserSettings/interventionRanking). `onboardingVersion:"adaptive-v2"` is written but never read.

---

## PART 5 — ROLE 1: CONTEXT & PERCEPTION

Layer directory: `src/adaptive/context/`. **There is no `backend/adaptive/context/`** — state reasoning under `backend/adaptive/state/` is the *consumer*.

- **Coordinator:** `contextEngine.js` — `init()`, `ingestSignal(rawSignal, options)`, `trackNavigation()`, `processUserMessage()`, `getLatestContext()`, subscribable event bus.
- **Store:** `contextStore.js` — in-memory singleton `UnifiedContextObject` (6 dims: profile, activity, mood, conversation, environment, session + metadata/sourceMap/stalenessFlags). Session-scoped, **no persistence**.
- **Validation:** `signalValidator.js` — LRU dedup (5 s), freshness TTL decay, conflict detection.
- **Fusion:** `contextFusion.js` — `fuseContext()` → staleness flags, per-dimension confidence, overall confidence, material-change detection.
- **Signal producers:** `activityTracker.js`, `environmentContext.js`, `sessionTracker.js`, `conversationAgent.js` (Gemini + heuristic fallback), `moodAgent.js` (priority hierarchy: explicit ≥1.0 → conversation ×0.85 → activity → previous mood ×0.6 decay), `contextInteractionTracker.js`.
- **Public contract:** `contextSnapshot.js` (JSDoc typedef: `snapshotId, userId, timestamp, profile, activity, environment, conversation, mood, session, behavior, deviceInteraction, explicitRequests, biometrics, overallConfidence` + legacy aliases `emotion, task, userInput`).
- **Adapter:** `contextSnapshotAdapter.js` — `toContextSnapshot(unifiedContext, options)` maps the 6 fused dims from the store AND injects live `behavior/deviceInteraction/explicitRequests/biometrics` straight from `contextInteractionTracker.getInteractionSnapshot()`.
- **React bridge:** `src/context/ContextProvider.jsx` — initializes engine, starts interaction tracking, listens `CONTEXT_UPDATED`, exposes `{context, lastUpdated, processUserMessage, refreshContext, isReady}` via **`useContextState`/`useContextStateOptional`**.

**Why two representations:** `UnifiedContext` (store) holds only fused, "clean" dimensions; the **public `ContextSnapshot`** adds live, un-fused interaction telemetry (behavior/deviceInteraction/explicitRequests) plus a stable snapshot envelope. Downstream (Role 2) consumes **only** the snapshot, never the store — the adapter is the boundary.

---

## PART 6 — WHAT CONTEXT DOES ROLE 1 ACTUALLY COLLECT?

| Signal | Source | Implemented? | Used downstream? | Freshness |
|---|---|---|---|---|
| Mood | `moodAgent.inferMood()` | ✅ strong | Yes — `normalizeContextSnapshot` (emotion) | per event |
| Energy | derived in Role 2 (`inferEnergyLevel`: emotion+sessionDuration+timeOfDay) | ✅ derived | Yes | — |
| Cognitive load | derived in Role 2 (emotion+taskSwitchRate+complexity) | ✅ derived | Yes | — |
| Attention | derived in Role 2 (`taskSwitchRate`+engagement+hasActiveTask) | ✅ derived | Yes | — |
| Stress | derived in Role 2 (emotion map + biometrics if present; biometrics null) | ✅ partial | Yes (weak without biometrics) | — |
| Sleep quality | ❌ not collected | ❌ | ❌ | — |
| Motivation | derived in Role 2 (engagement) | ✅ derived | Yes | — |
| Intent | `conversationAgent.extractExplicitRequest()` + `explicitRequests` | ✅ | Yes | per message |
| Urgency | conversation urgency / explicitRequest priority | ✅ | Yes | per message |
| Current activity | `activityTracker.trackActivity()` | ✅ strong | Yes | live |
| Navigation | `trackNavigation` → repeated navigation, taskSwitchFrequency | ✅ | Yes | live |
| Keyboard | `keydown` + `beforeinput` (typingSpeed, pauses, correctionRate) | ✅ | Yes | live |
| Scrolling | `scroll` (passive): direction/distance/speed; readingSpeed (reader) | ✅ | Yes (readingSpeed) | live |
| Pointer/mouse | **`pointerdown` only**, generic interaction counting/latency | ✅ minimal | marginal | live |
| Clicking | ❌ no dedicated `click` handler | ❌ | ❌ | — |
| Mouse-move distress | ❌ **does not exist** | ❌ | ❌ | — |
| Focus/blur | window `focus`/`blur` → focus interruptions | ✅ | Yes | live |
| Task switching | `taskSwitchFrequency` (unique navigations/5 min) | ✅ | Yes | live |
| Time on task | sessionDuration + timeSinceLastInteraction | ✅ | Yes | live |
| Conversation | Gemini REST + heuristic; zod-validated | ✅ | Yes | per message |
| Environment | timeOfDay, dayOfWeek, online, device/browser/screen, **battery** (`navigator.getBattery`) | ✅ | Yes (timeOfDay) | live |
| Session | `sessionTracker` (duration, navHistory ≤50) | ✅ | Yes | live |
| biometrics (HRV/EDA) | `jitaiService.js` = **mock**; `getInteractionSnapshot()` hardcodes **`biometrics: null`** | ❌ never populated | ❌ | — |
| `hasReducedMotion` / prefer-reduced-motion | typed in snapshot, **never written** | ❌ | ❌ | — |
| taskCompletion/Abandon counts | typed in `ActivitySignal`, no producer | ❌ | ❌ | — |

**Strong enough to drive adaptation today:** mood, activity, task-switching, scroll/reading, typing, navigation, environment time-of-day, conversation intent, explicit requests, interaction latency. **Biometrics and mouse-move distress detection are not real** — say so clearly if asked.

---

## PART 7 — ROLE 2: ADAPTIVE INTELLIGENCE (deep dive)

Entry point: **`adaptiveEngine.decide(input, options)`** (`backend/adaptive/engine/adaptiveEngine.js`). The **verified** pipeline order:

```
Input (ContextSnapshot [+ role4Signals, userPreferences, moduleContext])
 1 COLLECT    validateAdaptiveEngineInput; buildUserState(snapshot) if absent
 2 REASON     reasonAboutUserState(userState)  → ReasoningResult
 3 POLICY     evaluatePolicies([...ADAPTATION_POLICIES, ...modulePolicies], policyState)
              + recommendFocusConfiguration(supportEvidence) + applyRestrictedDimensions
 4 CONFLICT   resolveConflicts(…)
 5 PREFERENCE runPreferenceStage(…, applyUserPreferences)
 6 SAFETY     runSafetyStage(…, safetyGate)     [reuses assessSupportSafety]
 7 HYSTERESIS runHysteresisStage(…)
 8 PLAN       buildAdaptationPlan({reasoning, triggeredRules, userState, moduleContext})
 9 TRACE      validateDecisionTrace(...)
10 (optional) options.persistTrace(trace)  — fire-and-forget, never awaited
```

**Guarantees (tested):** deterministic (injected `now`), never mutates input, flag-free (direct-callable), produces `{plan, trace}`.

### Component table

| Component | Purpose | Input | Algorithm | Output | File | Caller | Runtime | Tests |
|---|---|---|---|---|---|---|---|---|
| `adaptiveEngine.decide` | orchestrate all stages | input+options | 10-stage pipeline | `{plan, trace}` | `engine/adaptiveEngine.js:318` | hook + tests | ✅ wired | 34 it /96 |
| `normalizeContextSnapshot` | interpret snapshot→normalized signals `{value,confidence,source,contributors}` | ContextSnapshot | field mapping + derived engagement | `NormalizedSignals` | `state/snapshotNormalizer.js` | `buildUserState` | ✅ | included |
| `buildUserState` | snapshot→9-dim UserState | snapshot | 9 inference fns + confidence | UserState (bw-compat proxy) | `state/userStateModel.js` | `decide` COLLECT | ✅ | 46 it /70 |
| `reasonAboutUserState` | state→situation/needs/strategy | UserState | SITUATION_REGISTRY match, priority sort | ReasoningResult | `reasoning/cognitiveReasoning.js` | `decide` REASON | ✅ | 32 it /96 |
| `evaluatePolicies` | apply policy rules | UserState + modulePolicies | trigger-groups GTE/LTE/EQ/IN/NOT_IN | triggered entries | `reasoning/adaptationPolicy.js` | `decide` POLICY | ✅ | 36 it /65 |
| `resolveConflicts` | per-target dedup | candidate entries | precedence tie-break | `{kept,rejected,conflicts}` | `engine/conflictResolution.js` | `decide` CONFLICT | ✅ | 15 it /29 |
| `applyUserPreferences` | inject/restrict user prefs | entries + userPreferences | requested→Tier2, restricted→Tier3, accessibility→Tier4 allowlist | entries+overrides | `engine/preferences.js` | `decide` PREFERENCE | ✅ | 20 it /82 |
| `safetyGate` | safety filter | entry + module metadata | `assessSupportSafety` + module floor, fail-closed | SafetyResult ALLOW/MODIFY/ESCALATE/BLOCK | `engine/safetyGate.js` | `decide` SAFETY | ✅ | 11 it /40 |
| `runHysteresisStage` | anti-oscillation | entries + clock | activate/sustain/deactivate/cooldown per thresholds | `{kept,rejected,nextReEvaluateAt}` | `engine/hysteresis.js` | `decide` HYSTERESIS | ✅ | 9 it /40 |
| `buildAdaptationPlan` | assemble canonical plan | reasoning + triggered entries | 1:1 action conversion | `AdaptationPlan` | `reasoning/planner.js` | `decide` PLAN | ✅ | 32 it /67 |
| `buildRole4Signals` | read role-4 evidence | userId | read-only; `strategyEffectiveness` unpopulated | `{interventions,outcomes,memories}` | `engine/role4Signals.js` | `reflectionEngine` (**not the hook**) | 🟡 partial | 8 it /21 |
| `executeAdaptation` | apply plan | plan + moduleContext | priorityOrder loop; UI gated by `isUIExecutionEnabled()` | `ExecutionResults` | `engine/executor.js` | explicit `execute()` only | 🟡 dormant | 10 it /38 |

**Test coverage:** 18 backend/adaptive test files, ~**301 `it`**, ~**778 `expect`**. Plus frontend: `AdaptiveUIRuntime.test.jsx` (15/60), hook tests (6/27 + 1/3), bridges (5/18, 5/17).

**Two distinct systems (do not merge):**
1. **Adaptive-Engine plan** — canonical `AdaptationPlanSchema` at `src/support/schemas/supportSchemas.js:577` (produced by `planner.js`, consumed by Role 3). `planId, timestamp, decisionTraceId, situation, primaryNeed, secondaryNeeds, reasoning[], actions[], overallConfidence, sources, userStateReference, reEvaluateAt?, priorityOrder[]`.
2. **Support-execution plan** — `normalizeAdaptationPlan` at `src/support/integration/AdaptationPlanAdapter.js` (fields: `selectedModuleId, targetNeeds, reasonCodes, triggerSource, selectionMode, configuration, fallbacks, safety`). **No adapter converts between them; they are two separate systems** (decision engine vs support-module launcher).

---

## PART 8 — USER STATE MODEL (worked example)

`buildUserState(snapshot)` → 9 dimensions, each `{value, confidence, reasons, sources}`.

**Real example** (from inference rules in `userStateModel.js`):
```
Context: mood.primaryMood="anxious" (conf .7), behavior.taskSwitchFrequency=.71,
         complexity high, explicitRequest type="help", biometrics=null
Resulting UserState (via backward-compat proxy):
  cognitiveLoad    = "high"       conf .70   (taskSwitchRate high + complexity high)
  attentionState   = "fragmented" conf .80   (rate ≥ .6)
  stressLevel      = "high"       conf .70   (EMOTION_TO_STRESS: anxious)
  urgency          = "high"       conf .70   (explicitRequest help→high)
  emotionalState   = "anxious"    conf .70   (propagated from emotion)
  energyLevel      = "normal"     conf .50   (default)
  motivationLevel  = "moderate"   conf .80   (engagement normal)
  taskComplexity   = "high"       (derived)
  engagementLevel  = "normal"/low (derived)
  overallConfidence = mean of the 9 confidences
```
**Confidence & missing data:** every dimension either has a value+confidence or the literal string **`"unknown"` with confidence 0.0** and a reason (e.g. `"no emotion signal"`). Values are never fabricated. Confidence = `Math.max` of contributing signal confidences (degraded by rule multipliers). `unknown` inputs propagate but don't skew means upward.

---

## PART 9 — COGNITIVE REASONING

`reasonAboutUserState` matches `SITUATION_REGISTRY` conditions (ALL must match), picks highest `priority`.

| Situation | Priority | Requires | → Primary Need / Strategy |
|---|---|---|---|
| `urgent_overload` | 100 | urgency∈{high,critical} AND cognitiveLoad∈{high,overwhelming} | immediate_task_simplification / prioritize_and_reduce_complexity |
| `emotional_distress` | 90 | stress∈{high,acute} AND emotion∈{anxious,overwhelmed,panicked} | emotional_regulation / reduce_stress_and_stabilize |
| `cognitive_overload` | 80 | cognitiveLoad∈{high,overwhelming} | task_simplification / reduce_cognitive_complexity |
| `attention_fragmentation` | 70 | attention∈{fragmented,scattered,absent} | attention_support / reduce_distractions_and_focus |
| `low_energy` | 60 | energy∈{tired,exhausted} AND motivation=low | low_effort_support / reduce_task_demand |
| `stable` | 0 | fallback (never auto-detected) | maintain_current_state / normal_support |
| `insufficient_information` | 0 | <3 known dims | gather_information / wait_and_observe |

**Confidence:** `0.4·overall + 0.4·signalStrength + 0.2·coverage − 0.06·conflictCount` (clamped). Secondary needs = deduped needs from all matched situations minus the primary's family.

**Why separated from planning:** reasoning is *interpretation* (state → "what is happening & what's needed"), planning is *conversion* (interpretation + policy triggers → concrete reversible actions). It also keeps the decision open to non-plan interventions (e.g. wait-and-observe) and preserves explainability (`reasoning[]`, `evidence[]`).

---

## PART 10 — PLANNING

`buildAdaptationPlan` (`reasoning/planner.js`) converts **ReasoningResult + triggered policy entries → canonical `AdaptationPlan`**, strictly 1:1 (each triggered rule → one action; no ranking). Each action: `{actionId, type, target, parameters, tier, numericPriority, confidence, reason, evidence[], reversible, durationMs?, expiry?}`.

- **UI is encoded as actions:** `{type:"MODIFY", target:"UI", parameters:{mode,...}}` — there is **no** top-level `uiMode` in the canonical schema (design decision D9).
- `reEvaluateAt` = earliest of expiry/cooldown/hysteresis-minDuration; merged downstream with hysteresis (`nextReEvaluateAt`, earliest wins).
- **Canonical schema:** `AdaptationPlanSchema` (`src/support/schemas/supportSchemas.js:577`), superRefine validates `priorityOrder` references actions.
- **Legacy surface:** `adaptationPolicy.determineAdaptation()` returns `{uiMode, parameters, activeRules}` — **DORMANT** (superseded by planner action model).

---

## PART 11 — INTERVENTION RANKING

There are **three** scoring surfaces — keep them straight in the talk:

1. **`sharedModuleScorer.js`** (canonical math): `score(module) = Σ tagScores[tag] for tag in module.tags`; missing tag → 0; sort desc, ties keep order. Used by onboarding `moduleSelector`.
2. **Support-intervention ranking** (`src/support/framework/interventionSelection.js`): `rankSupportModules` / `selectIntervention`. Score = `base 1 + context-match (+2/tag from getContextTags) + explicit-request (+3) + preference (+2) − avoidance (−3) + outcomeAdjustment` (±1.2/−0.8/… from last 10 outcomes). Gated first by `checkModuleEligibility`: enabledModules, disorders intersect, supportedRoles, **repetition limit (default 2 per 24 h)**, safety.
3. **`interventionRanking.js`** (`buildTagProfile`, `selectModules`): **DORMANT** outside tests/UserSettings.

**What actually happens with several candidates:** for support launch → eligibility filters first, then score sort, then `selectIntervention` picks the first eligible. Inside the Role-2 engine, "ranking" is really the **conflict-resolution precedence** (tier → priority → confidence → version → ruleId) — candidates for the same target, not a numeric ladder.

---

## PART 12 — ADAPTATION DECISION ENGINE (order + contribution)

Verified pipeline input→output (already shown in Part 7). Contribution of each stage:

- **SAFETY (`safetyGate`)** — reuses `assessSupportSafety` (`src/support/framework/interventionSelection.js:99`): regex crisis ≥ `suicide|self[ -]harm|kill myself|end my life` → **ESCALATE/BLOCK**; diagnosis language → **CAUTION** + `clinical_claim_guardrail`. Applies module `safetyLevel` floor; **fails closed** if assessment crashes. Tier-1 results are exempt from hysteresis.
- **PREFERENCES (`preferences.js`)** — `requested` → Tier-2 EXPLICIT_USER_REQUEST; `restricted` → Tier-3 hard filter (never creates actions); `accessibility` → Tier-4, **allowlist only** `reduceMotion` (UI MODIFY) and `screenReader` (ASSISTANCE ENABLE).
- **CONFLICT (`conflictResolution.js`)** — two entries conflict if same `target` + opposing direction or shared parameter key with different value; winner by lower tier → higher priority → higher confidence → newer version → lower ruleId.
- **HYSTERESIS (`hysteresis.js`)** — per `(userId, moduleId, target)` state machine: `activate` (≥ activationThreshold), `sustain`, `deactivate` (≤ deactivationThreshold AND minDuration elapsed or expiry), `wait_cooldown`, `wait_threshold`. Thresholds come *only* from `PolicyRule.hysteresis`. Cap 10,000 states, oldest evicted. **In-memory only** — resets on reload, no cross-tab.
- **FEATURE FLAGS (`featureFlags.js`)** — `runtime` gates the hook; `uiExecution` gates the executor; `reflection` gates learning. **Default OFF**; activated via env.
- **RE-EVALUATION** — `reEvaluateAt` is *computed* into the plan, but **no production timer scheduler re-invokes `decide()`** at that time (PLANNED).

---

## PART 13 — ROLE 3: ADAPTIVE UI

**Who receives the decision:** `AdaptiveRuntimeProvider` (mounted in `App.jsx:80`) calls `useAdaptiveBehavioralEngine({moduleId, getSnapshot: context, userId, userPreferences})`; `AdaptiveUIRuntime` (child, `App.jsx:81`) consumes via `useAdaptiveRuntime()`.

**How a decision becomes a visible UI change — two paths:**
1. **CSS-driven (global):** `AdaptiveUIRuntime` → `deriveUIModeFromPlan(plan)` → sets `data-adaptive-*` attributes on `.adaptive-root` (`data-adaptive-mode/-reduce-motion/-reduce-color/-focus/-guide/-simplify-nav`); `src/styles/adaptive.css` rewrites motion/color/chrome. Also renders an **"Adapted for you" chip**, a `AdaptiveRecommendationPopup` ("Let's make things a little easier"), and a Role-3 **`InterventionModal`** bridge via `deriveInterventionRecommendation(plan)` → id like `guided_breathing`, `sensory_reset`…
2. **Module-scoped (content):** `useModuleAdaptation` in **`SocialScenarioSimulatorCard.jsx:110`** (`asd.social-scenarios`) and **`EmotionDecoderCard.jsx:104`** (`asd.emotion-decoder`) filters plan actions to `target !== "UI"`, funnels through local `deriveSignals()` → `{simplify, provideHints, slowPace}`, then `buildScenarioConfig`/`buildDecoderConfig` change **hints, reduced cues, pacing, difficulty**. Users see green "adaptation active" badges.

**Runtime status:** `runtime` flag ON in **both** `/.env.development` and `/.env.production` (`VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME=true`) → decisions + CSS adaptation are **live**. `uiExecution` (executor auto-apply) & `reflection` remain **OFF**. So: engine decides, CSS & module config apply; the explicit `execute()` executor path is dormant.

---

## PART 14 — ROLE 4: SUPPORT MODULES

**Owns:** module registry, eligibility & safety, lifecycle state machine, outcome recording, evidence journal, persistence (`role4Store`), migration of legacy memory, and the support-launch "adaptation plan".
**Does NOT own:** the Role-2 decision engine, or the canonical `AdaptationPlanSchema` (that belongs to Role 2/3).

**Chain:** `supportModuleRegistry.js` (24 module defs + `modulePolicies` for 16 modules) → `checkModuleEligibility` → `rankSupportModules`/`selectIntervention` (`src/support/framework/interventionSelection.js`) → `interventionLifecycle.deliverIntervention` (writes SHOWN + lifecycle event) → `transitionIntervention` (validated `ALLOWED_TRANSITIONS`) → `lifecycleCommands` (`progress/pause/resume/complete/abandon/cancel/fail/rate`) → `processInterventionOutcome`.

**Execution:** `moduleExecutors.js` — only `support.focus_session` has a real executor; other modules use `startPlaceholderExecutor`; **5 are `DEFERRED_MODULE_IDS`** (`visual_timeline, mood_checkin, accountability_session, soundscape, asd.social-scenarios`). ASD/Anxiety "launch" instead opens the Role-3 `InterventionModal` (see Part 15).

**Historical evidence → future decisions:** outcomes persist under `nb_role4:v1:<uid>:outcomes`; `supportEvidence` (`SupportEvidenceResponseSchema`) aggregates counts/rates/trend + preferred/unsuccessful configs; `recommendFocusConfiguration` (focus session) synthesizes a Tier-9 `role4.focus_configuration` policy input. **The Tier-9 "learned" path is dormant** — `strategyEffectiveness` is intentionally unpopulated and reflection is flag-OFF.

**Runtime status:** Role-4 record persistence is LIVE (role4Store + fallback mirror), intervention lifecycle is LIVE for focus sessions, but production *module selection & launch* is not wired to a global orchestrator — modules are launched by pages/adaptive popup, not by a central executor.

---

## PART 15 — ASD & ANXIETY MODULE ARCHITECTURE

### ASD (`/asd`, theme `asd_social`)
| Route | Page → Component | State | Notes |
|---|---|---|---|
| `/asd` | `ASDPage.jsx` | local | Hero + mascot + `AdaptiveGreeting` (**hardcoded `responseTier={0}`**), routine banner (`useASDData`), **Interactive ASD Support** → `InterventionModal` (`sensory_reset`, `grounding_activity`, `transition_support`), tool grid, `SensorySettings` |
| `/asd/stories` | `ASDStoriesPage` → `SocialStoryBuilder.jsx` | `useASDData` | Story player (speechSynthesis), guardian CRUD |
| `/asd/emotion` | `ASDEmotionPage` → `EmotionDecoderCard.jsx` | **`useModuleAdaptation`** | ✅ engine-wired |
| `/asd/social-scenarios` | `ASDSocialScenariosPage` → `SocialScenarioSimulatorCard.jsx` | **`useModuleAdaptation`** | ✅ engine-wired |
| `/communication` | `SocialCommunicationPage` | `useCommunicationAdaptation` → `useAdaptiveBehavioralEngine` | ✅ engine-wired (separate feature, not an /asd tool) |

**Unused/presentational ASD components (DORMANT, no importer):** `StructuredScheduleChangeSystem.jsx`, `SafeSpaceOverloadMode.jsx`, `PublicEnvironmentPreparationMode.jsx`, `EmotionalVocabularyTrainer.jsx`, `CommunicationSupportMode.jsx`, `AdaptiveCheckInPanel.jsx`. Also `neurobridge/InterventionView.jsx` and `AdaptiveStateCard.jsx` exist but are **not yet mounted** anywhere.

### Anxiety (`/anxiety`, theme `anxiety_calm`)
`AnxietyPage.jsx` = hero + mascot + `AdaptiveGreeting` (hardcoded tier 0) + reassurance banner + **Interactive Anxiety Support** (`guided_breathing`, `grounding_exercise`, `calm_space` → `InterventionModal`) + **`AdaptiveAnxietyEngine`** + `SensorySettings`.

`AdaptiveAnxietyEngine.jsx` is a **fully independent self-contained pipeline** (peripheral to the shared Role-2 engine — verified: no `useModuleAdaptation`/`useAdaptiveBehavioralEngine` imports):
```
ContextSnapshot (useContextStateOptional live, or demo)
 → deriveAnxietyState   (anxietyStateEngine.js : frictionIndex → responseTier 0–3, 6 explainable dims)
 → reasonAnxietyPattern (anxietyReasoner.js: STABLE_BASELINE/PHYSIOLOGICAL_ESCALATION/COGNITIVE_WORRY_LOOP/AVOIDANCE_DRIVEN/SENSORY_OVERWHELM/GENERAL_ANXIETY + needsClarification)
 → planInterventions    (anxietyPlanner.js: evaluateFit + getPersonalizedModifier(localStorage outcomes))
 → renders per tier: baseline card / 1-tap clarification (Body/Thoughts/Getting Started) / contextual prompt
 → interventions: BreathingExecution, GroundingExecution, ReframeExecution (7 CBT distortions), MicroActionExecution
 → 1-tap outcome [Better/Same/Worse] → recordOutcome → outcomesVersion++ → re-plan
```
Personalization: localStorage keys `nb_anxiety_outcomes_<uid>`, `nb_anxiety_dismissals_<uid>` (`anxietyPersonalization.js`). Plus an **Evaluator demo drawer** with 5 `DEMO_SCENARIO_RUNNERS` (`demo/anxietyDemoScenarios.js`) that feed the **production** pipeline. Route `/anxiety` registered at `App.jsx:432`; `AnxietyModule.jsx` is a thin wrapper using `userId:"anon"` (note userId inconsistency: engine uses `"default_user"`).

**What remains to integrate (your responsibility):** wire ASD hub + anxiety into a *shared* adaptive state source (currently ASD hub/anxiety hub hardcode `responseTier={0}`; anxiety uses its own reasoner); mount `InterventionView`/`AdaptiveStateCard`; hook the remaining presentational ASD components into routes or remove; unify anxiety `userId` defaults.

---

## PART 16 — DATA & PERSISTENCE

| What | Where | Writer | Reader | Scope |
|---|---|---|---|---|
| User profile / disorders / enabledModules | `localStorage nb_auth`, `nb_prefs_<uid>` (+ Supabase user_metadata merge) | `AuthContext` (`updateUser`/`updateDisorders`/login) | `useAuth`, gating, ContextProvider.syncProfile | persistent |
| Context (UnifiedContext + snapshot) | in-memory `contextStore` / `ContextProvider` state | `contextEngine` | Role 2 (hook), anxiety engine, AdaptiveUI | **session-only** |
| Role-4 records | `nb_role4:v1:<uid>:{interventions,lifecycle_events,outcomes,reflections,memories,personalization_profiles,adaptation_decisions}` | `role4Store` + `role4Repository` (Supabase `support_*` with fallback latch) | reflection, lifecycle, evidence | persistent |
| Anxiety outcomes/dismissals | `nb_anxiety_outcomes_<uid>`, `nb_anxiety_dismissals_<uid>` | `AdaptiveAnxietyEngine`, `AmbientAnxietyPrompt` | `anxietyPlanner` (modifier), demo | persistent |
| Evidence journal | `nb_role4_journal:v1:<uid>:evidence_entries` | `EvidenceFolder` | journal UI | persistent |
| ASD stories/routines | `nb_asd_stories_<wardId>`, ward tasks (`nb_guardian_ward_tasks` + `nb_sync_*`) | `useASDData`/guardian | ASD pages | persistent |
| Legacy memory (`nb_memory_*`) | localStorage | legacy (`memorySystem.js`) | migrated to Role-4 (`role4Migrations` `legacy-memory-v1`) | legacy |
| Legacy anxiety tracker logs | `anxiety-tracker-logs-v2_*` / `anxiety-reframe-history-v1_*` | **no current writer** | `outcomeAnalysis.js` (read-only) | **dead/legacy** |
| Hysteresis / adaptive state | in-memory module map | `hysteresis.js` | engine | **session-only** |
| OCD data | `src/support/specialized/ocdStore.js` (`nb_ocd_suds_logs`, …) | OCD components | OCD dashboard | persistent |

---

## PART 17 — COMPLETE USER JOURNEY (every arrow = a real file)

```
user opens app                    App.jsx:453 (QueryClient→Auth→Tooltip→Router)
login                             LoginUser.jsx → AuthProvider.signIn (nb_auth / MOCK_USERS)
profile / features                resolveEnabledFeatures (lib/featureRegistry.js:313) → hasFeature
onboarding gate                   ProtectedRoute.jsx:53  → /onboarding/disorders
questions→modules                 OnboardingFlow.jsx → selectModulesForUser (moduleSelector.js) → enabledModules
Home                              Home.jsx → composeHomeModules(enabledModules) → ModuleCard grid
enter /asd or /anxiety            App.jsx ProtectedRoute feature=FEATURES.ASD/ANXIETY
context collected                 ContextProvider.jsx → contextEngine.init + startInteractionTracking
snapshot generated                contextStore → contextSnapshotAdapter.toContextSnapshot
engine processes it               AdaptiveRuntimeProvider → useAdaptiveBehavioralEngine → adaptiveEngine.decide
decision made                     decide() 10-stage pipeline → {plan, trace}
UI changes / support offered      AdaptiveUIRuntime (data-adaptive-* + chip + popup) & useModuleAdaptation
                                    → InterventionModal (InterventionResolver registry)
user interacts with intervention  GuidedBreathing…/SensoryReset…/AdaptiveAnxietyEngine executions → onComplete
outcome recorded                  AdaptiveAnxietyEngine.handleSelectOutcome → recordOutcome (nb_anxiety_*)
                                     & support lifecycle: lifecycleCommands → role4Store/role4Repository
future adaptation can use evidence  supportEvidence (aggregate) → focusConfiguration Tier-9 (PLANNED; reflection OFF)
```

---

## PART 18 — THREE DEMO SCENARIOS (all runtime-working today)

**Scenario 1 — Normal/focused user (ASD social practice)**
Slow/steady user in `/asd/social-scenarios`. Signals: low taskSwitchRate, engagement normal, mood neutral → `buildUserState` → `attentionState=focused`, `cognitiveLoad=low` → no policy triggers → `AdaptationPlan` empty/normal → `AdaptiveUIRuntime` keeps `data-adaptive-mode=normal`; `EmotionDecoderCard` gets no hints (`Simulate: deriveSignals → {}`) — **quiet, no popup**.

**Scenario 2 — Overwhelmed/distressed user (anxiety)**
User in `/anxiety`, or global runtime: mood `overwhelmed`, urgency high, cognitiveLoad high → anxiety `respondTier` 2–3 → contextual prompt card + recommended intervention badge → user taps Start → `BreathingExecution` (4-4-4-4) → outcome feedback [Better/Same/Worse] → `recordOutcome` + replan. On the shared engine side the same snapshot hits `decide()` → `overwhelm_simplification`/`critical_urgency` policy → CSS `data-adaptive-mode=overwhelm` + optional popup "Let's make things a little easier".

**Scenario 3 — Explicit request (text — actually supported)**
`processUserMessage` (`contextEngine.js`) → `conversationAgent.analyzeConversation` (Gemini+heuristic) → explicit request `help` → `explicitRequests` in snapshot → `inferUrgency=high` → policy `critical_urgency` → per preferences, requested prefs inject Tier-2 candidates → UI action surfaces. (Voice: dictation exists in some module UIs via Web Speech, but there is no voice-only intent path into the engine — say text only.)

**Scenario 4 — "Future interaction-behavior adaptation" (PLANNED)**
`pointerdown` frequency/latency, per-element focus/blur, mousemove/click patterns, biometrics (HRV/EDA), OS reduced-motion — typed or partially collected but **not** currently driving decisions. Would extend `normalizeContextSnapshot` + policies; not present today.

---

## PART 19 — WHAT IS ACTUALLY ADAPTIVE RIGHT NOW? (brutally honest)

**LIVE adaptive behavior (runtime-wired, on by env flag):**
- Live ContextSnapshot → Role-2 `decide()` → CSS UI adaptation (`data-adaptive-*`) + "Adapted for you" chip + recommendation popup (dev & prod, `runtime=true`).
- `SocialScenarioSimulatorCard` & `EmotionDecoderCard` adapt hints/pacing/difficulty from the plan.
- Anxiety engine independently adapts tier 0–3 prompting, interventions, and personalizes future prompts from local outcomes.
- Sensory preferences (`SensorySettings`) re-skin ASD/Anxiety pages, persisted.

**Implemented but not commonly triggered:** most policies need truly high signal values (overwhelm/urgency/critical); many inputs are sparse (no biometrics), so heavy states are rare in ordinary testing.

**Tested but not runtime-wired:** `executor.executeAdaptation` auto-apply (`uiExecution` OFF); `reflectionEngine` ↔ Tier-9 learned personalization (`reflection` OFF); `reEvaluateAt` auto re-decision (no scheduler); `role4Signals` in the live hook (hook uses `getSupportEvidenceAsync` instead); `interventionRanking.selectModules`.

**Dormant/legacy:** `AdaptiveEngineBridge.jsx` (superseded), `determineAdaptation` legacy `uiMode`, `interventionRanking` profile builder, `memorySystem` `nb_memory_*` (migrated), anxiety tracker-log panels (no writer), presentational ASD components + `InterventionView`/`AdaptiveStateCard` (never mounted).

**Future work:** biometrics→snapshot wiring, mouse-move/click distress, OS reduced-motion signal, sleep quality, `reEvaluateAt` scheduler, full module executors, reflection→Tier-9 rollout, anxiety↔shared-engine merge, onboarding recompute-from-tagProfile.

**What a user actually observes today:** feature-gated home & sidebar; for ASD, two tools that visibly change hints/pacing/badges when context says distressed/scattered; for anxiety, prompts + breathing/grounding/cBT-sections with outcomes stored locally; globally, the CSS adaptation (occasionally visible as reduced chrome + a small "Adapted for you" chip + popup) in production builds.

---

## PART 20 — ARCHITECTURE DIAGRAMS (slide-ready)

**1. Overall**
```
┌─ React SPA (App.jsx) ──────────────┐
AuthContext → ProtectedRoute → Pages │
FeatureRegistry ✕ enabledModules/    │
   disorders (onboarding)            │
ContextProvider (Role 1)             │
AdaptiveRuntimeProvider+UI (Role2/3) │
Role 4 registry/lifecycle + stores   │
└──────────┬────────────────────────┘
localStorage (nb_*)  ⇄  Supabase (optional, env-gated)
```

**2. Context & Perception** — sensors → `signalValidator` (dedup/freshness) → `contextStore` (UnifiedContext 6 dims) → `contextFusion` → `contextSnapshotAdapter.toContextSnapshot()` (+live interaction telemetry) → `ContextProvider` (React state).

**3. Adaptive Intelligence** — `ContextSnapshot → buildUserState(9 dims) → reasonAboutUserState → evaluatePolicies → resolveConflicts → applyUserPreferences → safetyGate → runHysteresis → buildAdaptationPlan → validateDecisionTrace → {plan, trace}`.

**4. End-to-end adaptive flow** — snapshot → decide → module-scope `useModuleAdaptation`/`AdaptiveUIRuntime` → `InterventionResolver` (ASD/Anxiety interventions) → outcome (role4Store / `nb_anxiety_*`) → supportEvidence → (future) Tier-9.

---

## PART 21 — PRESENTATION SCRIPT

**1-minute:** NeuroBridge is a browser-only adaptive support app for neurodivergent people (ADHD, ASD, anxiety, OCD, dyslexia, depression, …). It personalizes modules through an onboarding questionnaire, then continuously senses in-browser state — mood, activity, typing, scrolling, focus — and a purpose-built decision engine turns that into subtle adaptations of pace, difficulty, and interface. All data stays in the browser with an optional Supabase sync.

**3-minute:** add — two JSON profiles (user + used `contextSnapshot`), one-time personalization vs continuous adaptation, the 10-stage pipeline, the two live demonstration integrations (ASD cards, anxiety engine), and Role 4 outcome stores that feed future learning.

**5-minute:** walk each layer with one code reference each (App.jsx providers; AuthContext; OnboardingFlow→moduleSelector; ContextProvider→contextEngine; adaptiveEngine.decide order; AdaptiveUIRuntime CSS attributes; InterventionResolver registry; role4Store keys).

**10-minute:** the full Part 17 journey with file names, plus deep dives: state model example (Part 8), reasoning registry table (Part 9), safety/hysteresis mechanics (Part 12), and honest status matrix (Part 23). Emphasize the two-plan distinction and the fact that adaptation is decision-live but learning is gated.

---

## PART 22 — EVALUATOR Q&A (accurate answers)

- **Why React/Vite?** Fast SPA, rich component ecosystem (shadcn/framer-motion), and a fully client-side adaptive loop avoids latency; Vite aliases (`@`/`@backend`) keep the demo self-contained.
- **Why Supabase?** Optional hosted auth+DB for multi-user/guardian/care-team sync; coded in `src/lib/supabaseClient.js` + `role4Repository`, but **not active here** (no env vars) — honest answer.
- **How does personalization work?** one-time questionnaire → tag scores → module scoring (`sharedModuleScorer` sum-of-tags) → `enabledModules`; never recomputed at runtime (only manual edits in UserSettings).
- **Context vs User State:** Context = raw observed signals (snapshot). User State = interpreted, confidence-carrying dimensions (`buildUserState`).
- **Why ContextSnapshot?** stable public contract decoupling sensors from the engine; adds live telemetry the store keeps clean.
- **Why can't Context pick an intervention?** because interventions require interpreted state + safety + preferences + anti-oscillation — the 10-stage pipeline exists precisely for that.
- **Reasoning vs Planning vs Ranking:** reasoning = "what's happening/needed"; planning = "which verified actions"; ranking/conflict = "which one wins per target" (plus support-launch score sort).
- **Adaptation Decision Engine:** `adaptiveEngine.decide()` + sub-modules (policy/conflict/preferences/safety/hysteresis/planner/trace).
- **Safety:** crisis/diagnosis regex (`assessSupportSafety`) + module floor + fail-closed; crisis → ESCALATE/BLOCK.
- **Hysteresis:** per (user,module,target) thresholds, cooldowns, min-duration; Tier-1 exempt; in-memory.
- **Avoid constant UI changes:** hysteresis + dedup-by-signature in `useAdaptiveBehavioralEngine` + `reEvaluateAt` (last part planned).
- **How preferences affect adaptation:** Tier-2 requested / Tier-3 restricted / Tier-4 accessibility (allowlist) injected in the PREFERENCE stage.
- **Role 4→future learning:** outcomes→supportEvidence→focusConfiguration directive + reflection (flagged off). Don't oversell.
- **Explicit intent overrides:** requested prefs=Tier-2, learned=Tier-9 — explicit wins (tested in `adaptiveEngine.test.js`).
- **Missing context:** dims = `unknown`/conf 0; `insufficient_information` reasoning; engine waits.
- **Really adaptive today?** Yes for decisions/UI adaptation (flag ON); learning & executor are not.
- **Rapid mouse movement?** nothing happens — no mousemove-based distress detection (only `pointerdown`).
- **Voice/chat:** chat via `processUserMessage`→conversation agent→explicitRequests; no voice-intent path.
- **ASD vs Anxiety in adaptive layer:** ASD uses the shared Role-2 engine (2 cards); anxiety uses its own independent pipeline with its own localStorage learning — architectural debt, but functional.
- **Incomplete:** biometrics, mouse/click distress, reflection/Tier-9, `reEvaluateAt` scheduler, executors for most modules, anxiety↔engine merge, onboarding recompute.

---

## PART 23 — FINAL STATUS MATRIX

| Layer | Component | Imp. | Tested | Runtime | User-visible | Owner | Current limitation |
|---|---|---|---:|---:|---:|---|---|---|
| Auth | AuthContext/MOCK_USERS+Supabase | ✅ | partial | ✅ | ✅ login | | Supabase env absent → local |
| Onboarding | OnboardingFlow→selectModulesForUser | ✅ | ✅ (moduleSelector 6/12) | ✅ | ✅ modules | | one-time; never recomputed |
| Feature | featureRegistry.resolveEnabledFeatures | ✅ | ✅ | ✅ | ✅ nav/gating | | dual registries don't feed each other |
| Role 1 | contextEngine/store/fusion | ✅ | partial | ✅ | ❌ | | session-only memory |
| Role 1 | ContextSnapshot adapter | ✅ | partial | ✅ | ❌ | | live telemetry, no persistence |
| Role 1 | biometrics / mouse-move | ❌ | — | ❌ | ❌ | | typed/mock only |
| Role 2 | buildUserState (9 dims) | ✅ | ✅ 46/70 | ✅ | ❌ | you | sparse inputs → unknowns |
| Role 2 | cognitiveReasoning | ✅ | ✅ 32/96 | ✅ | ❌ | you | restrictive triggers |
| Role 2 | planner (canonical plan) | ✅ | ✅ 32/67 | ✅ | ❌ | you | no auto re-run |
| Role 2 | conflictResolution | ✅ | ✅ 15/29 | ✅ | ❌ | you | — |
| Role 2 | preferences (Tier2/3/4) | ✅ | ✅ 20/82 | ✅ | ❌ | you | allowlist only 2 keys |
| Role 2 | safetyGate | ✅ | ✅ 11/40 | ✅ | ❌ | you | regex-only signals |
| Role 2 | hysteresis | ✅ | ✅ 9/40 | ✅ | ❌ | you | in-memory only |
| Role 2 | adaptationPolicy (6 rules) | ✅ | ✅ 36/65 | ✅ | ✅ CSS | you | high thresholds |
| Role 2 | executor/execute | ✅ | ✅ 10/38 | 🟡 `uiExecution` OFF | ❌ | you | dormant auto-apply |
| Role 2 | reflection/Tier-9 | ✅ | ✅ 9/27 | ❌ flag OFF | ❌ | you | strategyEffectiveness unpopulated |
| Role 3 | AdaptiveUIRuntime (CSS/chip/popup) | ✅ | ✅ 15/60 | ✅ | ✅ chip/popup | | — |
| Role 3 | InterventionResolver+Modal | ✅ | partial | ✅ | ✅ | | manual triggers on hub pages |
| Role 3 | InterventionView / AdaptiveStateCard | ✅ | — | ❌ | ❌ | you | never mounted |
| ASD | hub + stories + emotion + scenarios | ✅ | partial | ✅ | ✅ | you | hub greeting hardcoded tier 0 |
| ASD | 2 engine-wired cards | ✅ | partial | ✅ | ✅ badges | you | — |
| ASD | 6 presentational tools | ✅ | — | ❌ | ❌ | you | unused |
| Anxiety | AdaptiveAnxietyEngine (own pipeline) | ✅ | ✅ 123 | ✅ | ✅ prompts/interventions | you | separate from Role-2; userId mismatch |
| Anxiety | interventions/outcome learning | ✅ | ✅ | ✅ | ✅ | you | localStorage only |
| Support | registry/eligibility/ranking | ✅ | partial | 🟡 | 🟡 | | selectIntervention not globally wired |
| Support | lifecycle state machine | ✅ | partial | 🟡 focus only | 🟡 | | most executors placeholder/deferred |
| Outcomes | role4Store + repository | ✅ | partial | ✅ focus | ✅ focus | | Supabase unchecked at runtime |
| Persistence | nb_role4 / nb_anxiety / nb_auth | ✅ | partial | ✅ | ✅ | | localStorage-centric |

---

**Bottom line for tomorrow:** your Role 2 engine is real, tested (~301 cases), and genuinely wired to two ASD tools plus the global CSS adapter — but it is decision-live with learning and full execution gated behind flags. The anxiety module is a parallel, self-contained system. Be precise about what's *live* vs *gated* vs *never populated* and you'll be airtight against evaluators.