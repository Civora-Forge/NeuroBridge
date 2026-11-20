/**
 * AdaptiveUIRuntime.jsx — App-level Adaptive Engine UI execution shell & Role 3 Bridge
 * (Phase 4, Stage C equivalent WITHOUT touching the engine or its flags)
 *
 * The Adaptive Engine produces UI actions as `{ type: "MODIFY", target:
 * "UI", parameters: { mode, ... } }` in the public `plan`. This shell is the
 * ONLY live consumer of those actions at the app level: it derives the active
 * UI adaptation (mode + granular flags) from the plan and applies it to the
 * whole subtree via scoped `data-adaptive-*` attributes, so EVERY feature in
 * the app genuinely adapts (reduced motion, reduced color, focus chrome,
 * guided-mode outlines, simplified navigation).
 *
 * Role 3 Integration:
 *   - Derives intervention recommendations from the active plan
 *   - Renders the non-intrusive AdaptiveSupportCard
 *   - Opens the InterventionModal on "Start Support" with full interactive flow
 *
 * Intervention event lifecycle:
 *   - The Adaptive Support card is HIDDEN by default. It becomes visible only
 *     when the Adaptive Engine produces a new intervention opportunity — i.e.
 *     the plan carries at least one triggered action AND that action/situation
 *     maps to a recommendation. Persistent engine labels alone (situation,
 *     adaptiveState, currentRecommendation, ...) never surface the card.
 *   - A "new opportunity" is detected when the recommendation id or content
 *     changes (id, title, description, or reason differ from the previous
 *     recommendation). An unchanged persistent recommendation from the engine
 *     does NOT re-show the card after dismissal.
 *   - When the user dismisses or completes the intervention, the card is
 *     hidden and the dismissal is kept in the session execution store, so it
 *     survives unrelated state changes (plan flicker, re-decisions, remounts).
 *     A recommendation with a different id appears normally.
 *
 * Execution (Task 3): the shell never applies a raw plan. Every plan goes
 * through `resolvePlanExecution` (src/adaptive/execution/uiExecution.js),
 * which enforces the uiExecution flag, safety outcomes, requireConfirmation
 * consent and reducedIntensity, and the result is recorded in an idempotent
 * execution ledger. When nothing may be applied the wrapper is the baseline.
 *   - The engine's hysteresis stage keeps a sustained target from
 *     re-activating repeatedly, so the same opportunity is not re-emitted.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useMemo, useRef, useState, useEffect, useSyncExternalStore } from "react";
import { useAdaptiveRuntime } from "./adaptiveRuntimeContext.jsx";
import { AdaptationDimension, AdaptationActionType, PriorityTier } from "@/support/schemas/supportSchemas";
import InterventionModal from "@/components/interventions/InterventionModal";
import AdaptiveSupportCard from "./AdaptiveSupportCard.jsx";
import { getInterventionMeta } from "@/components/interventions/InterventionResolver";
import {
  createExecutionLedger,
  declineConsent,
  dismissRecommendation as persistDismissal,
  getExecutionStoreVersion,
  grantConsent,
  isRecommendationDismissed,
  resolvePlanExecution,
  subscribeExecutionStore,
} from "@/adaptive/execution/uiExecution";
import {
  FeedbackOutcome,
  getLearnedPreferences,
  preferenceKey,
  recommendationPreferenceKey,
  recordAdaptationFeedback,
} from "@/adaptive/learning/adaptationLearning";
import { LEARNING_INFLUENCE } from "@backend/adaptive/engine/learning";
import { isReflectionEnabled } from "@backend/adaptive/engine/featureFlags";
import { isLearnedAvoided } from "@backend/adaptive/engine/personalization";
import { promoteFromFeedback } from "@/adaptive/personalization/profileStore";

/**
 * A user-actionable prompt (consent prompt / support card) that was visible at
 * least this long and then disappeared without any response is recorded as
 * "ignored" (a weak signal). Shorter exposures record nothing: silence and
 * flicker are never treated as rejection.
 */
export const IGNORED_AFTER_MS = 8000;

/** Human-readable labels for the engine's UI modes. */
export const MODE_LABELS = {
  normal: "Default interface",
  focus: "Focus mode",
  minimal: "Reduced choices",
  low_stimulation: "Low-stimulation mode",
  overwhelm: "Simplified interface",
  guided: "Guided mode",
  reading: "Reading mode",
  high_contrast: "High contrast",
};

