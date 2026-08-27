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
 *   - Renders the AdaptiveRecommendationPopup ("Let's make things a little easier")
 *   - Opens the InterventionModal on "Start Support" with full interactive flow
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAdaptiveRuntime } from "./adaptiveRuntimeContext.jsx";
import { AdaptationDimension, AdaptationActionType } from "@/support/schemas/supportSchemas";
import AdaptiveRecommendationPopup from "@/components/interventions/AdaptiveRecommendationPopup";
import InterventionModal from "@/components/interventions/InterventionModal";

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
  const adjustments = useMemo(
    () => deriveModuleAdjustments(runtime.plan),
    [runtime.plan],
  );
  const recommendation = useMemo(
    () => deriveInterventionRecommendation(runtime.plan),
    [runtime.plan],
  );

  const [override, setOverride] = useState(null);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [activeInterventionModal, setActiveInterventionModal] = useState(null);

  // A genuinely different future decision lifts the user's manual revert
  const prevModeRef = useRef(derived.mode);
  useEffect(() => {
    const previous = prevModeRef.current;
    prevModeRef.current = derived.mode;
    if (
      override &&
      previous !== derived.mode &&
      override.mode !== derived.mode
    ) {
      setOverride(null);
    }
  }, [derived.mode, override]);

  // Reset popup dismissal when recommendation changes
  const prevRecommendationId = useRef(recommendation?.id);
  useEffect(() => {
    if (recommendation?.id && recommendation.id !== prevRecommendationId.current) {
      prevRecommendationId.current = recommendation.id;
      setPopupDismissed(false);
    }
  }, [recommendation?.id]);

  const effective = override ?? derived;

  const wrapperProps = {
    "data-adaptive-root": "true",
    "data-adaptive-mode": effective.mode,
    "data-adaptive-reduce-motion": String(effective.flags.reduceMotion),
    "data-adaptive-reduce-color": String(effective.flags.reduceColor),
    "data-adaptive-focus": String(effective.flags.focus),
    "data-adaptive-guide": String(effective.flags.guide),
    "data-adaptive-simplify-nav": String(effective.flags.simplifyNav),
  };

  const showChip = effective.active || (!override && adjustments.length > 0);
  const showDetails = effective.active && effective.reason != null;
  const visibleAdjustments = override ? [] : adjustments;

  const showRecommendationPopup = Boolean(
    recommendation &&
    !popupDismissed &&
    !activeInterventionModal &&
    (effective.active || recommendation.id !== "fallback")
  );

  return (
    <div {...wrapperProps} className="adaptive-root">
      {children}

      {/* Role 3: Adaptive Recommendation Popup */}
      {showRecommendationPopup && (
        <AdaptiveRecommendationPopup
          recommendationId={recommendation.id}
          titleOverride={recommendation.title}
          descriptionOverride={recommendation.description}
          onStartSupport={(recId) => {
            setPopupDismissed(true);
            setActiveInterventionModal(recId);
          }}
          onDismiss={() => setPopupDismissed(true)}
        />
      )}

      {/* Role 3: Active Intervention Modal */}
      <InterventionModal
        isOpen={Boolean(activeInterventionModal)}
        recommendationId={activeInterventionModal}
        onClose={() => setActiveInterventionModal(null)}
        onComplete={() => {
          setActiveInterventionModal(null);
          setPopupDismissed(true);
        }}
      />

      {/* Adaptive Status Chip (always available for one-tap revert) */}
      {showChip && (
        <div
          className="fixed bottom-4 right-4 z-[90] max-w-xs"
          role="status"
          aria-live="polite"
        >
          <div className="neuro-card p-3 flex flex-col gap-2 shadow-lg">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">Adapted for you</p>
                <p className="text-sm text-foreground">{effective.ruleLabel}</p>
                {showDetails && (
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">
                    {effective.reason}
                  </p>
                )}
                {visibleAdjustments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {visibleAdjustments.map((adj) => (
                      <span
                        key={adj.actionId ?? `${adj.target}:${adj.type}`}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-foreground"
                      >
                        {adj.label}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  Adaptive Engine · confidence{" "}
                  {Math.round((effective.confidence ?? 0) * 100)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOverride(NORMAL_STATE)}
                className="neuro-btn-outline text-xs py-1.5 flex-1"
              >
                Revert to default
              </button>
              {recommendation && (
                <button
                  type="button"
                  onClick={() => setActiveInterventionModal(recommendation.id)}
                  className="px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm"
                >
                  Start Support
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
