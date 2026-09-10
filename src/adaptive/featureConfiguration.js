/**
 * featureConfiguration.js — Module-scoped Adaptive Configuration Builders
 * (Role 2, Phase 2 common adaptation contract)
 *
 * This module is the single place that translates a module-scoped Adaptive
 * Engine decision (the `adjustments` surfaced by `useModuleAdaptation`) into a
 * typed, module-specific configuration object that a feature can genuinely
 * consume to change its behaviour. It is a pure mapping — no engines, no side
 * effects, no React — so every builder is unit-testable in isolation.
 *
 * Canonical supported module surface (matches `moduleAdaptationSets` in
 * `supportModuleRegistry`):
 *   - support.focus_session     → buildFocusConfig
 *   - support.task_breakdown    → buildTaskBreakdownConfig
 *   - support.gentle_activity   → buildGentleActivityConfig
 *   - dyslexia.adaptive-reading → buildReadingConfig
 *   - anxiety.hub               → buildAnxietyConfig
 *   - support.cognitive_reframing → buildReframingConfig
 *   - support.grounding         → buildGroundingConfig
 *   - support.visual_timeline   → buildTimelineConfig
 *   - support.evidence_journal  → buildEvidenceJournalConfig
 *
 * The generic `deriveFeatureSignals` mirrors the proven pattern used by the
 * ASD consumers (`SocialScenarioSimulatorCard`, `EmotionDecoderCard`), so all
 * feature surfaces derive their adaptive signals the same way. Signals are
 * derived purely from the engine action TYPE (DECREASE / SIMPLIFY / REDUCE /
 * GUIDE / DECOMPOSE / REORDER / MODIFY) with absolute targets ignored, keeping
 * the mapping stable. REDUCE keeps its own signal so density-focused policies
 * (`visual_timeline.reduce_density_on_overload`) can be told apart from
 * SIMPLIFY calm-layout policies even though SIMPLIFY also activates reduce.
 *
 * Every builder returns an object with `active` (whether any adaptation should
 * apply) and `mode` (a compact label for the effective adaptation mode) plus
 * concrete parameters. Non-adaptive state is resolved upstream by the caller.
 *
 * Ownership: Adaptive Experience Engineer
 */

/** ActionType value → boolean signal. Sources: `AdaptationActionType`. */
const SIMPLE_ACTION_TYPES = [
  "DECREASE",
  "SIMPLIFY",
  "REDUCE",
  "GUIDE",
  "DECOMPOSE",
  "REORDER",
  "INCREASE",
  "MODIFY",
];

/** Fold a module-scoped adjustment list into boolean signals. */
export function deriveFeatureSignals(adjustments = []) {
  const has = (types) =>
    adjustments.some(
      (adj) => adj && SIMPLE_ACTION_TYPES.includes(adj.type) && types.includes(adj.type),
    );

  return {
    simplify: has(["SIMPLIFY"]),
    reduce: has(["REDUCE"]),
    decompose: has(["DECOMPOSE"]),
    slowPace: has(["DECREASE"]),
    guide: has(["GUIDE"]),
    reorder: has(["REORDER"]),
    modify: has(["MODIFY"]),
    active: (adjustments?.length ?? 0) > 0,
  };
}

