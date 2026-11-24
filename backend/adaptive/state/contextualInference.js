/**
 * contextualInference.js — Shared, module-aware context-to-state inference
 *
 * Infers temporary, non-clinical interaction states from timestamped
 * behavioural evidence (src/adaptive/context/interactionEvidence.js), the
 * user's own behavioural baseline, and the current activity's
 * interpretation profile (activityProfiles.js):
 *
 *   cognitiveOverload       — abandonment, rising latency, slower completion, …
 *   frustration             — repeated corrections / undo, failed attempts, …
 *   attentionFragmentation  — page / window switching, losing one's place, …
 *   cognitiveFatigue        — slowing typing, rising latency, inactivity in a task, …
 *
 * and represents explicit self-reports (check-ins) SEPARATELY:
 *
 *   selfReport              — what the user said, never inferred
 *
 * Principles (enforced in code, covered by tests):
 *   - Missing evidence stays missing: no evidence block → "unknown" with
 *     confidence 0; a feature without enough observations is unavailable.
 *   - Independent convergence: a state's confidence is a noisy-OR over
 *     evidence FAMILIES (sensors), and a state supported by one family only
 *     is capped below the policy trigger floor — except a profile-declared
 *     primary feature that PERSISTS across sub-windows.
 *   - Personal baseline first: baseline-relative evidence is used when the
 *     user's baseline has enough samples; otherwise conservative population
 *     thresholds with reduced reliability.
 *   - Temporal: evidence decays (half-life), states carry a recent/earlier
 *     stability status, recovery is detected, every state expires.
 *   - Deterministic: time is the evidence block's `observedAt` (or the
 *     snapshot timestamp); no wall clock, no randomness, no mutation.
 *   - Nothing here is stored. States are recomputed from evidence each
 *     decision and never become user attributes.
 *
 * Evidence families (independent sensors): editing (corrections, undo),
 * taskOutcome (lifecycle events), timing (response latency), typingRhythm
 * (inter-key gaps), taskActivity (inactivity during an active task),
 * navigation, focus (window interruptions), readingPosition (scroll
 * backtracks), session (session length), pointer (movement bursts),
 * conversation (repeated clarification requests in chat — counts only).
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { ActivityType, ACTIVITY_PROFILES } from "./activityProfiles.js";

export const CONTEXTUAL_STATES = Object.freeze({
  COGNITIVE_OVERLOAD: "cognitiveOverload",
  FRUSTRATION: "frustration",
  ATTENTION_FRAGMENTATION: "attentionFragmentation",
  COGNITIVE_FATIGUE: "cognitiveFatigue",
});

/** UserState dimension names for the inferred states. */
export const CONTEXTUAL_DIMENSIONS = Object.freeze({
  cognitiveOverload: "cognitiveOverloadState",
  frustration: "frustrationState",
  attentionFragmentation: "attentionFragmentationState",
  cognitiveFatigue: "cognitiveFatigueState",
});

/** Values of an inferred-state dimension. */
export const StateValue = Object.freeze({
  PRESENT: "present",
  EMERGING: "emerging",
  RECOVERING: "recovering",
  NONE: "none",
  UNKNOWN: "unknown",
});

export const INFERENCE_CONFIG = Object.freeze({
  /** Evidence older than this is ignored. */
  windowMs: 10 * 60 * 1000,
  /** "Recent" sub-window; the rest of the window is "earlier". */
  recentMs: 2 * 60 * 1000,
  /** Exponential decay half-life for event counts. */
  halfLifeMs: 3 * 60 * 1000,
  /** At/above → present; must match the policy trigger floor (EVIDENCE_THRESHOLDS.minTriggerConfidence). */
  presentAt: 0.5,
  emergingAt: 0.25,
  /** A single evidence family can never reach `presentAt` on its own... */
  singleFamilyCap: 0.45,
  /** ...unless it is a persistent, profile-declared primary feature. */
  persistentPrimaryCap: 0.65,
  /** A family counts toward convergence only above this contribution. */
  familyFloor: 0.15,
  /** Baseline-relative evidence needs this many baseline samples. */
  minBaselineSamples: 5,
  /** Population-threshold evidence is trusted less than personal-baseline evidence. */
  populationReliability: 0.7,
  /** Positive self-report dampens distress-like inferred states by this factor. */
  positiveReportDampening: 0.6,
  selfReport: { fullConfidenceMs: 10 * 60 * 1000, expiresMs: 30 * 60 * 1000 },
});

