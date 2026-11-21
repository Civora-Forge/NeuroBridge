/**
 * activityProfiles.js — Module-aware interpretation of behavioural evidence
 *
 * One shared inference model (contextualInference.js) reads the same
 * evidence everywhere; what differs between modules is how DIAGNOSTIC each
 * kind of evidence is for the current activity. Slow reading or long pauses
 * are normal while reading or doing a breathing exercise; repeated failed
 * attempts mean much more in a step-by-step task; navigation switching is a
 * stronger fragmentation cue in a structured activity than on the dashboard.
 *
 * A profile is data only: per-feature weights (0 = not diagnostic here,
 * 1 = fully diagnostic), the inactivity threshold for "prolonged inactivity
 * during an active task" (null = inactivity is expected here), and the
 * features that may establish a state on their own when they PERSIST
 * (repeated across sub-windows) — every other state needs independent
 * converging evidence.
 *
 * Activity types are shared across modules (the baseline is keyed by them),
 * so modules of the same kind are interpreted identically.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

export const ActivityType = Object.freeze({
  READING: "reading",
  STRUCTURED_TASK: "structured_task",
  TIMED_FOCUS: "timed_focus",
  REGULATION: "regulation",
  REFLECTIVE_WRITING: "reflective_writing",
  PRACTICE: "practice",
  GENERAL: "general",
});

/** Default diagnostic weight of each evidence feature. */
const DEFAULT_WEIGHTS = Object.freeze({
  corrections: 0.7,
  undo: 0.7,
  failedAttempts: 0.8,
  abandonment: 0.8,
  abandonResume: 0.7,
  latency: 0.7,
  completionSlowdown: 0.7,
  navigationSwitching: 0.7,
  focusInterrupts: 0.7,
  positionLoss: 0.5,
  inactivityDuringTask: 0.7,
  typingSlowdown: 0.7,
  sessionLength: 0.5,
  agitation: 0.4,
  clarification: 0.7,
});

function profile(id, overrides = {}, { inactivityThresholdS = 120, persistentPrimary = {} } = {}) {
  return Object.freeze({
    id,
    weights: Object.freeze({ ...DEFAULT_WEIGHTS, ...overrides }),
    inactivityThresholdS,
    persistentPrimary: Object.freeze(persistentPrimary),
  });
}

export const ACTIVITY_PROFILES = Object.freeze({
  // Reading: slowness and pauses are reading, not fatigue; losing one's
  // place and being pulled away from the text are the meaningful cues.
  [ActivityType.READING]: profile(
    ActivityType.READING,
    { latency: 0.3, typingSlowdown: 0.2, corrections: 0.4, positionLoss: 0.9, focusInterrupts: 0.9, navigationSwitching: 0.6 },
    { inactivityThresholdS: 300, persistentPrimary: { attentionFragmentation: ["positionLoss"] } },
  ),
  // Structured step-by-step tasks: failed attempts and abandonment are
  // strongly diagnostic; leaving the structure is fragmentation.
  [ActivityType.STRUCTURED_TASK]: profile(
    ActivityType.STRUCTURED_TASK,
    { failedAttempts: 1, abandonment: 1, abandonResume: 0.9, navigationSwitching: 1, completionSlowdown: 0.9 },
    { inactivityThresholdS: 90, persistentPrimary: { frustration: ["failedAttempts"], attentionFragmentation: ["navigationSwitching"] } },
  ),
  // Timed focus blocks: interruptions and leaving the block matter most.
  [ActivityType.TIMED_FOCUS]: profile(
    ActivityType.TIMED_FOCUS,
    { focusInterrupts: 1, navigationSwitching: 0.9, abandonResume: 0.9 },
    { inactivityThresholdS: 180, persistentPrimary: { attentionFragmentation: ["focusInterrupts"] } },
  ),
  // Regulation (breathing, grounding, calm modes, check-ins): stillness,
  // slowness and long pauses are the activity itself.
  [ActivityType.REGULATION]: profile(
    ActivityType.REGULATION,
    { latency: 0.1, typingSlowdown: 0.1, inactivityDuringTask: 0, sessionLength: 0.1, corrections: 0.3, navigationSwitching: 0.6 },
    { inactivityThresholdS: null },
  ),
  // Reflective writing (journals, reframing): editing is part of writing.
  [ActivityType.REFLECTIVE_WRITING]: profile(
    ActivityType.REFLECTIVE_WRITING,
    { corrections: 0.35, undo: 0.5, latency: 0.4, typingSlowdown: 0.5 },
    { inactivityThresholdS: 240 },
  ),
  // Practice / simulation: failed attempts are part of practising; repeated
  // retries still matter, at a lower weight.
  [ActivityType.PRACTICE]: profile(
    ActivityType.PRACTICE,
    { failedAttempts: 0.6, latency: 0.5 },
    { inactivityThresholdS: 150 },
  ),
  [ActivityType.GENERAL]: profile(ActivityType.GENERAL),
});

/** Explicit module → activity type map (the registry has no activity type field). */
const MODULE_ACTIVITY = Object.freeze({
  "dyslexia.adaptive-reading": ActivityType.READING,
  "support.task_breakdown": ActivityType.STRUCTURED_TASK,
  "support.visual_timeline": ActivityType.STRUCTURED_TASK,
  "support.accountability_session": ActivityType.STRUCTURED_TASK,
  "dyscalculia.step-practice": ActivityType.STRUCTURED_TASK,
  "support.focus_session": ActivityType.TIMED_FOCUS,
  "support.mood_checkin": ActivityType.REGULATION,
  "support.grounding": ActivityType.REGULATION,
  "anxiety.hub": ActivityType.REGULATION,
  "dyscalculia.calm-mode": ActivityType.REGULATION,
  "support.cognitive_reframing": ActivityType.REFLECTIVE_WRITING,
  "support.evidence_journal": ActivityType.REFLECTIVE_WRITING,
  "asd.social-scenarios": ActivityType.PRACTICE,
  "asd.emotion-decoder": ActivityType.PRACTICE,
  "communication.simulator": ActivityType.PRACTICE,
});

const KEYWORD_FALLBACK = [
  [/reading|tts/, ActivityType.READING],
  [/breathing|grounding|calm|regulation|suds/, ActivityType.REGULATION],
  [/journal|reframe|reflection/, ActivityType.REFLECTIVE_WRITING],
  [/focus_session/, ActivityType.TIMED_FOCUS],
  [/task|step|exposure_planning|hierarchy|timeline|routine/, ActivityType.STRUCTURED_TASK],
  [/simulation|practice|scenario/, ActivityType.PRACTICE],
];

/**
 * Resolve the activity type for a module context (generic fallback).
 * @param {object|null|undefined} moduleContext
 * @returns {string}
 */
export function resolveActivityType(moduleContext) {
  const moduleId = typeof moduleContext?.moduleId === "string" ? moduleContext.moduleId : null;
  if (moduleId && MODULE_ACTIVITY[moduleId]) return MODULE_ACTIVITY[moduleId];
  const types = Array.isArray(moduleContext?.interventionTypes) ? moduleContext.interventionTypes.join(" ") : "";
  for (const [pattern, type] of KEYWORD_FALLBACK) {
    if (pattern.test(types)) return type;
  }
  return ActivityType.GENERAL;
}

/** Profile for a module context. */
export function resolveActivityProfile(moduleContext) {
  return ACTIVITY_PROFILES[resolveActivityType(moduleContext)];
}
