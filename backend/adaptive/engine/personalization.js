/**
 * personalization.js — Persistent personalization stage (Task 5)
 *
 * Consumes a resolved profile view (src/adaptive/personalization
 * resolveProfileView) and applies it according to the TYPE of preference:
 *
 *   explicit preferred support mode → bounded SUPPORTING EVIDENCE (same
 *        mechanism and cap as Task 4 learning). It can tip borderline
 *        evidence, never create an adaptation from absent evidence.
 *   explicit avoided support mode   → CONSTRAINT: the matching current-state
 *        candidate is removed before safety.
 *   explicit presentation (motion / density) → parameter SHAPING on UI
 *        candidates, only ever towards calmer output.
 *   learned stance (promoted from Task 4) → supporting evidence, used as a
 *        fallback where this device has no sufficient live feedback summary
 *        (e.g. a new device). Live evidence, and every explicit preference,
 *        outranks it.
 *
 * Invariants:
 *   - Tier 1 SAFETY and every explicit / goal / module / task tier
 *     (< CURRENT_STATE) are never touched.
 *   - Protected rules (critical urgency, overwhelm support) are never
 *     suppressed or reduced by a preference.
 *   - Without a profile view the stage is a pure pass-through.
 *
 * Pure and deterministic; never mutates its inputs.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { AdaptationActionType, AdaptationDimension, PriorityTier } from "@/support/schemas/supportSchemas";
import {
  LEARNED_STANCES,
  MODE_FIELD_PREFIX,
  PROTECTED_RULE_IDS,
  SUPPORT_MODES,
  modeForRule,
} from "@/adaptive/personalization/profileVocabulary.js";

/** Synthetic evidence for an explicitly preferred mode (bounded by learning.js). */
const EXPLICIT_SUPPORT = Object.freeze({ score: 0.85, confidence: 1 });
const DENSE_CAP = 2;

function isView(view) {
  return view !== null && typeof view === "object" && typeof view.presentation === "object";
}

function isProtected(entry) {
  return PROTECTED_RULE_IDS.includes(entry?.ruleId) || entry?.action?.parameters?.showEmergencySupport === true;
}

function eligible(entry) {
  return (entry?.tier ?? 0) >= PriorityTier.CURRENT_STATE;
}

/**
 * Build the learned-evidence record handed to applyLearnedPreferences():
 * profile stances (fallback) < live Task 4 summaries < explicit preferred
 * modes; explicitly avoided modes carry no supporting evidence at all.
 *
 * @returns {{ learned: Record<string, object>|undefined, explicitKeys: Map<string, object>, profileKeys: Set<string> }}
 */
export function buildPreferenceEvidence(live, view) {
  if (!isView(view)) return { learned: live, explicitKeys: new Map(), profileKeys: new Set() };
  const out = {};
  const profileKeys = new Set();
  const explicitKeys = new Map();

  for (const [key, stance] of Object.entries(view.learned ?? {})) {
    out[key] = {
      key,
      scope: stance.scope === "context" ? "context" : "global",
      score: stance.score,
      confidence: stance.confidence,
      evidenceCount: stance.evidenceCount,
      sufficient: true,
    };
    profileKeys.add(key);
  }
  for (const [key, summary] of Object.entries(live ?? {})) {
    if (summary?.sufficient || !out[key]) {
      out[key] = summary;
      profileKeys.delete(key);
    }
  }
  for (const { mode, scope } of view.supportModes?.preferred ?? []) {
    for (const ruleId of SUPPORT_MODES[mode]?.ruleIds ?? []) {
      const key = `${AdaptationDimension.UI}:${ruleId}`;
      out[key] = { key, scope, ...EXPLICIT_SUPPORT, evidenceCount: 1, sufficient: true };
      explicitKeys.set(key, { field: `${MODE_FIELD_PREFIX}${mode}`, scope });
      profileKeys.delete(key);
    }
  }
  for (const { mode } of view.supportModes?.avoided ?? []) {
    for (const ruleId of SUPPORT_MODES[mode]?.ruleIds ?? []) {
      delete out[`${AdaptationDimension.UI}:${ruleId}`];
    }
  }
  return { learned: Object.keys(out).length > 0 ? out : undefined, explicitKeys, profileKeys };
}

/**
 * Split Task 4 influence records into learned ones (kept in trace.learning,
 * tagged by source) and explicit ones (reported as personalization).
 */
export function partitionInfluences(influences, evidence) {
  const learning = [];
  const applied = [];
  for (const influence of influences ?? []) {
    const explicit = evidence.explicitKeys.get(influence.key);
    if (explicit) {
      applied.push({
        field: explicit.field,
        layer: "explicit",
        scope: explicit.scope,
        ruleId: influence.ruleId,
        effect: influence.effect,
      });
      continue;
    }
    learning.push(evidence.profileKeys.has(influence.key) ? { ...influence, source: "profile" } : influence);
  }
  return { learning, applied };
}

/**
 * Constraint + shaping stage over the post-preference candidate list.
 *
 * @param {object[]} entries
 * @param {object} [view] - resolveProfileView() output
 * @returns {{ kept: object[], dropped: object[], applied: object[] }}
 */
export function applyProfileConstraints(entries, view) {
  if (!isView(view)) return { kept: entries, dropped: [], applied: [] };
  const avoidedModes = new Map((view.supportModes?.avoided ?? []).map((item) => [item.mode, item.scope]));
  const presentation = view.presentation;
  const motionSource = view.preferences?.motion;
  const kept = [];
  const dropped = [];
  const applied = [];

  for (const entry of entries) {
    if (!eligible(entry)) {
      kept.push(entry);
      continue;
    }
    const mode = modeForRule(entry.ruleId);
    if (mode && avoidedModes.has(mode) && !isProtected(entry)) {
      dropped.push(entry);
      applied.push({
        field: `${MODE_FIELD_PREFIX}${mode}`,
        layer: "explicit",
        scope: avoidedModes.get(mode),
        ruleId: entry.ruleId,
        effect: "suppressed",
      });
      continue;
    }

    const action = entry.action ?? {};
    if (action.target !== AdaptationDimension.UI || action.type !== AdaptationActionType.MODIFY) {
      kept.push(entry);
      continue;
    }
    const parameters = { ...(action.parameters ?? {}) };
    let shaped = false;
    if (presentation.reduceMotion && parameters.reduceAnimations !== true) {
      parameters.reduceAnimations = true;
      shaped = true;
      applied.push({
        field: motionSource ? "motion" : "avoid:animations",
        layer: motionSource?.source === "temporary" ? "temporary" : "explicit",
        scope: motionSource?.scope ?? "global",
        ruleId: entry.ruleId,
        effect: "shaped",
      });
    }
    const density = view.preferences?.informationDensity;
    if (
      presentation.informationDensity === "minimal" &&
      !isProtected(entry) &&
      typeof parameters.maxVisibleModules === "number" &&
      parameters.maxVisibleModules > DENSE_CAP
    ) {
      parameters.maxVisibleModules = DENSE_CAP;
      shaped = true;
      applied.push({
        field: "informationDensity",
        layer: density?.source === "temporary" ? "temporary" : "explicit",
        scope: density?.scope ?? "global",
        ruleId: entry.ruleId,
        effect: "shaped",
      });
    }
    kept.push(shaped ? { ...entry, action: { ...action, parameters } } : entry);
  }
  return { kept, dropped, applied };
}

/** Learned stances that argue against an offer key (UI offer suppression). */
export function isLearnedAvoided(view, key) {
  return view?.learned?.[key]?.stance === LEARNED_STANCES.AVOIDED;
}
