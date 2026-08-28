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
 *   - Renders the persistent, non-intrusive AdaptiveSupportCard
 *   - Opens the InterventionModal on "Start Support" with full interactive flow
 *
 * Dismissal semantics: dismissing (or starting) a recommendation keeps the card
 * visible in its neutral state and suppresses only that same recommendation; a
 * genuinely different future recommendation appears normally.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useMemo, useState } from "react";
import { useAdaptiveRuntime } from "./adaptiveRuntimeContext.jsx";
import { AdaptationDimension, AdaptationActionType } from "@/support/schemas/supportSchemas";
import InterventionModal from "@/components/interventions/InterventionModal";
import AdaptiveSupportCard from "./AdaptiveSupportCard.jsx";
import { getInterventionMeta } from "@/components/interventions/InterventionResolver";

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
 * Derive intervention recommendation for Role 3 popup from the Adaptive plan
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

  // 2. Check situation
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

/** Human-readable labels for module-targeted engine actions. */
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
    });
  }
  return adjustments;
}

/**
 * @param {object} props
 * @param {import("react").ReactNode} props.children
 */
export default function AdaptiveUIRuntime({ children }) {
  const runtime = useAdaptiveRuntime();
  const derived = useMemo(() => deriveUIModeFromPlan(runtime.plan), [runtime.plan]);
  const recommendation = useMemo(
    () => deriveInterventionRecommendation(runtime.plan),
    [runtime.plan],
  );

  // Session-scoped dismissal: suppressing one recommendation keeps the card in
  // its neutral state and never blocks a genuinely different future offer.
  const [dismissedRecommendationIds, setDismissedRecommendationIds] = useState(
    () => new Set(),
  );
  const [activeInterventionModal, setActiveInterventionModal] = useState(null);

  const dismissRecommendation = (id) => {
    if (!id) return;
    setDismissedRecommendationIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const activeRecommendation =
    recommendation &&
    recommendation.id &&
    !dismissedRecommendationIds.has(recommendation.id)
      ? recommendation
      : null;

  const wrapperProps = {
    "data-adaptive-root": "true",
    "data-adaptive-mode": derived.mode,
    "data-adaptive-reduce-motion": String(derived.flags.reduceMotion),
    "data-adaptive-reduce-color": String(derived.flags.reduceColor),
    "data-adaptive-focus": String(derived.flags.focus),
    "data-adaptive-guide": String(derived.flags.guide),
    "data-adaptive-simplify-nav": String(derived.flags.simplifyNav),
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
        }
      : null;

  return (
    <div {...wrapperProps} className="adaptive-root">
      {children}

      {/* Role 3: Persistent, non-intrusive Adaptive Support Card */}
      <AdaptiveSupportCard
        recommendation={cardRecommendation}
        onStartSupport={(id) => {
          // Start Support opens the intervention and suppresses the same offer.
          dismissRecommendation(id);
          setActiveInterventionModal(id);
        }}
        onDismiss={(id) => dismissRecommendation(id)}
      />

      {/* Role 3: Active Intervention Modal */}
      <InterventionModal
        isOpen={Boolean(activeInterventionModal)}
        recommendationId={activeInterventionModal}
        onClose={() => setActiveInterventionModal(null)}
        onComplete={() => {
          setActiveInterventionModal(null);
          if (activeInterventionModal) {
            dismissRecommendation(activeInterventionModal);
          }
        }}
        autoStart
      />
    </div>
  );
}