/** Pick the dominant mode label for a generic signal set. */
function genericMode(signals) {
  if (signals.slowPace) return "slow_pace";
  if (signals.simplify) return "simplified";
  if (signals.guide) return "guided";
  return "normal";
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Default focus block when nothing adapts. */
const DEFAULT_FOCUS_MINUTES = 25;
/** Default short-break length when nothing adapts. */
const DEFAULT_BREAK_MINUTES = 5;

/**
 * Focus Session configuration.
 *
 * Adapted parameters (all exist natively in `FocusSessions`):
 *   - focusMinutes → Pacer uses it for the block timer; policy
 *     `focus_session.shorten_blocks_on_overload` (DECREASE on cognitiveLoad)
 *     shortens the block, `focus_session.gentle_pacing_on_scatter` (SIMPLIFY on
 *     attention) reduces distractions and pacing.
 *   - breakMinutes → 5 min default; slow-paced sessions use a longer reset.
 *   - calmBreakTips → under high load/scatter, show calmer break tips.
 */
export function buildFocusConfig({ signals = {}, focusMinutes = DEFAULT_FOCUS_MINUTES } = {}) {
  const slow = Boolean(signals.slowPace);
  const simplify = Boolean(signals.simplify);

  const effectiveFocus = slow ? Math.min(15, focusMinutes) : focusMinutes;

  return {
    active: (signals?.active ?? false) || slow || simplify,
    mode: slow ? "short_gentle_blocks" : simplify ? "simplified" : "normal",
    focusMinutes: clamp(effectiveFocus, 5, 60),
    breakMinutes: slow ? 8 : DEFAULT_BREAK_MINUTES,
    calmBreakTips: slow || simplify,
    reducedDistractions: simplify,
    gentlePacing: slow,
  };
}

/** Default reference duration (minutes) when nothing adapts. */
const DEFAULT_READING_MINUTES = 5;

/**
 * Adaptive Reading configuration.
 *
 * Adapted parameters (all exist natively in `AdaptiveReadingModule.DEFAULT_PREFS`
 * and the AccessibilityPanel):
 *   - slowedPlaybackRate → maps to the TTS playback `rate` (policy
 *     `adaptive_reading.slow_pacing_on_overload` → DECREASE with
 *     `ttsRate: "slower"`).
 *   - enableFocusMode → `prefs.focusMode` (policy
 *     `adaptive_reading.focus_layout_on_scatter` → SIMPLIFY on attention).
 *   - enableReadingRuler → `prefs.readingRuler` (scatter/overload comfort).
 *   - reducedWordsPerLine → a hint used by the reader to pick shorter sentence
 *     chunks (policy `adaptive_reading.reduce_load_on_fatigue` → REDUCE on
 *     energy).
 */
export function buildReadingConfig({
  signals = {},
  estimatedMinutes = DEFAULT_READING_MINUTES,
} = {}) {
  const slow = Boolean(signals.slowPace);
  const simplify = Boolean(signals.simplify);
  const reduce = Boolean(signals.reduce);
  const guide = Boolean(signals.guide);

  const baseRate = slow ? 0.75 : 1;
  const focusMode = simplify || reduce;
  const readingRuler = simplify || reduce || slow;
  const reducedWordsPerLine = simplify || reduce;

  return {
    active: (signals?.active ?? false) || slow || simplify || reduce,
    mode: slow ? "slow_paced_reading" : simplify || reduce ? "focus_layout" : guide ? "guided_reading" : "normal",
    playbackRate: clamp(baseRate, 0.25, 2),
    enableFocusMode: focusMode,
    enableReadingRuler: readingRuler,
    reducedWordsPerLine,
    suggestedSessionMinutes: slow ? clamp(Math.ceil(estimatedMinutes * 0.6), 1, 30) : estimatedMinutes,
  };
}

/** Default requested step count when nothing adapts. */
const DEFAULT_TASK_STEP_COUNT = 5;

/**
 * Task Breakdown configuration.
 *
 * Adapted parameters (all exist natively in `TaskBreakdown`):
 *   - suggestedStyle → the breakdown generator's native style ("Bare Minimum"
 *     yields 4 tiny steps). Chosen under `task_breakdown.smaller_steps_on_overload`
 *     (DECOMPOSE on cognitiveLoad) and `task_breakdown.gentle_pacing_on_low_energy`
 *     (SIMPLIFY on energy) to reduce cognitive weight.
 *   - gentlePacing → surfaces the existing "Focus on the next step" timer
 *     suggestion more prominently (slower per-step feel under low energy).
 *   - showOneStep → prompts the "one thing at a time" reassurance copy already
 *     in the page.
 */
export function buildTaskBreakdownConfig({
  signals = {},
  requestedStepCount = DEFAULT_TASK_STEP_COUNT,
} = {}) {
  // Policy mapping: `smaller_steps_on_overload` is DECOMPOSE on cognitiveLoad
  // (shrink the breakdown); `gentle_pacing_on_low_energy` is SIMPLIFY on
  // energy (slow down, one thing at a time). Both reduce demand, honestly.
  const small = Boolean(signals.decompose);
  const gentle = Boolean(signals.simplify);
  const slow = Boolean(signals.slowPace);
  // Driven by the generator's native style space: shrinking maps to the
  // lightest template, keeping the step count honest with the module.
  const suggestedStyle = small ? "Bare Minimum" : "Standard";
  const stepCount = small
    ? clamp(Math.max(3, Math.ceil(requestedStepCount * 0.6)), 3, 8)
    : clamp(requestedStepCount, 3, 8);

  return {
    active: (signals?.active ?? false) || small || gentle || slow,
    mode:
      small ? "smaller_steps"
      : gentle ? "gentle_pacing"
      : slow ? "gentle_pacing"
      : "normal",
    suggestedStyle,
    stepCount,
    smallerSteps: small,
    gentlePacing: gentle || slow,
    showOneStep: small || gentle || slow,
  };
}

/** Default step count for a Gentle Activity (MVH). */
const DEFAULT_GENTLE_STEPS = 5;

/**
 * MVH (Gentle Activity) configuration.
 *
 * Adapted parameters (all exist natively in `MVHProtocol`):
 *   - pacingHint → "gentle" default; DECREASE on low energy slows the message
 *     and lengthens the break (policy `gentle_activity.slow_pace_on_low_energy`).
 *   - visibleSteps → how many steps to surface in the progress header; DECOMPOSE
 *     on overload shows fewer (policy `gentle_activity.reduce_scope_on_overload`).
 *   - dropSuggestedSteps → when overloaded, the protocol may suggest the user
 *     only complete a subset; surfaced as reassurance copy.
 */
export function buildGentleActivityConfig({
  signals = {},
  totalSteps = DEFAULT_GENTLE_STEPS,
} = {}) {
  const slow = Boolean(signals.slowPace);
  const small = Boolean(signals.simplify || signals.decompose);

  const visibleSteps = small ? clamp(Math.max(3, totalSteps - 2), 3, totalSteps) : totalSteps;

  return {
    active: (signals?.active ?? false) || slow || small,
    mode: slow ? "gentle_slow_pace" : small ? "reduced_step_scope" : "normal",
    pacingHint: slow ? "slower" : "gentle",
    visibleSteps,
    reducedScope: small,
    reassureCopy: small || slow,
  };
}

/** Default recommended intervention when nothing adapts. */
const DEFAULT_ANXIETY_INTERVENTION = "guided_breathing";

/**
 * Anxiety Hub configuration.
 *
 * Adapted surface: `AnxietyPage` renders three calm-mini cards and an
 * `AdaptiveGreeting`. The single registered anxiety policy
 * (`anxiety.breathing_on_stress` → GUIDE on high stress) promotes the guided
 * breathing card and shows a calming reassurance line in the greeting area.
 * `reducedStimulation` maps onto the sensory motion flag consumed by the page
 * for low-stimulation rendering.
 */
export function buildAnxietyConfig({
  signals = {},
  recommendedIntervention = DEFAULT_ANXIETY_INTERVENTION,
} = {}) {
  const guide = Boolean(signals.guide);
  const slow = Boolean(signals.slowPace);
  const simplify = Boolean(signals.simplify);

  const effectiveIntervention = guide ? "guided_breathing" : recommendedIntervention;

  return {
    active: (signals?.active ?? false) || guide || slow,
    mode: slow ? "slow_paced_calm" : simplify ? "reduced_stimulation" : guide ? "promote_breathing" : "normal",
    recommendedIntervention: effectiveIntervention,
    promoteBreathing: guide,
    reducedStimulation: simplify || slow,
    calmReassurance: guide || slow,
  };
}

/** Default number of reflection questions shown when nothing adapts. */
const DEFAULT_REFRAME_QUESTIONS = 3;

/**
 * Cognitive Reframing configuration.
 *
 * Adapted surface (`CognitiveReframer`):
 *   - visibleQuestions → how many of the native reflection questions
 *     (`analysis.questions`) are shown. The overload policy
 *     (`cognitive_reframing.small_reframes_on_overload` → SIMPLIFY/TASK on
 *     cognitiveLoad) shrinks the ask to fewer, lighter questions.
 *   - guidedPrompts → surfaces the native explanation line more prominently
 *     under the rumination GUIDE policy
 *     (`cognitive_reframing.guide_on_rumination` → GUIDE/ASSISTANCE on mood).
 *   - reassureCopy → the page already frames questions as "no need to answer
 *     perfectly"; this surfaces that reassurance whenever any support decision
 *     is active.
 */
export function buildReframingConfig({
  signals = {},
  totalQuestions = DEFAULT_REFRAME_QUESTIONS,
} = {}) {
  const guide = Boolean(signals.guide);
  const simplify = Boolean(signals.simplify);
  const slow = Boolean(signals.slowPace);
  const max = Math.max(1, totalQuestions);

  const visibleQuestions = simplify
    ? clamp(Math.max(1, totalQuestions - 1), 1, max)
    : totalQuestions;

  return {
    active: (signals?.active ?? false) || guide || simplify || slow,
    mode: guide ? "guided_reframe" : slow ? "gentle_pacing" : simplify ? "small_reframes" : "normal",
    visibleQuestions,
    guidedPrompts: guide,
    reassureCopy: guide || simplify || slow,
  };
}

/**
 * Anxiety Dissolver (Grounding) configuration.
 *
 * Adapted surface (`AnxietyDissolver`):
 *   - breathingFirst → the grounded page renders the four native techniques in
 *     a derived order; the stress GUIDE policy
 *     (`grounding.guide_breathing_on_stress` → GUIDE/TASK on stressLevel)
 *     promotes the two breathing practices first.
 *   - slowPacing → the panic DECREASE policy
 *     (`grounding.slow_pace_on_panic` → DECREASE/PACING on panicked mood)
 *     surfaces a quieter-pace note and longer pause reminder.
 *   - guidedBreathing → text callout before the steps when GUIDE is active
 *     ("Start with a slow inhale..."), so breathing guidance lands natively.
 */
export function buildGroundingConfig({
  signals = {},
  breathingTechniqueIds = ["4-7-8", "box_breathing"],
} = {}) {
  const guide = Boolean(signals.guide);
  const slow = Boolean(signals.slowPace);
  const simplify = Boolean(signals.simplify);

  return {
    active: (signals?.active ?? false) || guide || slow,
    mode: guide ? "breathing_first" : slow ? "quiet_slow_pace" : simplify ? "reduced_stimulation" : "normal",
    breathingFirst: guide,
    guidedBreathing: guide,
    slowPacing: slow,
    breathingTechniqueIds: guide ? breathingTechniqueIds : [],
    reassureCopy: guide || slow,
  };
}

/**
 * Visual Timeline configuration.
 *
 * Adapted surface (`VisualTimeline`, which already owns a native density select
 * with "comfortable"/"compact" and a calm reminder card):
 *   - densityReduced → the overload policy
 *     (`visual_timeline.reduce_density_on_overload` → REDUCE/CONTENT on
 *     cognitiveLoad) relaxes visual density by forcing the native "compact"
 *     presentation on top of whatever the user selected.
 *   - calmLayout → the distress policy
 *     (`visual_timeline.calm_layout_on_distress` → SIMPLIFY/CONTENT on anxious/
 *     panicked/overwhelmed mood) emphasises the page's "Just the next block"
 *     calm reminder card.
 */
export function buildTimelineConfig({ signals = {} } = {}) {
  const reduce = Boolean(signals.reduce);
  const simplify = Boolean(signals.simplify);
  const slow = Boolean(signals.slowPace);

  return {
    active: (signals?.active ?? false) || reduce || simplify,
    mode: reduce ? "reduced_density" : simplify ? "calm_layout" : slow ? "gentle_pacing" : "normal",
    densityReduced: reduce,
    calmLayout: simplify || slow,
  };
}

/**
 * Evidence Journal configuration.
 *
 * Adapted surface (`EvidenceFolder`, which already owns per-entry starring):
 *   - winsFirst → the low-mood REORDER policy
 *     (`evidence_journal.highlight_wins_on_low_mood` → REORDER/CONTENT on mood
 *     sad/anxious) prioritises the user's starred entries at the top of the
 *     list and highlights them as "strongest evidence".
 *   - highlightWins → surfaces a small encouragement banner pointing at the
 *     prioritised wins.
 */
export function buildEvidenceJournalConfig({ signals = {} } = {}) {
  const reorder = Boolean(signals.reorder);
  const guide = Boolean(signals.guide);

  return {
    active: (signals?.active ?? false) || reorder,
    mode: reorder ? "wins_first" : "normal",
    winsFirst: reorder,
    highlightWins: reorder,
    guidedPrompt: guide,
  };
}

/** The canonical module surface: moduleId → config builder. */
export const FEATURE_CONFIG_BUILDERS = {
  "support.focus_session": buildFocusConfig,
  "support.task_breakdown": buildTaskBreakdownConfig,
  "support.gentle_activity": buildGentleActivityConfig,
  "dyslexia.adaptive-reading": buildReadingConfig,
  "anxiety.hub": buildAnxietyConfig,
  "support.cognitive_reframing": buildReframingConfig,
  "support.grounding": buildGroundingConfig,
  "support.visual_timeline": buildTimelineConfig,
  "support.evidence_journal": buildEvidenceJournalConfig,
};

/** Resolve the config builder for a canonical module id, or null. */
export function getFeatureConfigBuilder(moduleId) {
  return FEATURE_CONFIG_BUILDERS[moduleId] ?? null;
}