import { FEATURES } from "@/lib/featureRegistry";
import { DISORDERS } from "@/lib/disorders";
import {
  ModuleCategory,
  PrivacyLevel,
  SafetyLevel,
  validateSupportModuleDefinition,
} from "@/support/schemas/supportSchemas";

const rawSupportModules = [
  {
    id: FEATURES.ADHD_BREAKDOWN,
    title: "Task Breakdown",
    description: "Split large tasks into guided steps.",
    category: ModuleCategory.EXECUTIVE,
    interventionTypes: ["task_breakdown", "planning_support"],
    route: "/adhd/breakdown",
    tags: ["overwhelm", "planning", "task_start", "working_memory"],
    disorders: [DISORDERS.ADHD, DISORDERS.DYSPRAXIA],
    expectedOutcomeMetrics: ["steps_created", "steps_completed", "duration_ms"],
  },
  {
    id: FEATURES.ADHD_FOCUS,
    title: "Focus Sessions",
    description: "Use timed focus blocks with reset cues.",
    category: ModuleCategory.EXECUTIVE,
    interventionTypes: ["focus_session", "attention_support"],
    route: "/adhd/focus",
    tags: ["focus", "distraction", "task_switching", "time_blindness"],
    disorders: [DISORDERS.ADHD],
    expectedOutcomeMetrics: ["session_minutes", "completed_blocks", "interruptions"],
  },
  {
    id: FEATURES.ADHD_EMOTION,
    title: "Emotion Coach",
    description: "Use structured prompts for emotional regulation.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["grounding", "emotion_regulation", "calming"],
    route: "/adhd/emotion-coach",
    tags: ["panic", "stress", "emotion_regulation", "overwhelm"],
    disorders: [DISORDERS.ADHD, DISORDERS.ANXIETY, DISORDERS.ASD],
    expectedOutcomeMetrics: ["before_level", "after_level", "duration_ms"],
    safetyLevel: SafetyLevel.CAUTION,
    repetitionLimit: { maxCount: 4, windowHours: 24 },
  },
  {
    id: FEATURES.OCD_HIERARCHY,
    title: "Exposure Hierarchy Builder",
    description: "Create graded exposure steps for structured practice.",
    category: ModuleCategory.SPECIALIZED,
    interventionTypes: ["exposure_planning", "erp_hierarchy"],
    route: "/ocd/exposure-hierarchy",
    tags: ["exposure", "fear", "avoidance", "uncertainty"],
    disorders: [DISORDERS.OCD],
    expectedOutcomeMetrics: ["items_created", "difficulty_range"],
    safetyLevel: SafetyLevel.CAUTION,
  },
  {
    id: FEATURES.OCD_SESSION_TIMER,
    title: "Exposure Session Timer",
    description: "Time exposure practice with non-reassurance prompts.",
    category: ModuleCategory.SPECIALIZED,
    interventionTypes: ["erp_exposure", "response_prevention"],
    route: "/ocd/exposure-session",
    tags: ["exposure", "avoidance", "urge_control", "uncertainty"],
    disorders: [DISORDERS.OCD],
    expectedOutcomeMetrics: ["pre_suds", "post_suds", "duration_ms"],
    safetyLevel: SafetyLevel.CAUTION,
  },
  {
    id: FEATURES.OCD_SUDS,
    title: "SUDS Monitor",
    description: "Track distress level during a support activity.",
    category: ModuleCategory.SPECIALIZED,
    interventionTypes: ["suds_tracking", "distress_monitoring"],
    route: "/ocd/suds-monitor",
    tags: ["anxiety", "monitoring", "exposure"],
    disorders: [DISORDERS.OCD, DISORDERS.ANXIETY],
    expectedOutcomeMetrics: ["suds_level", "timestamp"],
    safetyLevel: SafetyLevel.CAUTION,
    repetitionLimit: { maxCount: 6, windowHours: 24 },
  },
  {
    id: FEATURES.ASD_SENSORY,
    title: "Sensory Regulation",
    description: "Adjust sensory load and access calming supports.",
    category: ModuleCategory.SENSORY,
    interventionTypes: ["sensory_regulation", "low_stimulation"],
    route: "/asd/sensory",
    tags: ["sensory_overload", "overwhelm", "stress_reactivity"],
    disorders: [DISORDERS.ASD, DISORDERS.ANXIETY],
    expectedOutcomeMetrics: ["trigger", "before_level", "after_level"],
    safetyLevel: SafetyLevel.CAUTION,
  },
  {
    id: FEATURES.ASD_MELTDOWN,
    title: "Meltdown Prevention",
    description: "Use a low-stimulation workflow during overload risk.",
    category: ModuleCategory.SENSORY,
    interventionTypes: ["overload_support", "meltdown_prevention"],
    route: "/asd/meltdown",
    tags: ["panic", "overwhelm", "sensory_overload"],
    disorders: [DISORDERS.ASD, DISORDERS.ANXIETY],
    expectedOutcomeMetrics: ["risk_level", "steps_completed"],
    safetyLevel: SafetyLevel.CAUTION,
  },

  {
    id: FEATURES.DYSLEXIA_ADAPTIVE_READING,
    title: "Adaptive Reading Module",
    description: "Use accessibility controls, TTS, and reading focus tools.",
    category: ModuleCategory.LEARNING,
    interventionTypes: ["adaptive_reading", "tts_support", "reading_accessibility"],
    route: "/dyslexia/reading-module",
    tags: ["reading_fatigue", "tts", "accessibility", "focus"],
    disorders: [DISORDERS.DYSLEXIA, DISORDERS.APD],
    expectedOutcomeMetrics: ["tts_activations", "word_taps", "adjustments"],
  },
  {
    id: "dyscalculia.step-practice",
    title: "Guided Step Practice",
    description: "Solve math with structured step-by-step guidance.",
    category: ModuleCategory.LEARNING,
    interventionTypes: ["math_step_practice", "scaffolded_learning"],
    route: "/dyscalculia/step-practice",
    tags: ["step_support", "working_memory", "number_confusion"],
    disorders: [DISORDERS.DYSCALCULIA],
    expectedOutcomeMetrics: ["accuracy", "hesitation_ms", "scaffold_level"],
  },
  {
    id: "dyscalculia.calm-mode",
    title: "Calm Mode",
    description: "Reduce pressure during difficult number tasks.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["math_calm_mode", "calming"],
    route: "/dyscalculia/calm-mode",
    tags: ["number_anxiety", "stress", "overwhelm"],
    disorders: [DISORDERS.DYSCALCULIA, DISORDERS.ANXIETY],
    expectedOutcomeMetrics: ["before_level", "after_level", "exit_count"],
    safetyLevel: SafetyLevel.CAUTION,
  },
  {
    id: FEATURES.DEPRESSION_REALITY,
    title: "Cognitive Reframer",
    description: "Use structured prompts to examine difficult thoughts.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["cognitive_reframe", "thought_support"],
    route: "/depression/reality",
    tags: ["rumination", "intrusive_thoughts", "low_mood"],
    disorders: [DISORDERS.DEPRESSION, DISORDERS.ANXIETY],
    expectedOutcomeMetrics: ["reframe_completed", "before_level", "after_level"],
    safetyLevel: SafetyLevel.CAUTION,
  },
  {
    id: FEATURES.DEPRESSION_MVH,
    title: "MVH Protocol",
    description: "Use structured regulation and activation guidance.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["behavioral_activation", "daily_momentum"],
    route: "/depression/mvh",
    tags: ["low_mood", "low_energy", "stability"],
    disorders: [DISORDERS.DEPRESSION],
    expectedOutcomeMetrics: ["steps_completed", "energy_before", "energy_after"],
    safetyLevel: SafetyLevel.CAUTION,
  },
];

export const SUPPORT_MODULES = rawSupportModules.map((module) =>
  validateSupportModuleDefinition({
    privacyDefault: PrivacyLevel.PRIVATE,
    safetyLevel: SafetyLevel.STANDARD,
    supportedRoles: ["user"],
    repetitionLimit: { maxCount: 2, windowHours: 24 },
    ...module,
  }),
);

export const SUPPORT_MODULE_LOOKUP = SUPPORT_MODULES.reduce((acc, module) => {
  acc[module.id] = module;
  return acc;
}, {});

export function getSupportModules() {
  return [...SUPPORT_MODULES];
}

export function getSupportModuleById(moduleId) {
  return SUPPORT_MODULE_LOOKUP[moduleId] ?? null;
}

export function getSupportModulesByInterventionType(interventionType) {
  return SUPPORT_MODULES.filter((module) => module.interventionTypes.includes(interventionType));
}

export function getSupportModulesByRoute(route) {
  return SUPPORT_MODULES.filter((module) => module.route === route);
}

