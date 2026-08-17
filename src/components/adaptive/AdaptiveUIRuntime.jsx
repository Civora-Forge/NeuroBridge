/**
 * AdaptiveUIRuntime.jsx — App-level Adaptive Engine UI execution shell
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
 * Design rules:
 *   - Decision-only input: consumes `plan` from `useAdaptiveRuntime` (the
 *     documented public contract). It never calls the engine, never modifies
 *     `backend/adaptive`, and never touches the `uiExecution` flag.
 *   - Scope + reversibility: effects live on the wrapper element and are
 *     removed on unmount or revert. The status chip offers a one-tap revert;
 *     a genuinely different future decision re-applies adaptation.
 *   - Graceful degradation: no plan (flag OFF / insufficient data) renders
 *     children unchanged with no attributes and no chip.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAdaptiveRuntime } from "./adaptiveRuntimeContext.jsx";
import { AdaptationDimension, AdaptationActionType } from "@/support/schemas/supportSchemas";

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
 *
 * - The first UI `MODIFY` action (planner precedence order) whose parameters
 *   carry a supported `mode` becomes the primary mode.
 * - Granular flags are merged from every UI action's parameters (preference
 *   actions such as `reduceMotion` carry no mode and only contribute flags).
 * - Non-UI / non-MODIFY actions are ignored.
 *
 * @param {object|null} plan - Public AdaptationPlan (`plan` from the hook).
 * @returns {{ mode: string, flags: object, actionId: string|null, ruleLabel: string|null, confidence: number, reason: string|null, active: boolean }}
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

function flagsEqual(left, right) {
  return Object.keys(NORMAL_STATE.flags).every(
    (key) => left?.[key] === right?.[key],
  );
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
 * Fold a validated AdaptationPlan into the module-scoped adaptations the
 * engine decided for the current support module. Only non-UI actions (which
 * originate exclusively from module policies) are collected, deduped by
 * target+type, and labelled for the status chip.
 *
 * @param {object|null} plan - Public AdaptationPlan (`plan` from the hook).
 * @returns {Array<{ target: string, type: string, actionId: string|null, reason: string|null, label: string }>}
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
  const [override, setOverride] = useState(null);

  // A genuinely different future decision lifts the user's manual revert so
  // the engine can adapt again. An identical decision keeps the revert, and a
  // fresh decision that matches the reverted (normal) state changes nothing.
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

  return (
    <div {...wrapperProps} className="adaptive-root">
      {children}

      {showChip && (
        <div
          className="fixed bottom-4 right-4 z-[90] max-w-xs"
          role="status"
          aria-live="polite"
        >
          <div className="neuro-card p-3 flex flex-col gap-2">
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
            <button
              type="button"
              onClick={() => setOverride(NORMAL_STATE)}
              className="neuro-btn-outline text-xs py-1.5"
            >
              Revert to default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