const SELF_REPORT_DISTRESS = new Set(["stressed", "anxious", "overwhelmed", "frustrated", "sad"]);
const SELF_REPORT_POSITIVE = new Set(["calm", "focused", "okay"]);
/** Closed vocabulary (mirrors interactionEvidence.SELF_REPORT_STATES); anything else is ignored. */
const SELF_REPORT_KNOWN = new Set([...SELF_REPORT_DISTRESS, ...SELF_REPORT_POSITIVE, "bored", "tired"]);
const listOf = (value) => (Array.isArray(value) ? value.filter(isRecord) : []);

/** Which features each state reads, with role weights. */
const STATE_MODELS = Object.freeze({
  cognitiveOverload: { abandonment: 1, latency: 0.8, completionSlowdown: 0.8, clarification: 0.8, navigationSwitching: 0.5, corrections: 0.4 },
  frustration: { failedAttempts: 1, corrections: 0.8, undo: 0.7, agitation: 0.4 },
  attentionFragmentation: { navigationSwitching: 1, focusInterrupts: 0.9, abandonResume: 0.8, positionLoss: 0.7 },
  cognitiveFatigue: { typingSlowdown: 0.9, inactivityDuringTask: 0.8, latency: 0.6, sessionLength: 0.4 },
});

/** Positive self-reports dampen these (they say the user feels fine). */
const DAMPENED_BY_POSITIVE_REPORT = new Set(["cognitiveOverload", "frustration", "attentionFragmentation"]);

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round = (v) => Math.round(v * 1000) / 1000;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isRecord = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function parseEpoch(value) {
  if (isNum(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
//  Window aggregation
// ─────────────────────────────────────────────────────────────────

function decay(ageMs, cfg) {
  return Math.pow(0.5, Math.max(0, ageMs) / cfg.halfLifeMs);
}

/**
 * Aggregate buckets for a sub-window [now - toAge, now - fromAge): raw counts
 * plus counts decayed relative to the sub-window's OWN end, so an earlier
 * sub-window is scored as it looked at the time (recovery detection), not
 * discounted twice.
 */
function aggregate(evidence, now, fromAge, toAge, cfg) {
  const ref = now - fromAge;
  const out = { raw: {}, decayed: {}, gapSum: 0, gapCount: 0, buckets: 0, ref };
  const bucketMs = isNum(evidence.bucketMs) ? evidence.bucketMs : 30000;
  for (const bucket of listOf(evidence.buckets)) {
    if (!isRecord(bucket) || !isNum(bucket.start)) continue;
    // The bucket being filled right now has its centre in the future; clamp
    // it to `now` so the freshest evidence is never skipped.
    const age = now - Math.min(bucket.start + bucketMs / 2, now);
    if (age < fromAge || age >= toAge) continue;
    out.buckets += 1;
    const w = decay(age - fromAge, cfg);
    for (const key of ["keystroke", "correction", "undo", "focusInterrupt", "navigationSwitch", "scrollBacktrack", "clarification"]) {
      const n = isNum(bucket[key]) ? bucket[key] : 0;
      out.raw[key] = (out.raw[key] ?? 0) + n;
      out.decayed[key] = (out.decayed[key] ?? 0) + n * w;
    }
    if (isNum(bucket.typingGapSumMs) && isNum(bucket.typingGapCount)) {
      out.gapSum += bucket.typingGapSumMs;
      out.gapCount += bucket.typingGapCount;
    }
  }
  const tasks = listOf(evidence.taskEvents).filter((e) => isNum(e.at) && now - e.at >= fromAge && now - e.at < toAge);
  out.tasks = tasks;
  out.latency = listOf(evidence.latencySamples).filter((s) => isNum(s.at) && isNum(s.seconds) && now - s.at >= fromAge && now - s.at < toAge);
  return out;
}

function decayedCount(items, now, cfg, predicate) {
  return items.filter(predicate).reduce((sum, item) => sum + decay(now - item.at, cfg), 0);
}

function baselineStat(baseline, activityType, metric, cfg) {
  const stat = baseline?.activities?.[activityType]?.metrics?.[metric];
  if (!isRecord(stat) || !isNum(stat.n) || stat.n < cfg.minBaselineSamples || !isNum(stat.mean)) return null;
  const variance = stat.n > 1 && isNum(stat.m2) ? stat.m2 / (stat.n - 1) : 0;
  return { n: stat.n, mean: stat.mean, sd: Math.sqrt(Math.max(0, variance)) };
}

/**
 * Personal-baseline strength when a baseline exists, else population
 * strength with reduced reliability. Returns null when neither applies.
 */
function relativeStrength(value, stat, { ratioStart, ratioFull, popStart, popFull, minMean }, cfg) {
  if (!isNum(value)) return null;
  if (stat) {
    const ratio = value / Math.max(stat.mean, minMean);
    // A large deviation that is still within the user's own normal spread is not evidence.
    if (stat.sd > 0 && value - stat.mean < 1.5 * stat.sd) {
      return { strength: 0, reliability: 1, baselineRelative: true, ratio: round(ratio) };
    }
    return { strength: clamp01((ratio - ratioStart) / (ratioFull - ratioStart)), reliability: 1, baselineRelative: true, ratio: round(ratio) };
  }
  if (!isNum(popStart)) return null; // no population threshold → needs a baseline
  return { strength: clamp01((value - popStart) / (popFull - popStart)), reliability: cfg.populationReliability, baselineRelative: false };
}

// ─────────────────────────────────────────────────────────────────
//  Feature extraction
// ─────────────────────────────────────────────────────────────────

function feature(id, family, data) {
  return { id, family, ...data };
}

/** Extract evidence features for one sub-window. */
function extractFeatures(win, ctx) {
  const { cfg, baseline, activityType, profile, snapshot, minutes } = ctx;
  const now = win.ref;
  const features = {};
  const d = win.decayed;

  // Editing: corrections relative to typing volume.
  if ((win.raw.keystroke ?? 0) >= 20) {
    const rate = (d.correction ?? 0) / Math.max(1, d.keystroke ?? 0);
    const rel = relativeStrength(rate, baselineStat(baseline, activityType, "correctionRate", cfg),
      { ratioStart: 1.5, ratioFull: 4, popStart: 0.15, popFull: 0.4, minMean: 0.02 }, cfg);
    if (rel) features.corrections = feature("corrections", "editing", { value: round(rate), ...rel, source: "interactionEvidence.buckets.correction" });
  }
  if ((win.raw.keystroke ?? 0) >= 10 || (win.raw.undo ?? 0) > 0) {
    const undos = d.undo ?? 0;
    features.undo = feature("undo", "editing", {
      value: round(undos), strength: clamp01((undos - 1) / 4), reliability: cfg.populationReliability,
      baselineRelative: false, source: "interactionEvidence.buckets.undo",
    });
  }

  // Task outcomes (support-module lifecycle).
  const tasks = win.tasks;
  if (tasks.length > 0) {
    const failed = decayedCount(tasks, now, cfg, (e) => e.type === "failed" || (e.type === "started" && e.retry));
    features.failedAttempts = feature("failedAttempts", "taskOutcome", {
      value: round(failed), strength: clamp01((failed - 1) / 3), reliability: 1, baselineRelative: false, source: "interactionEvidence.taskEvents",
    });
    const abandoned = decayedCount(tasks, now, cfg, (e) => e.type === "abandoned");
    features.abandonment = feature("abandonment", "taskOutcome", {
      value: round(abandoned), strength: clamp01(abandoned / 2.5), reliability: 1, baselineRelative: false, source: "interactionEvidence.taskEvents",
    });
    const resumedAfterBreak = decayedCount(tasks, now, cfg, (e) => e.type === "resumed" || (e.type === "started" && e.retry));
    const breaks = decayedCount(tasks, now, cfg, (e) => e.type === "paused" || e.type === "abandoned");
    const cycles = Math.min(resumedAfterBreak, breaks);
    features.abandonResume = feature("abandonResume", "taskOutcome", {
      value: round(cycles), strength: clamp01((cycles - 0.5) / 2), reliability: 1, baselineRelative: false, source: "interactionEvidence.taskEvents",
    });
    const completed = tasks.filter((e) => e.type === "completed" && isNum(e.durationMs));
    if (completed.length > 0) {
      const latest = completed[completed.length - 1].durationMs;
      const rel = relativeStrength(latest, baselineStat(baseline, activityType, "taskCompletionMs", cfg),
        { ratioStart: 1.5, ratioFull: 3, popStart: null, popFull: null, minMean: 1000 }, cfg);
      if (rel) features.completionSlowdown = feature("completionSlowdown", "taskOutcome", { value: latest, ...rel, source: "interactionEvidence.taskEvents.durationMs" });
    }
  }

  // Timing: response latency after navigation.
  if (win.latency.length >= 2) {
    const mean = win.latency.reduce((s, x) => s + x.seconds, 0) / win.latency.length;
    const rel = relativeStrength(mean, baselineStat(baseline, activityType, "latencySeconds", cfg),
      { ratioStart: 1.6, ratioFull: 3, popStart: 8, popFull: 20, minMean: 0.5 }, cfg);
    if (rel) features.latency = feature("latency", "timing", { value: round(mean), ...rel, source: "interactionEvidence.latencySamples" });
  }

  // Typing slowdown: relative to the personal baseline only (typing speed
  // varies far too much between people for a population threshold).
  if (win.gapCount >= 10) {
    const gap = win.gapSum / win.gapCount;
    const rel = relativeStrength(gap, baselineStat(baseline, activityType, "typingGapMs", cfg),
      { ratioStart: 1.4, ratioFull: 2.5, popStart: null, popFull: null, minMean: 50 }, cfg);
    if (rel) features.typingSlowdown = feature("typingSlowdown", "typingRhythm", { value: Math.round(gap), ...rel, source: "interactionEvidence.buckets.typingGap" });
  }

  // Navigation: real page switches.
  if (win.buckets > 0) {
    const switches = d.navigationSwitch ?? 0;
    const perMin = switches / minutes;
    const stat = baselineStat(baseline, activityType, "navigationSwitchRate", cfg);
    const rel = stat
      ? relativeStrength(perMin, stat, { ratioStart: 2, ratioFull: 5, minMean: 0.1 }, cfg)
      : { strength: clamp01((switches - 2) / 4), reliability: cfg.populationReliability, baselineRelative: false };
    features.navigationSwitching = feature("navigationSwitching", "navigation", { value: round(switches), ...rel, source: "interactionEvidence.buckets.navigationSwitch" });

    const interrupts = d.focusInterrupt ?? 0;
    const iStat = baselineStat(baseline, activityType, "focusInterruptRate", cfg);
    const iRel = iStat
      ? relativeStrength(interrupts / minutes, iStat, { ratioStart: 2, ratioFull: 5, minMean: 0.1 }, cfg)
      : { strength: clamp01((interrupts - 2) / 4), reliability: cfg.populationReliability, baselineRelative: false };
    features.focusInterrupts = feature("focusInterrupts", "focus", { value: round(interrupts), ...iRel, source: "interactionEvidence.buckets.focusInterrupt" });

    // Conversation: repeated requests for clarification (counts only).
    const clarifications = d.clarification ?? 0;
    features.clarification = feature("clarification", "conversation", {
      value: round(clarifications), strength: clamp01((clarifications - 1) / 3), reliability: cfg.populationReliability,
      baselineRelative: false, source: "interactionEvidence.buckets.clarification",
    });

    const backtracks = d.scrollBacktrack ?? 0;
    features.positionLoss = feature("positionLoss", "readingPosition", {
      value: round(backtracks), strength: clamp01((backtracks - 1) / 3), reliability: cfg.populationReliability,
      baselineRelative: false, source: "interactionEvidence.buckets.scrollBacktrack",
    });
  }

  // Inactivity during an ACTIVE task (never plain idleness; never where the
  // activity expects stillness).
  if (ctx.includeSnapshotFeatures && isNum(profile.inactivityThresholdS)) {
    const idle = snapshot?.deviceInteraction?.timeSinceLastInteraction;
    if (isNum(idle) && ctx.taskActive) {
      const threshold = profile.inactivityThresholdS;
      features.inactivityDuringTask = feature("inactivityDuringTask", "taskActivity", {
        value: idle, strength: clamp01((idle - threshold) / threshold), reliability: cfg.populationReliability,
        baselineRelative: false, source: "deviceInteraction.timeSinceLastInteraction",
      });
    }
  }
  if (ctx.includeSnapshotFeatures) {
    const sessionS = snapshot?.deviceInteraction?.currentSessionDuration;
    if (isNum(sessionS)) {
      features.sessionLength = feature("sessionLength", "session", {
        value: sessionS, strength: clamp01((sessionS / 60 - 45) / 45) * 0.5, reliability: cfg.populationReliability,
        baselineRelative: false, source: "deviceInteraction.currentSessionDuration",
      });
    }
    // Pointer agitation: a weak, corroborating-only cue (never on its own).
    const burstActive = snapshot?.behavior?.movementBurst?.active === true;
    const burstMood = snapshot?.mood?.basis === "interaction";
    if (burstActive || burstMood) {
      features.agitation = feature("agitation", "pointer", {
        value: 1, strength: 0.5, reliability: 0.6, baselineRelative: false,
        source: burstActive ? "behavior.movementBurst" : "mood.basis:interaction",
      });
    }
  }
  return features;
}

// ─────────────────────────────────────────────────────────────────
//  State scoring
// ─────────────────────────────────────────────────────────────────

function scoreState(stateId, features, profile, cfg, { allowPersistentPrimary, persistentFeatures }) {
  const model = STATE_MODELS[stateId];
  const byFamily = new Map();
  const evidence = [];
  for (const [featureId, roleWeight] of Object.entries(model)) {
    const f = features[featureId];
    if (!f) continue;
    const activityWeight = profile.weights[featureId] ?? 0;
    const contribution = clamp01(f.strength * f.reliability * roleWeight * activityWeight);
    if (contribution <= 0) continue;
    evidence.push({
      feature: featureId, family: f.family, value: f.value, strength: round(f.strength),
      reliability: f.reliability, activityWeight, contribution: round(contribution),
      baselineRelative: f.baselineRelative === true, ...(isNum(f.ratio) ? { ratio: f.ratio } : {}),
      source: f.source,
    });
    if ((byFamily.get(f.family) ?? 0) < contribution) byFamily.set(f.family, contribution);
  }
  const families = [...byFamily.entries()].filter(([, c]) => c >= cfg.familyFloor);
  let confidence = 1 - [...byFamily.values()].reduce((p, c) => p * (1 - c), 1);
  let convergence = families.length >= 2 ? "multi_family" : families.length === 1 ? "single_family" : "none";
  if (families.length < 2) {
    const primaries = profile.persistentPrimary[stateId] ?? [];
    const persistentPrimary = allowPersistentPrimary && primaries.some((id) => persistentFeatures.has(id));
    const cap = persistentPrimary ? cfg.persistentPrimaryCap : cfg.singleFamilyCap;
    if (persistentPrimary && families.length === 1) convergence = "persistent_primary";
    confidence = Math.min(confidence, cap);
  }
  return { confidence: round(clamp01(confidence)), evidence, families: families.map(([f]) => f), convergence };
}

function selfReportView(evidence, now, cfg) {
  const reports = listOf(evidence?.selfReports).filter((r) => SELF_REPORT_KNOWN.has(r.state) && isNum(r.at) && r.at <= now);
  if (reports.length === 0) return null;
  const latest = reports[reports.length - 1];
  const age = now - latest.at;
  const { fullConfidenceMs, expiresMs } = cfg.selfReport;
  if (age >= expiresMs) return null;
  const confidence = age <= fullConfidenceMs ? 1 : clamp01(1 - (age - fullConfidenceMs) / (expiresMs - fullConfidenceMs));
  return {
    id: "selfReport",
    kind: "self_reported",
    state: latest.state,
    distress: SELF_REPORT_DISTRESS.has(latest.state),
    positive: SELF_REPORT_POSITIVE.has(latest.state),
    confidence: round(confidence),
    reportedAt: latest.at,
    moduleId: latest.moduleId ?? null,
    source: latest.source ?? "checkin",
    expiresAt: latest.at + expiresMs,
  };
}

/**
 * Infer contextual states.
 *
 * @param {object} snapshot - ContextSnapshot (reads `interactionEvidence`,
 *   `deviceInteraction`, `behavior.movementBurst`, `mood.basis`, `timestamp`)
 * @param {object} [options]
 * @param {object} [options.profile] - Activity profile (activityProfiles.js)
 * @param {object} [options.baseline] - The user's behavioural baseline
 * @param {object} [options.moduleId]
 * @param {object} [options.config]
 * @returns {{ available: boolean, activityType: string, moduleId: string|null,
 *   observedAt: number|null, states: Record<string, object>, selfReport: object|null,
 *   metrics: Record<string, number> }}
 */
export function inferContextualStates(snapshot, options = {}) {
  const cfg = { ...INFERENCE_CONFIG, ...(options.config ?? {}) };
  const profile = options.profile ?? ACTIVITY_PROFILES[ActivityType.GENERAL];
  const activityType = profile.id;
  const moduleId = typeof options.moduleId === "string" ? options.moduleId : null;
  const evidence = isRecord(snapshot?.interactionEvidence) ? snapshot.interactionEvidence : null;
  const now = parseEpoch(evidence?.observedAt) ?? parseEpoch(snapshot?.timestamp);

  const unknownStates = () => Object.fromEntries(Object.values(CONTEXTUAL_STATES).map((id) => [id, {
    id, kind: "inferred", value: StateValue.UNKNOWN, confidence: 0, stability: "absent",
    scope: { moduleId, activityType }, evidence: [], provenance: [], observedAt: now,
    reasons: ["No timestamped interaction evidence available"],
  }]));

  if (!evidence || now === null) {
    return { available: false, activityType, moduleId, observedAt: now, states: unknownStates(), selfReport: null, metrics: {} };
  }

  const windowMinutes = cfg.windowMs / 60000;
  const taskEvents = listOf(evidence.taskEvents).filter((e) => isNum(e.at) && now - e.at < cfg.windowMs);
  const openTask = (() => {
    const lastByModule = new Map();
    for (const e of taskEvents) lastByModule.set(e.moduleId, e.type);
    return [...lastByModule.values()].some((t) => t === "started" || t === "resumed");
  })();
  const recentTyping = isNum(evidence.lastKeystrokeAt) && now - evidence.lastKeystrokeAt < 5 * 60 * 1000;
  const baseCtx = {
    now, cfg, baseline: options.baseline, activityType, profile, snapshot,
    taskActive: openTask || recentTyping,
  };

  const whole = aggregate(evidence, now, 0, cfg.windowMs, cfg);
  const recent = aggregate(evidence, now, 0, cfg.recentMs, cfg);
  const earlier = aggregate(evidence, now, cfg.recentMs, cfg.windowMs, cfg);
  const fWhole = extractFeatures(whole, { ...baseCtx, includeSnapshotFeatures: true, minutes: windowMinutes });
  const fRecent = extractFeatures(recent, { ...baseCtx, includeSnapshotFeatures: true, minutes: cfg.recentMs / 60000 });
  const fEarlier = extractFeatures(earlier, { ...baseCtx, includeSnapshotFeatures: false, minutes: (cfg.windowMs - cfg.recentMs) / 60000 });

  // A feature PERSISTS when it shows up (strength > 0) in both sub-windows.
  const persistentFeatures = new Set(
    Object.keys(fRecent).filter((id) => (fRecent[id]?.strength ?? 0) > 0 && (fEarlier[id]?.strength ?? 0) > 0),
  );

  const selfReport = selfReportView(evidence, now, cfg);
  const lastEvidenceAt = Math.max(
    ...listOf(evidence.buckets).map((b) => (isNum(b.start) ? b.start + (isNum(evidence.bucketMs) ? evidence.bucketMs : 30000) : -Infinity)),
    ...taskEvents.map((e) => e.at),
    -Infinity,
  );

  const states = {};
  for (const stateId of Object.values(CONTEXTUAL_STATES)) {
    const opts = { allowPersistentPrimary: true, persistentFeatures };
    const full = scoreState(stateId, fWhole, profile, cfg, opts);
    const r = scoreState(stateId, fRecent, profile, cfg, opts);
    const e = scoreState(stateId, fEarlier, profile, cfg, { allowPersistentPrimary: false, persistentFeatures });

    let confidence = full.confidence;
    const reasons = [];
    if (selfReport?.positive && DAMPENED_BY_POSITIVE_REPORT.has(stateId) && confidence > 0) {
      confidence = round(confidence * cfg.positiveReportDampening);
      reasons.push(`User reported feeling "${selfReport.state}" — behavioural evidence weighted down`);
    }

    const observed = full.evidence.length > 0 || Object.keys(fWhole).length > 0;
    let value;
    if (!observed) value = StateValue.UNKNOWN;
    else if (confidence >= cfg.presentAt && r.confidence >= cfg.emergingAt) value = StateValue.PRESENT;
    else if (e.confidence >= cfg.presentAt && r.confidence < cfg.emergingAt) value = StateValue.RECOVERING;
    else if (confidence >= cfg.emergingAt) value = StateValue.EMERGING;
    else value = StateValue.NONE;

    const stability =
      r.confidence >= cfg.emergingAt && e.confidence >= cfg.emergingAt ? "persistent"
        : r.confidence >= cfg.emergingAt ? "emerging"
          : e.confidence >= cfg.emergingAt ? "recovering"
            : "absent";

    if (full.evidence.length === 0) {
      reasons.push(observed ? "No supporting evidence observed in the window" : "No timestamped interaction evidence available");
    } else {
      reasons.push(...full.evidence.map((x) =>
        `${x.feature} (${x.family}) contributed ${x.contribution}${x.baselineRelative ? " relative to the personal baseline" : " against a population threshold"}`));
      if (full.convergence === "single_family") reasons.push("Only one evidence family — capped below the trigger floor");
      if (full.convergence === "persistent_primary") reasons.push("Persistent primary evidence for this activity");
    }

    states[stateId] = {
      id: stateId,
      kind: "inferred",
      value,
      // Missing evidence keeps confidence 0: "none" is not evidence of absence.
      confidence: value === StateValue.UNKNOWN || value === StateValue.NONE ? 0 : confidence,
      stability,
      convergence: full.convergence,
      families: full.families,
      scope: { moduleId, activityType },
      evidence: full.evidence,
      provenance: [...new Set(full.evidence.map((x) => x.source))],
      observedAt: now,
      window: { startedAt: now - cfg.windowMs, endedAt: now, recentMs: cfg.recentMs, halfLifeMs: cfg.halfLifeMs },
      expiresAt: Number.isFinite(lastEvidenceAt) ? lastEvidenceAt + cfg.windowMs : now,
      reasons,
    };
  }

  // Window-level metrics of NORMAL behaviour for the shared baseline (only
  // metrics with enough observations; the caller decides whether to record).
  const metrics = {};
  if ((whole.raw.keystroke ?? 0) >= 20) {
    metrics.correctionRate = round((whole.raw.correction ?? 0) / whole.raw.keystroke);
    metrics.undoRate = round((whole.raw.undo ?? 0) / whole.raw.keystroke);
  }
  if (whole.latency.length >= 2) metrics.latencySeconds = round(whole.latency.reduce((s, x) => s + x.seconds, 0) / whole.latency.length);
  if (whole.gapCount >= 10) metrics.typingGapMs = Math.round(whole.gapSum / whole.gapCount);
  const completedTasks = whole.tasks.filter((t) => t.type === "completed" && isNum(t.durationMs));
  if (completedTasks.length > 0) metrics.taskCompletionMs = completedTasks[completedTasks.length - 1].durationMs;
  if (whole.buckets >= 4) {
    metrics.focusInterruptRate = round((whole.raw.focusInterrupt ?? 0) / windowMinutes);
    metrics.navigationSwitchRate = round((whole.raw.navigationSwitch ?? 0) / windowMinutes);
  }

  return { available: true, activityType, moduleId, observedAt: now, states, selfReport, metrics };
}