const SUPPORTED_MODES = new Set(Object.keys(MODE_LABELS));

const NORMAL_STATE = {
  mode: "normal",
  flags: {
    reduceMotion: false,
    reduceColor: false,
    focus: false,
    guide: false,
    simplifyNav: false,
  },
};

function boolFlag(value) {
  return value === true;
}

/**
 * Fold a validated AdaptationPlan into the effective UI state.
 */
export function deriveUIModeFromPlan(plan) {
  if (!plan || !Array.isArray(plan.actions) || plan.actions.length === 0) {
    return {
      ...NORMAL_STATE,
      actionId: null,
      ruleLabel: null,
      confidence: 0,
      reason: null,
      active: false,
    };
  }

  let primary = null;
  const flags = { ...NORMAL_STATE.flags };

  for (const action of plan.actions) {
    if (!action || action.target !== AdaptationDimension.UI) continue;
    if (action.type !== AdaptationActionType.MODIFY) continue;

    const parameters = action.parameters ?? {};
    if (primary === null && SUPPORTED_MODES.has(parameters.mode)) {
      primary = action;
    }

    if (boolFlag(parameters.reduceMotion) || boolFlag(parameters.reduceAnimations)) {
      flags.reduceMotion = true;
    }
    if (boolFlag(parameters.reduceColorIntensity)) flags.reduceColor = true;
    if (boolFlag(parameters.reduceDistractions)) flags.focus = true;
    if (boolFlag(parameters.simplifyNavigation)) flags.simplifyNav = true;
    if (
      boolFlag(parameters.showStepByStep) ||
      boolFlag(parameters.highlightNextAction)
    ) {
      flags.guide = true;
    }
  }

  const mode = primary?.parameters?.mode ?? NORMAL_STATE.mode;
  const ruleLabel = MODE_LABELS[mode] ?? NORMAL_STATE.mode;

  return {
    mode,
    flags,
    actionId: primary?.actionId ?? null,
    ruleLabel,
    confidence: primary?.confidence ?? plan.overallConfidence ?? 0,
    reason: primary?.reason ?? null,
    active: mode !== "normal" || Object.values(flags).some(Boolean),
  };
}

/**
 * Derive intervention recommendation for Role 3 popup from the Adaptive plan.
 *
 * Pure mapping from a plan's triggered action parameters (then situation) to a
 * recommendation. This function does NOT decide whether the opportunity is
 * "active" — the caller (AdaptiveUIRuntime) only consults it when the engine
 * actually triggered an action (`plan.actions` non-empty), so persistent
 * reasoning labels alone never surface the card.
 */
export function deriveInterventionRecommendation(plan) {
  if (!plan) return null;

  // 1. Check explicit module / action triggers
  if (Array.isArray(plan.actions)) {
    for (const action of plan.actions) {
      const params = action?.parameters || {};
      if (params.guidedBreathing) {
        return {
          id: "guided_breathing",
          title: "Guided Breathing",
          description: "Follow a gentle breathing rhythm to slow things down.",
          reason: action.reason || "Paced breathing recommended to reduce tension.",
        };
      }
      if (params.mode === "low_stimulation" || params.mode === "overwhelm" || params.reduceColorIntensity) {
        return {
          id: "sensory_reset",
          title: "Sensory Reset",
          description: "Rest your eyes and mind in a low-stimulation sanctuary.",
          reason: action.reason || "Sensory reset recommended to relieve overwhelm.",
        };
      }
      if (params.calmLayout || params.lowPressure || params.longerPauses) {
        return {
          id: "calm_space",
          title: "Calm Space",
          description: "A peaceful pause space with zero expectations.",
          reason: action.reason || "Calm space recommended to reset comfortably.",
        };
      }
      if (params.stepSize || params.shorterSteps || params.showOneStep) {
        return {
          id: "transition_support",
          title: "Now · Next · Then",
          description: "Step-by-step guidance to make transitions clear and predictable.",
          reason: action.reason || "Transition routine recommended to reduce uncertainty.",
        };
      }
      if (params.showCuesFirst || params.guidedPrompts) {
        return {
          id: "grounding_activity",
          title: "Grounding Activity",
          description: "A gentle 5-step pause to bring your attention back to your space.",
          reason: action.reason || "Grounding check-in recommended.",
        };
      }
    }
  }

  // 2. Situation fallback (only meaningful when the engine triggered actions —
  //    the caller gates on `plan.actions` being non-empty, so an idle engine
  //    never reaches here via a persistent situation label alone).
  if (plan.situation === "urgent_overload") {
    return {
      id: "sensory_reset",
      title: "Sensory Reset",
      description: "A quiet, low-stimulation space to rest your senses.",
      reason: "Urgent overload detected. Let's take a peaceful reset.",
    };
  }
  if (plan.situation === "emotional_distress") {
    return {
      id: "guided_breathing",
      title: "Guided Breathing",
      description: "Take a short pause and breathe at a calming pace.",
      reason: "Emotional tension detected. A quick breath cycle can help.",
    };
  }
  if (plan.situation === "cognitive_overload") {
    return {
      id: "transition_support",
      title: "Now · Next · Then",
      description: "Break your current activity into clear, manageable steps.",
      reason: "High cognitive load detected.",
    };
  }
  if (plan.situation === "attention_fragmentation") {
    return {
      id: "grounding_exercise",
      title: "5-4-3-2-1 Grounding",
      description: "Use your senses to bring focus back to the present.",
      reason: "Scattered attention detected.",
    };
  }

  return null;
}

