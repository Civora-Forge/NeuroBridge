/**
 * interactionEvidence.js — Timestamped behavioural evidence (Role 1)
 *
 * The live interaction tracker keeps running aggregates (a correction rate
 * that resets with every typing burst, an interruption counter that never
 * resets). Aggregates cannot be windowed, decayed or checked for persistence,
 * which the context-to-state inference layer needs. This module keeps a
 * small, bounded, timestamped evidence log alongside those aggregates:
 *
 *   - 30 s buckets of interaction counts (keystrokes, corrections, undo,
 *     window-level focus interruptions, real navigation switches, large
 *     scroll backtracks) plus inter-key gap sums for typing consistency;
 *   - response-latency samples (first interaction after a navigation);
 *   - task lifecycle events reported by support modules (started / paused /
 *     resumed / completed / abandoned / failed), with retry detection and
 *     completion durations;
 *   - explicit user self-reports (check-ins), kept separate from anything
 *     inferred from behaviour.
 *
 * Module attribution: every bucket, latency sample and keystroke is tagged
 * with the module that was active when it was observed (`setEvidenceScope`,
 * set once by the app-level runtime from the route). Evidence is recorded
 * ONCE; readers get views of the same log:
 *   - the app-level runtime reads the merged view (all modules);
 *   - a page-level decision path reads only its own module's evidence, so
 *     one activity's evidence never shapes another activity's inference.
 * Task events carry their own moduleId. Self-reports are about the person,
 * not an activity, so every view includes them.
 *
 * Everything is in memory only (never persisted), bounded to a 15-minute
 * window (self-reports: 60 minutes), and observational: this module records
 * what happened. It never interprets evidence as a user state — that is the
 * job of backend/adaptive/state/contextualInference.js.
 *
 * Ownership: Context & Perception Engineer
 */

export const EVIDENCE_BUCKET_MS = 30 * 1000;
export const EVIDENCE_WINDOW_MS = 15 * 60 * 1000;
export const SELF_REPORT_WINDOW_MS = 60 * 60 * 1000;
const MAX_LATENCY_SAMPLES = 40;
const MAX_TASK_EVENTS = 60;
const MAX_SELF_REPORTS = 20;
/** Two correction signals for one keystroke (keydown + beforeinput) within this gap count once. */
const DUPLICATE_SIGNAL_MS = 100;

/** Bucket counters. All are plain observation counts. */
export const EVIDENCE_COUNTERS = Object.freeze([
  "keystroke",
  "correction",
  "undo",
  "focusInterrupt",
  "navigationSwitch",
  "scrollBacktrack",
  "clarification",
]);

/**
 * Phrases that ask for something to be explained again. Matched locally on
 * the user's chat message; only a COUNT is recorded — the text is never
 * stored, classified further or sent anywhere by this module.
 */
const CLARIFICATION_PATTERN =
  /\b(what do(?:es)? (?:you|that|this|it) mean|what does .{1,40} mean|i don'?t (?:get|understand)|i still don'?t|(?:can|could) you (?:explain|clarify)|explain (?:that|this|it) (?:again|differently)|say that again|i'?m (?:confused|lost)|confus(?:ed|ing))\b/i;

/** Whether a chat message asks for clarification (local check, no storage). */
export function isClarificationRequest(text) {
  return typeof text === "string" && text.length <= 2000 && CLARIFICATION_PATTERN.test(text);
}

/** Record that the user asked for clarification (count only). */
export function recordClarificationRequest() {
  const now = nowMs();
  bucketFor(now).clarification += 1;
  prune(now);
  notify();
}

/** Count a chat message as a clarification request when it is one. Returns whether it was. */
export function noteChatMessageForClarification(text) {
  if (!isClarificationRequest(text)) return false;
  recordClarificationRequest();
  return true;
}

export const TaskEventType = Object.freeze({
  STARTED: "started",
  PAUSED: "paused",
  RESUMED: "resumed",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
  FAILED: "failed",
});

/**
 * Closed vocabulary for explicit self-reports. `distress` marks reports the
 * user gave about feeling unwell; it is a label of what they SAID, never a
 * clinical category.
 */
export const SELF_REPORT_STATES = Object.freeze({
  calm: { distress: false, positive: true },
  focused: { distress: false, positive: true },
  okay: { distress: false, positive: true },
  bored: { distress: false, positive: false },
  tired: { distress: false, positive: false },
  stressed: { distress: true, positive: false },
  anxious: { distress: true, positive: false },
  overwhelmed: { distress: true, positive: false },
  frustrated: { distress: true, positive: false },
  sad: { distress: true, positive: false },
});

let buckets = new Map();
let currentScope = null;
let lastKeystrokeByScope = new Map();
let latencySamples = [];
/** Times (ms) of real page switches in the last minute — timestamps only, no paths. */
let navigationSwitchTimes = [];
let taskEvents = [];
let selfReports = [];
let lastCorrectionAt = null;
let lastUndoAt = null;
let lastKeystrokeAt = null;
let listeners = new Set();

function nowMs() {
  return Date.now();
}

function prune(now) {
  for (const [key, bucket] of [...buckets.entries()]) {
    if (now - bucket.start > EVIDENCE_WINDOW_MS) buckets.delete(key);
  }
  latencySamples = latencySamples.filter((s) => now - s.at <= EVIDENCE_WINDOW_MS).slice(-MAX_LATENCY_SAMPLES);
  taskEvents = taskEvents.filter((e) => now - e.at <= EVIDENCE_WINDOW_MS).slice(-MAX_TASK_EVENTS);
  selfReports = selfReports.filter((r) => now - r.at <= SELF_REPORT_WINDOW_MS).slice(-MAX_SELF_REPORTS);
}

function bucketFor(now) {
  const start = now - (now % EVIDENCE_BUCKET_MS);
  const key = `${currentScope ?? ""}|${start}`;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { start, scope: currentScope, typingGapSumMs: 0, typingGapCount: 0 };
    for (const counter of EVIDENCE_COUNTERS) bucket[counter] = 0;
    buckets.set(key, bucket);
  }
  return bucket;
}

