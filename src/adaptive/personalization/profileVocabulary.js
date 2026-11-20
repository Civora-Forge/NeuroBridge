/**
 * profileVocabulary.js — Closed vocabulary of the personalization profile (Task 5)
 *
 * Every field a profile may hold is declared here. Anything else is dropped on
 * read and write, so the profile can never become a place to store diagnoses,
 * health conditions, free text or other sensitive traits: it only describes
 * HOW the user likes to be supported, never WHY.
 *
 * Shared by the client profile model and the engine personalization stage.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

/** Presentation / interaction dimensions (single-choice). */
export const PREFERENCE_DIMENSIONS = Object.freeze({
  interactionStyle: {
    label: "Interaction style",
    values: { direct: "Direct", guided: "Guided", conversational: "Conversational" },
  },
  informationDensity: {
    label: "Information on screen",
    values: { minimal: "Minimal", balanced: "Balanced", detailed: "Detailed" },
  },
  explanationLength: {
    label: "Explanation length",
    values: { short: "Short", standard: "Standard", thorough: "Thorough" },
  },
  guidancePace: {
    label: "Guidance pace",
    values: { slow: "Slow", steady: "Steady", brisk: "Brisk" },
  },
  notificationLevel: {
    label: "Notifications",
    values: { essential: "Essential only", balanced: "Balanced", all: "All" },
  },
  interruptionTolerance: {
    label: "Interruptions",
    values: { low: "Avoid interruptions", medium: "Some are fine", high: "Interrupt freely" },
  },
  visualPresentation: {
    label: "Visual presentation",
    values: { calm: "Calm", standard: "Standard", high_contrast: "High contrast" },
  },
  motion: {
    label: "Motion",
    values: { reduced: "Reduced", standard: "Standard" },
  },
});

/**
 * Support modes the user may explicitly prefer or avoid. Each maps onto the
 * engine policy rules that produce that mode. Safety-adjacent rules
 * (`critical_urgency`, `overwhelm_simplification`) are deliberately NOT
 * mapped: a preference can never switch off distress support.
 */
export const SUPPORT_MODES = Object.freeze({
  step_by_step_guidance: { label: "Step-by-step guidance", ruleIds: ["scattered_guidance"] },
  focus_mode: { label: "Focus mode", ruleIds: ["focus_mode"] },
  calm_visuals: { label: "Calmer, low-stimulation visuals", ruleIds: ["low_stimulation"] },
  simplified_layout: { label: "Fewer choices on screen", ruleIds: ["high_load_minimal"] },
});

/** Interaction patterns the user can explicitly opt out of. */
export const AVOIDABLE_PATTERNS = Object.freeze({
  animations: "Animations and moving elements",
  unrequested_offers: "Support suggestions I didn't ask for",
  sound_cues: "Sound cues",
  frequent_check_ins: "Frequent check-ins",
});

/** Rules a profile may never suppress (safety / distress support). */
export const PROTECTED_RULE_IDS = Object.freeze(["critical_urgency", "overwhelm_simplification"]);

export const MODE_STANCES = Object.freeze({ PREFERRED: "preferred", AVOIDED: "avoided" });
export const LEARNED_STANCES = Object.freeze({ FAVOURED: "favoured", AVOIDED: "avoided" });

export const MODE_FIELD_PREFIX = "mode:";
export const AVOID_FIELD_PREFIX = "avoid:";

/** Every explicit field id: dimensions, `mode:<id>`, `avoid:<pattern>`. */
export function isExplicitField(field) {
  if (typeof field !== "string") return false;
  if (Object.prototype.hasOwnProperty.call(PREFERENCE_DIMENSIONS, field)) return true;
  if (field.startsWith(MODE_FIELD_PREFIX)) {
    return Object.prototype.hasOwnProperty.call(SUPPORT_MODES, field.slice(MODE_FIELD_PREFIX.length));
  }
  if (field.startsWith(AVOID_FIELD_PREFIX)) {
    return Object.prototype.hasOwnProperty.call(AVOIDABLE_PATTERNS, field.slice(AVOID_FIELD_PREFIX.length));
  }
  return false;
}

/** Whether `value` is a legal value for `field` (`null` = cleared). */
export function isValidExplicitValue(field, value) {
  if (value === null) return true;
  if (Object.prototype.hasOwnProperty.call(PREFERENCE_DIMENSIONS, field)) {
    return typeof value === "string" && Object.prototype.hasOwnProperty.call(PREFERENCE_DIMENSIONS[field].values, value);
  }
  if (field.startsWith(MODE_FIELD_PREFIX)) {
    return value === MODE_STANCES.PREFERRED || value === MODE_STANCES.AVOIDED;
  }
  if (field.startsWith(AVOID_FIELD_PREFIX)) return value === true;
  return false;
}

/** Support mode governing a policy rule, if any. */
export function modeForRule(ruleId) {
  for (const [mode, definition] of Object.entries(SUPPORT_MODES)) {
    if (definition.ruleIds.includes(ruleId)) return mode;
  }
  return null;
}

/**
 * Learned stances are keyed by Task 4 preference keys (`TARGET:ruleId` or
 * `RECOMMENDATION:<id>`). Anything else is rejected.
 */
const LEARNED_KEY_PATTERN = /^[A-Z_]{2,32}:[A-Za-z0-9_.\-:]{1,96}$/;
export function isLearnedKey(key) {
  return typeof key === "string" && LEARNED_KEY_PATTERN.test(key);
}

const MODULE_ID_PATTERN = /^[A-Za-z0-9_.\-]{1,80}$/;
export function isModuleId(moduleId) {
  return typeof moduleId === "string" && MODULE_ID_PATTERN.test(moduleId);
}

/** Human label for a learned key, for the profile view (no history). */
export function describeLearnedKey(key) {
  const [target, ...rest] = String(key).split(":");
  const id = rest.join(":");
  if (target === "RECOMMENDATION") return `Suggestion: ${humanize(id)}`;
  const mode = modeForRule(id);
  if (mode) return SUPPORT_MODES[mode].label;
  return humanize(id);
}

function humanize(id) {
  const text = String(id).replace(/^[a-z]+\./, "").replace(/[_.\-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Adaptation";
}