/**
 * Human-readable labels for module-targeted engine actions.
 */
const MODULE_ACTION_LABELS = {
  "PACING:DECREASE": "Slower pacing",
  "PACING:SIMPLIFY": "Gentler pacing",
  "PACING:MODIFY": "Pacing adjusted",
  "TASK:DECOMPOSE": "Smaller steps",
  "TASK:SIMPLIFY": "Simpler task",
  "TASK:GUIDE": "Guided steps",
  "TASK:MODIFY": "Task adjusted",
  "CONTENT:REDUCE": "Simplified content",
  "CONTENT:SIMPLIFY": "Simplified content",
  "CONTENT:REORDER": "Prioritised content",
  "CONTENT:MODIFY": "Content adjusted",
  "INTERACTION:SIMPLIFY": "Fewer distractions",
  "ASSISTANCE:GUIDE": "More guidance",
  "ASSISTANCE:MODIFY": "Extra support",
  "TIMING:MODIFY": "Timing adjusted",
  "NOTIFICATIONS:MODIFY": "Fewer prompts",
};

/**
 * Fold a validated AdaptationPlan into the module-scoped adaptations
 */
export function deriveModuleAdjustments(plan) {
  if (!plan || !Array.isArray(plan.actions) || plan.actions.length === 0) {
    return [];
  }
  const seen = new Set();
  const adjustments = [];
  for (const action of plan.actions) {
    if (!action || action.target === AdaptationDimension.UI) continue;
    const key = `${action.target}:${action.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    adjustments.push({
      target: action.target,
      type: action.type,
      actionId: action.actionId ?? null,
      reason: action.reason ?? null,
      label: MODULE_ACTION_LABELS[key] ?? "Module adapted",
      parameters: action.parameters ?? {},
    });
  }
  return adjustments;
}

/**
 * App-level shell: resolves the live plan through the execution guardrails,
 * applies the effective UI state to the subtree, and surfaces consent prompts
 * and the Role 3 support card.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 * @param {(entry: object) => void} [props.onExecution] - Receives each new
 *   execution-ledger entry (applied / modified / deferred / rejected /
 *   dismissed, with reasons).
 */
export default function AdaptiveUIRuntime({ children, onExecution }) {
  const runtime = useAdaptiveRuntime();
  const storeVersion = useSyncExternalStore(
    subscribeExecutionStore,
    getExecutionStoreVersion,
    getExecutionStoreVersion,
  );

  const rawPlan = runtime.enabled ? runtime.plan : null;
  const userId = runtime.userId ?? null;
  const feedbackModuleId = runtime.moduleId ?? "generic";
  const decisionId = rawPlan?.decisionTraceId ?? null;

  // Task 4 feedback capture — written to the learning store from event
  // handlers / one-shot effects only (no React state → no render loops); one
  // outcome per exposure (duplicates are dropped by the store).
  const feedback = (key, outcome, exposureId) => {
    if (!userId || !key || !exposureId) return;
    const result = recordAdaptationFeedback({ userId, key, outcome, exposureId, moduleId: feedbackModuleId, decisionId });
    // Task 5: feedback that has become reliable and stable is promoted into
    // the persistent profile (no-op until the promotion gates are met).
    if (result?.recorded && isReflectionEnabled()) promoteFromFeedback(userId).catch(() => {});
  };
  const resolution = useMemo(
    () =>
      resolvePlanExecution(rawPlan, {
        trace: runtime.trace,
        runtimeEnabled: runtime.enabled !== false,
      }),
    // storeVersion: consent decisions change the resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawPlan, runtime.trace, runtime.enabled, storeVersion],
  );

  // Deterministic, update-free application: an equivalent resolution (same
  // signature) reuses the previous derived state object.
  const derivedRef = useRef({ signature: null, derived: null });
  if (derivedRef.current.signature !== resolution.signature) {
    derivedRef.current = {
      signature: resolution.signature,
      derived: deriveUIModeFromPlan(resolution.effectivePlan),
    };
  }
  const derived = derivedRef.current.derived;

  // Traceability: record each effective change once (idempotent ledger).
  const ledgerRef = useRef(null);
  if (ledgerRef.current === null) ledgerRef.current = createExecutionLedger();
  const [lastExecution, setLastExecution] = useState(null);
  const onExecutionRef = useRef(onExecution);
  onExecutionRef.current = onExecution;
  const appliedRef = useRef({ actions: [], at: null });
  useEffect(() => {
    const { duplicate, entry } = ledgerRef.current.commit(resolution, rawPlan);
    if (!duplicate && entry) {
      setLastExecution(entry);
      onExecutionRef.current?.(entry);
    }
    // Explicit override: a state-driven adaptation that was applied is
    // replaced on the same target by the user's explicit preference.
    const previous = appliedRef.current;
    const explicitTargets = new Set(
      (rawPlan?.actions ?? [])
        .filter((a) => a.tier >= PriorityTier.EXPLICIT_USER_REQUEST && a.tier <= PriorityTier.EXPLICIT_PREFERENCE)
        .map((a) => a.target),
    );
    for (const action of previous.actions) {
      if (explicitTargets.has(action.target)) {
        feedback(preferenceKey(action), FeedbackOutcome.OVERRIDDEN, `applied:${previous.at}`);
      }
    }
    const applied = (resolution.effectivePlan?.actions ?? []).filter(
      (a) => (a.tier ?? 0) >= PriorityTier.CURRENT_STATE,
    );
    const sameAdaptations =
      applied.map(preferenceKey).join("|") === previous.actions.map(preferenceKey).join("|");
    appliedRef.current = sameAdaptations ? previous : { actions: applied, at: Date.now() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution.signature]);

  // An intervention opportunity exists only when the engine actually triggered
  // an adaptation action, and never while a safety outcome overrides ordinary
  // adaptation. Recommendations are offers (user-started), so they are not
  // gated by the UI execution flag.
  const recommendation = useMemo(() => {
    const plan = rawPlan;
    if (!plan || !Array.isArray(plan.actions) || plan.actions.length === 0) {
      return null;
    }
    if (resolution.suppressRecommendations) return null;
    return deriveInterventionRecommendation(plan);
  }, [rawPlan, resolution.suppressRecommendations]);

  // Learned preference for this offer (Task 4): an offer the user has
  // repeatedly declined in this context, with sufficient evidence, is not
  // re-surfaced. Offers only — never an explicit setting.
  const recommendationLearning = useMemo(() => {
    if (!recommendation || !userId || !isReflectionEnabled()) return null;
    const key = recommendationPreferenceKey(recommendation.id);
    const learned = getLearnedPreferences(userId, {
      moduleId: feedbackModuleId,
      since: runtime.personalization?.learnedSince,
    })[key];
    if (learned?.sufficient && learned.score <= LEARNING_INFLUENCE.opposeAt) return learned;
    // Task 5: a declined offer promoted into the profile stays declined on
    // every device and in later sessions — the user is not asked again.
    return isLearnedAvoided(runtime.personalization, key) ? { key, source: "profile" } : null;
  }, [recommendation, userId, feedbackModuleId, runtime.personalization]);

  // Task 5: the user explicitly opted out of unrequested support offers.
  const offersAllowed = runtime.personalization?.presentation?.allowUnrequestedOffers !== false;

  const [activeInterventionModal, setActiveInterventionModal] = useState(null);

  const activeRecommendation =
    recommendation && offersAllowed && !isRecommendationDismissed(recommendation.id) && !recommendationLearning
      ? recommendation
      : null;

  const pending = resolution.pendingConsent[0] ?? null;

  // Exposure tracking for prompts the user can act on (consent + card).
  const consentExposure = useRef(null);
  const cardExposure = useRef(null);
  const trackExposure = (ref, key) => {
    const current = ref.current;
    if (current && current.key === key) return;
    if (current && !current.handled && Date.now() - current.shownAt >= IGNORED_AFTER_MS) {
      feedback(current.key, FeedbackOutcome.IGNORED, current.id);
    }
    ref.current = key ? { key, shownAt: Date.now(), id: `shown:${key}:${Date.now()}`, handled: false } : null;
  };
  const pendingFeedbackKey = pending ? preferenceKey(pending.action) : null;
  const cardFeedbackKey = activeRecommendation ? recommendationPreferenceKey(activeRecommendation.id) : null;
  useEffect(() => {
    trackExposure(consentExposure, pendingFeedbackKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFeedbackKey]);
  useEffect(() => {
    trackExposure(cardExposure, cardFeedbackKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardFeedbackKey]);
  const respond = (ref, outcome) => {
    const exposure = ref.current;
    if (!exposure || exposure.handled) return;
    exposure.handled = true;
    feedback(exposure.key, outcome, exposure.id);
  };

  const wrapperProps = {
    "data-adaptive-root": "true",
    "data-adaptive-mode": derived.mode,
    "data-adaptive-reduce-motion": String(derived.flags.reduceMotion),
    "data-adaptive-reduce-color": String(derived.flags.reduceColor),
    "data-adaptive-focus": String(derived.flags.focus),
    "data-adaptive-guide": String(derived.flags.guide),
    "data-adaptive-simplify-nav": String(derived.flags.simplifyNav),
    "data-adaptive-execution": resolution.status,
    "data-adaptive-execution-reason": (lastExecution?.reason ?? resolution.reason) || undefined,
  };

  if (!runtime.enabled) {
    return <div {...wrapperProps}>{children}</div>;
  }

  const meta = activeRecommendation
    ? getInterventionMeta(activeRecommendation.id)
    : null;
  const cardRecommendation =
    activeRecommendation && meta
      ? {
          id: activeRecommendation.id,
          title: activeRecommendation.title || meta.title,
          description: activeRecommendation.description || meta.description,
          reason: activeRecommendation.reason || null,
        }
      : null;

  return (
    <div {...wrapperProps} className="adaptive-root">
      {children}

      {/* Consent: adaptations the safety stage marked requireConfirmation are
          only applied after the user explicitly accepts them. */}
      {pending && (
        <div
          role="region"
          aria-live="polite"
          aria-label="Suggested adaptation"
          data-adaptive-consent="pending"
          className="fixed bottom-4 left-4 z-40 max-w-sm rounded-lg border bg-background p-3 shadow"
        >
          <p className="text-sm">
            {pending.action.target === AdaptationDimension.UI
              ? `Switch to ${MODE_LABELS[pending.action.parameters?.mode] ?? "a calmer interface"}?`
              : `Apply "${MODULE_ACTION_LABELS[`${pending.action.target}:${pending.action.type}`] ?? "this adjustment"}" to this activity?`}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="neuro-btn"
              onClick={() => {
                respond(consentExposure, FeedbackOutcome.ACCEPTED);
                grantConsent(pending.key);
              }}
            >
              Apply
            </button>
            <button
              type="button"
              className="neuro-btn-ghost"
              onClick={() => {
                respond(consentExposure, FeedbackOutcome.REJECTED);
                declineConsent(pending.key);
              }}
            >
              Keep current view
            </button>
          </div>
        </div>
      )}

      {/* Role 3: Non-intrusive Adaptive Support Card — mirrors the engine plan
          exactly: mounted while the plan carries a recommendation, hidden the
          moment it clears. */}
      {activeRecommendation && (
        <AdaptiveSupportCard
          recommendation={cardRecommendation}
          onStartSupport={(id) => {
            // Start Support opens the intervention and suppresses the same offer.
            respond(cardExposure, FeedbackOutcome.ACCEPTED);
            persistDismissal(id);
            setActiveInterventionModal(id);
          }}
          onDismiss={(id) => {
            respond(cardExposure, FeedbackOutcome.DISMISSED);
            persistDismissal(id);
          }}
        />
      )}

      {/* Role 3: Active Intervention Modal */}
      <InterventionModal
        isOpen={Boolean(activeInterventionModal)}
        recommendationId={activeInterventionModal}
        onClose={() => setActiveInterventionModal(null)}
        onComplete={() => {
          setActiveInterventionModal(null);
          if (activeInterventionModal) {
            persistDismissal(activeInterventionModal);
          }
        }}
        autoStart
      />
    </div>
  );
}