/**
 * Attribute subsequent DOM evidence to a module (canonical support-module
 * id from the route; null on non-module pages). Called by the app-level
 * runtime only.
 */
export function setEvidenceScope(moduleId) {
  currentScope = typeof moduleId === "string" && moduleId.trim().length > 0 ? moduleId : null;
}

export function getEvidenceScope() {
  return currentScope;
}

function notify() {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // A failing subscriber must not break evidence collection.
    }
  }
}

/** Subscribe to explicit (non-DOM) evidence: task events and self-reports. */
export function subscribeInteractionEvidence(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A printable keystroke; `gapMs` is the gap to the previous keystroke in the same typing run. */
export function recordKeystroke(gapMs) {
  const now = nowMs();
  const bucket = bucketFor(now);
  bucket.keystroke += 1;
  if (typeof gapMs === "number" && Number.isFinite(gapMs) && gapMs > 0) {
    bucket.typingGapSumMs += gapMs;
    bucket.typingGapCount += 1;
  }
  lastKeystrokeAt = now;
  lastKeystrokeByScope.set(currentScope, now);
  prune(now);
}

/** A deletion (Backspace / Delete / delete input). Keydown + beforeinput for one key count once. */
export function recordCorrection() {
  const now = nowMs();
  if (lastCorrectionAt !== null && now - lastCorrectionAt < DUPLICATE_SIGNAL_MS) return;
  lastCorrectionAt = now;
  bucketFor(now).correction += 1;
  prune(now);
}

/** An undo (Ctrl/Cmd+Z or historyUndo input). Keydown + beforeinput count once. */
export function recordUndo() {
  const now = nowMs();
  if (lastUndoAt !== null && now - lastUndoAt < DUPLICATE_SIGNAL_MS) return;
  lastUndoAt = now;
  bucketFor(now).undo += 1;
  prune(now);
}

/** The window / tab lost focus (not an element blur inside the page). */
export function recordFocusInterrupt() {
  const now = nowMs();
  bucketFor(now).focusInterrupt += 1;
  prune(now);
}

/** Rolling window for the demo repeated-navigation count. */
export const NAVIGATION_BURST_WINDOW_MS = 60 * 1000;
const MAX_NAVIGATION_SWITCH_TIMES = 16;

/** A real switch to a different page (not the landing page, not a repeat). */
export function recordNavigationSwitch() {
  const now = nowMs();
  bucketFor(now).navigationSwitch += 1;
  navigationSwitchTimes = [...navigationSwitchTimes, now]
    .filter((at) => now - at <= NAVIGATION_BURST_WINDOW_MS)
    .slice(-MAX_NAVIGATION_SWITCH_TIMES);
  prune(now);
}

/** A large jump back up the page (re-finding one's place). */
export function recordScrollBacktrack() {
  const now = nowMs();
  bucketFor(now).scrollBacktrack += 1;
  prune(now);
}

/** First interaction after a navigation, in seconds. */
export function recordResponseLatency(seconds) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return;
  const now = nowMs();
  latencySamples.push({ at: now, seconds, scope: currentScope });
  prune(now);
}

/**
 * A support-module task lifecycle event. A `started` event for a module whose
 * previous attempt in the window was abandoned or failed is marked `retry`.
 * A `completed` event carries the duration since the matching start.
 *
 * @param {{ type: string, moduleId: string, taskId?: string }} event
 */
