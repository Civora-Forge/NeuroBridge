/**
 * learning.js — Learned-preference evidence stage (Task 4)
 *
 * Runs right after evidence-gated policy evaluation and before temporal
 * stability. Learned preferences (from src/adaptive/learning) act as bounded
 * SUPPORTING EVIDENCE on current-state adaptations only:
 *
 *   - a sufficiently supported positive preference raises a candidate's
 *     evidence by at most `maxShift` — it can tip borderline evidence over
 *     the entry floor ("changed") or strengthen a firing rule ("supported"),
 *     but cannot create an adaptation from weak or absent evidence;
 *   - a sufficiently supported negative preference lowers it by at most
 *     `maxShift` — strong evidence still adapts ("changed"), borderline
 *     evidence no longer does ("suppressed");
 *   - preferences without enough evidence have no effect;
 *   - Tier 1 SAFETY and explicit tiers (< CURRENT_STATE) are never touched,
 *     and explicit user preferences (added later by the preference stage)
 *     always outrank anything learned.
 *
 * Pure and deterministic; never mutates its inputs.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { PriorityTier } from "@/support/schemas/supportSchemas";
import { EVIDENCE_THRESHOLDS } from "../reasoning/adaptationPolicy.js";

export const LEARNING_INFLUENCE = Object.freeze({
  /** Largest evidence shift a learned preference can cause. */
  maxShift: 0.15,
  /** Learned score at/above which a preference supports an adaptation. */
  supportAt: 0.65,
  /** Learned score at/below which a preference argues against it. */
  opposeAt: 0.35,
});

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function keyOf(entry) {
  const target = entry?.action?.target;
  return target && entry?.ruleId ? `${target}:${entry.ruleId}` : null;
}

function shiftFor(preference, config) {
  if (!preference || preference.sufficient !== true) return 0;
  const { score, confidence } = preference;
  if (typeof score !== "number" || typeof confidence !== "number") return 0;
  if (score >= config.supportAt) {
    return config.maxShift * confidence * ((score - 0.5) / 0.5);
  }
  if (score <= config.opposeAt) {
    return -config.maxShift * confidence * ((0.5 - score) / 0.5);
  }
  return 0;
}

function influenceRecord(entry, preference, effect, before, after) {
  return {
    key: keyOf(entry),
    ruleId: entry.ruleId,
    scope: preference.scope === "context" ? "context" : "global",
    score: clamp01(preference.score),
    confidence: clamp01(preference.confidence),
    evidenceCount: Math.max(0, Math.trunc(preference.evidenceCount ?? 0)),
    effect,
    evidenceBefore: round(clamp01(before)),
    evidenceAfter: round(clamp01(after)),
  };
}

/**
 * @param {{ triggered: object[], suppressed: object[] }} evaluation - evaluatePolicies() output
 * @param {Record<string, object>} [learned] - getLearnedPreferences() output
 * @param {object} [options]
 * @returns {{ triggered: object[], suppressed: object[], influences: object[] }}
 */
export function applyLearnedPreferences(evaluation, learned, options = {}) {
  const triggered = Array.isArray(evaluation?.triggered) ? evaluation.triggered : [];
  const suppressed = Array.isArray(evaluation?.suppressed) ? evaluation.suppressed : [];
  if (!learned || typeof learned !== "object" || Object.keys(learned).length === 0) {
    return { triggered, suppressed, influences: [] };
  }
  const config = { ...LEARNING_INFLUENCE, ...(options.config ?? {}) };
  const minTrigger = options.minTriggerConfidence ?? EVIDENCE_THRESHOLDS.minTriggerConfidence;
  const minSupporting = options.minSupportingConfidence ?? EVIDENCE_THRESHOLDS.minSupportingConfidence;
  const eligible = (entry) => (entry?.tier ?? 0) >= PriorityTier.CURRENT_STATE;

  const nextTriggered = [];
  const nextSuppressed = [];
  const influences = [];

  for (const entry of triggered) {
    const preference = eligible(entry) ? learned[keyOf(entry)] : undefined;
    const shift = shiftFor(preference, config);
    if (shift === 0) {
      nextTriggered.push(entry);
      continue;
    }
    const before = typeof entry.evidenceConfidence === "number" ? entry.evidenceConfidence : 1;
    const after = clamp01(before + shift);
    if (after < minTrigger) {
      nextSuppressed.push({
        ...entry,
        evidenceConfidence: after,
        confidence: after,
        evidenceReason: "learned_preference",
      });
      influences.push(influenceRecord(entry, preference, "suppressed", before, after));
    } else {
      nextTriggered.push({ ...entry, evidenceConfidence: after });
      influences.push(influenceRecord(entry, preference, shift > 0 ? "supported" : "changed", before, after));
    }
  }

  for (const entry of suppressed) {
    const preference = eligible(entry) ? learned[keyOf(entry)] : undefined;
    const shift = shiftFor(preference, config);
    const before = typeof entry.evidenceConfidence === "number" ? entry.evidenceConfidence : 0;
    // Only a positive preference on low-confidence (not stale, not absent)
    // evidence may promote a candidate; it can never revive stale evidence.
    if (
      shift > 0 &&
      entry.evidenceReason === "low_confidence_evidence" &&
      before >= minSupporting &&
      before + shift >= minTrigger
    ) {
      const { evidenceReason: _reason, ...rest } = entry;
      const after = clamp01(before + shift);
      nextTriggered.push({
        ...rest,
        evidenceConfidence: after,
        confidence: undefined,
        matchedGroups: rest.matchedGroups ?? [],
      });
      influences.push(influenceRecord(entry, preference, "changed", before, after));
      continue;
    }
    nextSuppressed.push(entry);
  }

  // Preserve evaluatePolicies precedence order for promoted entries.
  nextTriggered.sort((left, right) =>
    left.tier !== right.tier ? left.tier - right.tier : (right.priority ?? 0) - (left.priority ?? 0),
  );
  return { triggered: nextTriggered, suppressed: nextSuppressed, influences };
}