export function recordTaskEvent({ type, moduleId, taskId } = {}) {
  if (!Object.values(TaskEventType).includes(type)) return;
  if (typeof moduleId !== "string" || moduleId.trim().length === 0) return;
  const now = nowMs();
  prune(now);
  const entry = { type, moduleId, at: now };
  if (typeof taskId === "string" && taskId) entry.taskId = taskId;
  const sameModule = taskEvents.filter((e) => e.moduleId === moduleId);
  if (type === TaskEventType.STARTED) {
    const lastTerminal = [...sameModule].reverse().find((e) =>
      [TaskEventType.ABANDONED, TaskEventType.FAILED, TaskEventType.COMPLETED].includes(e.type),
    );
    if (lastTerminal && lastTerminal.type !== TaskEventType.COMPLETED) entry.retry = true;
  }
  if (type === TaskEventType.COMPLETED) {
    const start = [...sameModule].reverse().find((e) =>
      e.type === TaskEventType.STARTED && (!taskId || !e.taskId || e.taskId === taskId),
    );
    if (start) entry.durationMs = now - start.at;
  }
  taskEvents.push(entry);
  notify();
}

/**
 * An explicit self-report from the user (e.g. a mood check-in). Stored
 * separately from behavioural evidence; unknown labels are ignored.
 *
 * @param {{ state: string, moduleId?: string, source?: string }} report
 */
export function recordSelfReport({ state, moduleId, source } = {}) {
  const label = typeof state === "string" ? state.trim().toLowerCase() : "";
  if (!Object.prototype.hasOwnProperty.call(SELF_REPORT_STATES, label)) return;
  const now = nowMs();
  prune(now);
  selfReports.push({
    state: label,
    at: now,
    moduleId: typeof moduleId === "string" && moduleId ? moduleId : null,
    source: typeof source === "string" && source ? source : "checkin",
  });
  notify();
}

/** Sum same-time buckets across modules (the app-level, all-module view). */
function mergedBuckets() {
  const byStart = new Map();
  for (const bucket of buckets.values()) {
    const merged = byStart.get(bucket.start) ?? { start: bucket.start, typingGapSumMs: 0, typingGapCount: 0 };
    for (const counter of EVIDENCE_COUNTERS) merged[counter] = (merged[counter] ?? 0) + bucket[counter];
    merged.typingGapSumMs += bucket.typingGapSumMs;
    merged.typingGapCount += bucket.typingGapCount;
    byStart.set(bucket.start, merged);
  }
  return [...byStart.values()];
}

/**
 * Serializable view of the evidence log for a ContextSnapshot.
 *
 * @param {{ moduleId?: string }} [options] - Omit for the app-level view
 *   (all modules merged). Pass a module id for that module's evidence only
 *   (its buckets, latency samples and task events; self-reports always).
 * @returns {{ observedAt: number, scope: string|null, bucketMs: number,
 *   windowMs: number, buckets: object[], latencySamples: object[],
 *   taskEvents: object[], selfReports: object[], lastKeystrokeAt: number|null }}
 */
export function getInteractionEvidenceSnapshot({ moduleId } = {}) {
  const now = nowMs();
  prune(now);
  const scoped = typeof moduleId === "string" && moduleId.trim().length > 0 ? moduleId : null;
  const viewBuckets = scoped
    ? [...buckets.values()].filter((b) => b.scope === scoped).map(({ scope: _scope, ...b }) => ({ ...b }))
    : mergedBuckets();
  return {
    observedAt: now,
    scope: scoped,
    bucketMs: EVIDENCE_BUCKET_MS,
    windowMs: EVIDENCE_WINDOW_MS,
    buckets: viewBuckets.sort((a, b) => a.start - b.start),
    latencySamples: latencySamples
      .filter((s) => !scoped || s.scope === scoped)
      .map(({ scope: _scope, ...s }) => ({ ...s })),
    taskEvents: taskEvents.filter((e) => !scoped || e.moduleId === scoped).map((e) => ({ ...e })),
    selfReports: selfReports.map((r) => ({ ...r })),
    // Count only (no timestamps or paths leave this module). App-level view
    // only: page switches are movements BETWEEN modules.
    recentNavigationSwitches: {
      windowMs: NAVIGATION_BURST_WINDOW_MS,
      count: scoped ? 0 : navigationSwitchTimes.filter((at) => now - at <= NAVIGATION_BURST_WINDOW_MS).length,
    },
    lastKeystrokeAt: scoped ? lastKeystrokeByScope.get(scoped) ?? null : lastKeystrokeAt,
  };
}

/** Drop all evidence (user switch, sign-out, tests). Subscribers are kept. */
export function clearInteractionEvidence() {
  buckets = new Map();
  lastKeystrokeByScope = new Map();
  latencySamples = [];
  navigationSwitchTimes = [];
  taskEvents = [];
  selfReports = [];
  lastCorrectionAt = null;
  lastUndoAt = null;
  lastKeystrokeAt = null;
  notify();
}
