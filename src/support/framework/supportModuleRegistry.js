import { FEATURES } from "@/lib/featureRegistry";
import { DISORDERS } from "@/lib/disorders";
import {
  AdaptationActionType,
  AdaptationDimension,
  ModuleCategory,
  PolicyScope,
  PrivacyLevel,
  PriorityTier,
  SafetyLevel,
  TriggerCondition,
  TriggerGroupOperator,
  validateSupportModuleDefinition,
} from "@/support/schemas/supportSchemas";

/**
 * Module-scoped adaptation contracts (Role 2, module level).
 *
 * Each entry declares which AdaptationDimensions the module can adapt and a
 * curated set of module policies. Policies fire ONLY against engine-derived
 * UserState dimensions (mood / attention / energy / cognitiveLoad /
 * stressLevel), so they are valid against both the app-level context snapshot
 * and a module-local snapshot. The engine merges these into the plan; the
 * app-level shell and `useModuleAdaptation` consumers surface the resulting
 * non-UI actions.
 */
const moduleAdaptationSets = {
  "support.focus_session": {
    supportedAdaptationDimensions: [
      AdaptationDimension.PACING,
      AdaptationDimension.ASSISTANCE,
      AdaptationDimension.NOTIFICATIONS,
    ],
    modulePolicies: [
      {
        id: "focus_session.gentle_pacing_on_scatter",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 40,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "attention",
                condition: TriggerCondition.IN,
                value: ["scattered", "fragmented"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.PACING,
          parameters: { pacing: "gentle", reduceDistractions: true },
        },
      },
      {
        id: "focus_session.shorten_blocks_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 35,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECREASE,
          target: AdaptationDimension.PACING,
          parameters: { blockMinutes: "short", pauseMore: true },
        },
      },
    ],
  },
  "support.task_breakdown": {
    supportedAdaptationDimensions: [
      AdaptationDimension.TASK,
      AdaptationDimension.PACING,
      AdaptationDimension.CONTENT,
    ],
    modulePolicies: [
      {
        id: "task_breakdown.smaller_steps_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 40,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECOMPOSE,
          target: AdaptationDimension.TASK,
          parameters: { stepSize: "small", showOneStep: true },
        },
      },
      {
        id: "task_breakdown.gentle_pacing_on_low_energy",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 30,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "energy",
                condition: TriggerCondition.IN,
                value: ["tired", "exhausted"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.PACING,
          parameters: { pacing: "gentle", shorterSteps: true },
        },
      },
    ],
  },
  "support.visual_timeline": {
    supportedAdaptationDimensions: [
      AdaptationDimension.CONTENT,
      AdaptationDimension.TIMING,
      AdaptationDimension.NOTIFICATIONS,
    ],
    modulePolicies: [
      {
        id: "visual_timeline.reduce_density_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 40,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.REDUCE,
          target: AdaptationDimension.CONTENT,
          parameters: { density: "low", showTimeRangeOnly: true },
        },
      },
      {
        id: "visual_timeline.calm_layout_on_distress",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 30,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["anxious", "panicked", "overwhelmed"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.CONTENT,
          parameters: { calmLayout: true },
        },
      },
    ],
  },
  "support.mood_checkin": {
    supportedAdaptationDimensions: [
      AdaptationDimension.CONTENT,
      AdaptationDimension.ASSISTANCE,
      AdaptationDimension.TASK,
    ],
    modulePolicies: [
      {
        id: "mood_checkin.calm_first_on_distress",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 50,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["anxious", "panicked", "overwhelmed"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.REORDER,
          target: AdaptationDimension.CONTENT,
          parameters: { calmStrategiesFirst: true },
        },
      },
    ],
  },
  "support.grounding": {
    supportedAdaptationDimensions: [
      AdaptationDimension.TASK,
      AdaptationDimension.PACING,
      AdaptationDimension.ASSISTANCE,
    ],
    modulePolicies: [
      {
        id: "grounding.guide_breathing_on_stress",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 50,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "stressLevel",
                condition: TriggerCondition.IN,
                value: ["high", "acute"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.GUIDE,
          target: AdaptationDimension.TASK,
          parameters: { guidedBreathing: true },
        },
      },
      {
        id: "grounding.slow_pace_on_panic",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 45,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.EQ,
                value: "panicked",
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECREASE,
          target: AdaptationDimension.PACING,
          parameters: { pace: "slow", longerPauses: true },
        },
      },
    ],
  },
  "support.gentle_activity": {
    supportedAdaptationDimensions: [
      AdaptationDimension.PACING,
      AdaptationDimension.TASK,
      AdaptationDimension.CONTENT,
    ],
    modulePolicies: [
      {
        id: "gentle_activity.slow_pace_on_low_energy",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 45,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "energy",
                condition: TriggerCondition.IN,
                value: ["tired", "exhausted"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECREASE,
          target: AdaptationDimension.PACING,
          parameters: { pace: "slow", shortSteps: true },
        },
      },
      {
        id: "gentle_activity.reduce_scope_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 35,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECOMPOSE,
          target: AdaptationDimension.TASK,
          parameters: { stepSize: "small", showOneStep: true },
        },
      },
    ],
  },
  "support.cognitive_reframing": {
    supportedAdaptationDimensions: [
      AdaptationDimension.TASK,
      AdaptationDimension.CONTENT,
    ],
    modulePolicies: [
      {
        id: "cognitive_reframing.guide_on_rumination",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 40,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["sad", "frustrated", "anxious"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.GUIDE,
          target: AdaptationDimension.ASSISTANCE,
          parameters: { guidedPrompts: true },
        },
      },
      {
        id: "cognitive_reframing.small_reframes_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 35,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.TASK,
          parameters: { reframeSize: "small" },
        },
      },
    ],
  },
  "support.social_connection": {
    supportedAdaptationDimensions: [
      AdaptationDimension.CONTENT,
      AdaptationDimension.TASK,
      AdaptationDimension.ASSISTANCE,
    ],
    modulePolicies: [
      {
        id: "social_connection.gentle_templates_on_low_mood",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 30,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["sad", "anxious", "overwhelmed"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.CONTENT,
          parameters: { gentleTemplates: true },
        },
      },
      {
        id: "social_connection.shorter_messages_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 30,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.REDUCE,
          target: AdaptationDimension.CONTENT,
          parameters: { messageLength: "short" },
        },
      },
    ],
  },
  "support.evidence_journal": {
    supportedAdaptationDimensions: [
      AdaptationDimension.CONTENT,
      AdaptationDimension.TASK,
    ],
    modulePolicies: [
      {
        id: "evidence_journal.highlight_wins_on_low_mood",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 30,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["sad", "anxious"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.REORDER,
          target: AdaptationDimension.CONTENT,
          parameters: { winsFirst: true },
        },
      },
    ],
  },
  "dyslexia.adaptive-reading": {
    supportedAdaptationDimensions: [
      AdaptationDimension.PACING,
      AdaptationDimension.CONTENT,
      AdaptationDimension.INTERACTION,
      AdaptationDimension.TASK,
    ],
    modulePolicies: [
      {
        id: "adaptive_reading.slow_pacing_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 40,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECREASE,
          target: AdaptationDimension.PACING,
          parameters: { pace: "slow", ttsRate: "slower" },
        },
      },
      {
        id: "adaptive_reading.reduce_load_on_fatigue",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 35,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "energy",
                condition: TriggerCondition.IN,
                value: ["tired", "exhausted"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.REDUCE,
          target: AdaptationDimension.CONTENT,
          parameters: { sentenceChunks: "short", fewerWordsPerLine: true },
        },
      },
      {
        id: "adaptive_reading.focus_layout_on_scatter",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 30,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "attention",
                condition: TriggerCondition.IN,
                value: ["scattered", "fragmented"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.INTERACTION,
          parameters: { focusMode: true, reduceDistractions: true },
        },
      },
    ],
  },
  "dyscalculia.step-practice": {
    supportedAdaptationDimensions: [
      AdaptationDimension.TASK,
      AdaptationDimension.PACING,
      AdaptationDimension.ASSISTANCE,
    ],
    modulePolicies: [
      {
        id: "step_practice.smaller_steps_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 40,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECOMPOSE,
          target: AdaptationDimension.TASK,
          parameters: { stepSize: "small", showOneStep: true },
        },
      },
      {
        id: "step_practice.reassure_on_anxiety",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 35,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["anxious", "panicked"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.GUIDE,
          target: AdaptationDimension.ASSISTANCE,
          parameters: { encouragingHints: true },
        },
      },
    ],
  },
  "dyscalculia.calm-mode": {
    supportedAdaptationDimensions: [
      AdaptationDimension.PACING,
      AdaptationDimension.TASK,
      AdaptationDimension.CONTENT,
    ],
    modulePolicies: [
      {
        id: "calm_mode.extended_calm_on_stress",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 45,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "stressLevel",
                condition: TriggerCondition.IN,
                value: ["high", "acute"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECREASE,
          target: AdaptationDimension.PACING,
          parameters: { pace: "slow", longerPauses: true },
        },
      },
      {
        id: "calm_mode.reduce_pressure_on_distress",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 40,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["anxious", "panicked", "overwhelmed"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.CONTENT,
          parameters: { lowPressure: true },
        },
      },
    ],
  },
  "asd.emotion-decoder": {
    supportedAdaptationDimensions: [
      AdaptationDimension.PACING,
      AdaptationDimension.CONTENT,
      AdaptationDimension.ASSISTANCE,
    ],
    modulePolicies: [
      {
        id: "emotion_decoder.extra_hints_on_distress",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 45,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["anxious", "panicked", "overwhelmed"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.GUIDE,
          target: AdaptationDimension.ASSISTANCE,
          parameters: { showCuesFirst: true, encouragingHints: true },
        },
      },
      {
        id: "emotion_decoder.simplify_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 35,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.PACING,
          parameters: { oneScenarioAtATime: true, fewerCues: true },
        },
      },
    ],
  },
  "asd.social-scenarios": {
    supportedAdaptationDimensions: [
      AdaptationDimension.PACING,
      AdaptationDimension.CONTENT,
      AdaptationDimension.ASSISTANCE,
    ],
    modulePolicies: [
      {
        id: "social_scenarios.extra_hints_on_distress",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 45,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "mood",
                condition: TriggerCondition.IN,
                value: ["anxious", "panicked", "overwhelmed"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.GUIDE,
          target: AdaptationDimension.ASSISTANCE,
          parameters: { showCuesFirst: true, encouragingHints: true },
        },
      },
      {
        id: "social_scenarios.simplify_on_overload",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 40,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "cognitiveLoad",
                condition: TriggerCondition.IN,
                value: ["overwhelming", "high"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.SIMPLIFY,
          target: AdaptationDimension.PACING,
          parameters: { oneScenarioAtATime: true, fewerCues: true },
        },
      },
      {
        id: "social_scenarios.slow_pace_on_low_energy",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 30,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "energy",
                condition: TriggerCondition.IN,
                value: ["tired", "exhausted"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.DECREASE,
          target: AdaptationDimension.PACING,
          parameters: { pace: "slow", extendedThinkTime: true },
        },
      },
    ],
  },
  "anxiety.hub": {
    supportedAdaptationDimensions: [
      AdaptationDimension.TASK,
      AdaptationDimension.PACING,
    ],
    modulePolicies: [
      {
        id: "anxiety.breathing_on_stress",
        scope: PolicyScope.MODULE,
        tier: PriorityTier.CURRENT_STATE,
        priority: 95,
        triggerGroups: [
          {
            operator: TriggerGroupOperator.AND,
            triggers: [
              {
                dimension: "stressLevel",
                condition: TriggerCondition.IN,
                value: ["high", "acute"],
              },
            ],
          },
        ],
        action: {
          type: AdaptationActionType.GUIDE,
          target: AdaptationDimension.TASK,
          parameters: { guidedBreathing: true },
        },
      },
    ],
  },
};

const rawSupportModules = [
  {
    id: "support.task_breakdown",
    moduleId: "support.task_breakdown",
    title: "Task Breakdown",
    description: "Split large tasks into guided steps.",
    category: ModuleCategory.EXECUTIVE,
    interventionTypes: ["task_breakdown", "planning_support"],
    route: "/adhd/breakdown",
    tags: ["overwhelm", "planning", "task_start", "working_memory"],
    disorders: [],
    expectedOutcomeMetrics: ["steps_created", "steps_completed", "duration_ms"],
    developmentDomain: "adhd",
    supportedNeeds: ["task_initiation", "task_simplification", "attention_support"],
    potentiallyRelevantDomains: ["adhd", "asd", "anxiety", "dyspraxia", "general"],
    actions: ["generate", "edit", "reorder", "start", "complete", "abandon"],
    configurableParameters: { style: true, priority: true, timerMinutes: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "progressed", "completed", "abandoned", "rated"],
    outcomeFields: ["steps_created", "steps_completed", "duration_ms", "rating"],
    legacyIds: [FEATURES.ADHD_BREAKDOWN],
  },
  {
    id: "support.focus_session",
    moduleId: "support.focus_session",
    title: "Focus Session",
    description: "Use timed focus blocks with reset cues.",
    category: ModuleCategory.EXECUTIVE,
    interventionTypes: ["focus_session", "attention_support"],
    route: "/adhd/focus",
    tags: ["focus", "distraction", "task_switching", "time_blindness"],
    disorders: [],
    expectedOutcomeMetrics: ["session_minutes", "completed_blocks", "interruptions"],
    developmentDomain: "adhd",
    supportedNeeds: ["attention_support", "task_initiation", "stress_reduction"],
    potentiallyRelevantDomains: ["adhd", "anxiety", "asd", "depression", "general"],
    actions: ["start", "pause", "resume", "reset", "complete", "abandon"],
    configurableParameters: { mode: true, durationMinutes: true, intent: true, tag: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "progressed", "completed", "abandoned", "rated"],
    outcomeFields: ["session_minutes", "completed_blocks", "interruptions", "rating"],
    legacyIds: [FEATURES.ADHD_FOCUS],
  },
  {
    id: "support.mood_checkin",
    moduleId: "support.mood_checkin",
    title: "Mood Check-in",
    description: "Use structured prompts for emotional regulation.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["grounding", "emotion_regulation", "calming"],
    route: "/adhd/emotion-coach",
    tags: ["panic", "stress", "emotion_regulation", "overwhelm"],
    disorders: [],
    expectedOutcomeMetrics: ["before_level", "after_level", "duration_ms"],
    safetyLevel: SafetyLevel.CAUTION,
    repetitionLimit: { maxCount: 4, windowHours: 24 },
    developmentDomain: "adhd",
    supportedNeeds: ["emotional_awareness", "emotional_regulation", "stress_reduction"],
    potentiallyRelevantDomains: ["adhd", "anxiety", "asd", "depression", "general"],
    actions: ["check_in", "select_strategy", "complete", "abandon"],
    configurableParameters: { mood: true, note: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "completed", "abandoned", "rated"],
    outcomeFields: ["before_level", "after_level", "duration_ms", "rating"],
    legacyIds: [FEATURES.ADHD_EMOTION],
  },
  {
    id: "support.visual_timeline",
    moduleId: "support.visual_timeline",
    title: "Visual Timeline",
    description: "Organize tasks and routines with time-aware visual blocks.",
    category: ModuleCategory.EXECUTIVE,
    interventionTypes: ["visual_timeline", "routine_support", "time_management"],
    route: "/adhd/timeline",
    tags: ["time_blindness", "planning", "routine", "task_start"],
    disorders: [],
    expectedOutcomeMetrics: ["blocks_created", "blocks_completed", "duration_ms"],
    developmentDomain: "adhd",
    supportedNeeds: ["time_management", "routine_support", "task_initiation"],
    potentiallyRelevantDomains: ["adhd", "asd", "depression", "dyspraxia", "general"],
    actions: ["add_block", "start", "complete", "snooze", "abandon"],
    configurableParameters: { density: true, reminders: true, date: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "progressed", "completed", "abandoned"],
    outcomeFields: ["blocks_created", "blocks_completed", "duration_ms"],
    legacyIds: [FEATURES.ADHD_TIMELINE],
  },
  {
    id: "support.accountability_session",
    moduleId: "support.accountability_session",
    title: "Accountability Session",
    description: "Use a guided accountability session to begin or continue a task.",
    category: ModuleCategory.EXECUTIVE,
    interventionTypes: ["accountability_session", "task_initiation"],
    route: "/adhd/doubling",
    tags: ["task_start", "focus", "planning", "accountability"],
    disorders: [],
    expectedOutcomeMetrics: ["duration_ms", "commitment_met", "rating"],
    developmentDomain: "adhd",
    supportedNeeds: ["task_initiation", "attention_support", "social_connection"],
    potentiallyRelevantDomains: ["adhd", "depression", "anxiety", "general"],
    actions: ["start", "end", "complete", "abandon"],
    configurableParameters: { commitment: true, durationMinutes: true },
    launchPolicy: "confirmation_required",
    lifecycleEvents: ["shown", "started", "progressed", "completed", "abandoned", "rated"],
    outcomeFields: ["duration_ms", "commitment_met", "rating"],
    legacyIds: [FEATURES.ADHD_DOUBLING],
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
    id: FEATURES.ASD_SOCIAL_SCENARIOS,
    moduleId: FEATURES.ASD_SOCIAL_SCENARIOS,
    title: "Social Scenario Simulator",
    description: "Practise responding to one realistic social situation at a time, with voice or text and gentle structured feedback.",
    category: ModuleCategory.SPECIALIZED,
    interventionTypes: ["social_scenario_simulation", "social_practice"],
    route: "/asd/social-scenarios",
    tags: ["social_stress", "communication", "practice"],
    disorders: [DISORDERS.ASD, DISORDERS.ANXIETY],
    expectedOutcomeMetrics: ["attempts", "average_score", "scenario_id"],
    developmentDomain: "asd",
    supportedNeeds: ["social_understanding", "communication_practice", "confidence_building"],
    potentiallyRelevantDomains: ["asd", "anxiety", "general"],
    actions: ["generate", "submit_response", "next", "read_aloud"],
    configurableParameters: { category: true, difficulty: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "progressed", "completed", "abandoned"],
    outcomeFields: ["attempts", "average_score", "scenario_id"],
    safetyLevel: SafetyLevel.CAUTION,
  },
  {
    id: "asd.emotion-decoder",
    moduleId: "asd.emotion-decoder",
    title: "Emotion Decoder",
    description: "Practise reading what someone might be feeling from their voice, face and body, with gentle feedback.",
    category: ModuleCategory.SPECIALIZED,
    interventionTypes: ["emotion_recognition", "social_understanding"],
    route: "/asd/emotion",
    tags: ["emotion_recognition", "social_cues", "practice"],
    disorders: [DISORDERS.ASD, DISORDERS.ANXIETY],
    expectedOutcomeMetrics: ["attempts", "accuracy", "hints_used"],
    developmentDomain: "asd",
    supportedNeeds: ["emotion_recognition", "social_understanding", "confidence_building"],
    potentiallyRelevantDomains: ["asd", "anxiety", "general"],
    actions: ["generate", "answer", "next", "read_aloud"],
    configurableParameters: { difficulty: true, activityType: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "progressed", "completed", "abandoned"],
    outcomeFields: ["attempts", "accuracy", "hints_used"],
  },

  {
    id: "anxiety.hub",
    moduleId: "anxiety.hub",
    title: "Anxiety Support Hub",
    description: "Explore anxiety support tools: guided breathing, grounding exercises and calm spaces.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["guided_breathing", "grounding_exercise", "calm_space"],
    route: "/anxiety",
    tags: ["anxiety", "stress", "overwhelm", "regulation"],
    disorders: [DISORDERS.ANXIETY, DISORDERS.ASD],
    expectedOutcomeMetrics: ["duration_ms", "rating", "intervention_type"],
    safetyLevel: SafetyLevel.CAUTION,
    developmentDomain: "anxiety",
    supportedNeeds: ["anxiety_reduction", "stress_reduction", "emotional_regulation"],
    potentiallyRelevantDomains: ["anxiety", "asd", "general"],
    actions: ["select_intervention", "start", "complete", "abandon", "rate"],
    configurableParameters: { technique: true, durationMinutes: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "completed", "abandoned", "rated"],
    outcomeFields: ["duration_ms", "rating", "intervention_type"],
    legacyIds: [],
  },

  {
    id: FEATURES.DYSLEXIA_ADAPTIVE_READING,
    title: "Adaptive Reading Module",
    description: "Use accessibility controls, TTS, and reading focus tools.",
    category: ModuleCategory.LEARNING,
    interventionTypes: ["adaptive_reading", "tts_support", "reading_accessibility"],
    route: "/dyslexia/adaptive-reading",
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
    id: "support.cognitive_reframing",
    moduleId: "support.cognitive_reframing",
    title: "Cognitive Reframing",
    description: "Use structured prompts to examine difficult thoughts.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["cognitive_reframe", "thought_support"],
    route: "/depression/reality",
    tags: ["rumination", "intrusive_thoughts", "low_mood"],
    disorders: [],
    expectedOutcomeMetrics: ["reframe_completed", "before_level", "after_level"],
    safetyLevel: SafetyLevel.CAUTION,
    developmentDomain: "depression",
    supportedNeeds: ["cognitive_reframing", "low_mood_support", "anxiety_reduction"],
    potentiallyRelevantDomains: ["depression", "anxiety", "adhd", "general"],
    actions: ["analyze", "select_reframe", "complete", "abandon"],
    configurableParameters: { thought: true, reframeStyle: true },
    launchPolicy: "confirmation_required",
    lifecycleEvents: ["shown", "started", "completed", "abandoned", "rated"],
    outcomeFields: ["reframe_completed", "before_level", "after_level", "rating"],
    legacyIds: [FEATURES.DEPRESSION_REALITY],
  },
  {
    id: "support.gentle_activity",
    moduleId: "support.gentle_activity",
    title: "Gentle Activity",
    description: "Use structured regulation and activation guidance.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["behavioral_activation", "daily_momentum"],
    route: "/depression/mvh",
    tags: ["low_mood", "low_energy", "stability"],
    disorders: [],
    expectedOutcomeMetrics: ["steps_completed", "energy_before", "energy_after"],
    safetyLevel: SafetyLevel.CAUTION,
    developmentDomain: "depression",
    supportedNeeds: ["low_mood_support", "low_energy_support", "routine_support"],
    potentiallyRelevantDomains: ["depression", "adhd", "anxiety", "general"],
    actions: ["start", "advance_step", "complete", "abandon"],
    configurableParameters: { activityLevel: true, pacing: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "progressed", "completed", "abandoned", "rated"],
    outcomeFields: ["steps_completed", "energy_before", "energy_after", "rating"],
    legacyIds: [FEATURES.DEPRESSION_MVH],
  },
  {
    id: "support.grounding",
    moduleId: "support.grounding",
    title: "Grounding",
    description: "Use timed grounding techniques to lower anxiety intensity.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["grounding", "anxiety_reduction"],
    route: "/depression/anxietydissolver",
    tags: ["panic", "stress", "anxiety", "emotion_regulation"],
    disorders: [],
    expectedOutcomeMetrics: ["before_level", "after_level", "duration_ms"],
    safetyLevel: SafetyLevel.CAUTION,
    developmentDomain: "depression",
    supportedNeeds: ["stress_reduction", "anxiety_reduction", "emotional_regulation"],
    potentiallyRelevantDomains: ["depression", "anxiety", "adhd", "asd", "general"],
    actions: ["start", "pause", "resume", "complete", "abandon"],
    configurableParameters: { technique: true, durationMinutes: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "completed", "abandoned", "rated"],
    outcomeFields: ["before_level", "after_level", "duration_ms", "rating"],
    legacyIds: [FEATURES.DEPRESSION_ANXIETY_DISSOLVER],
  },
  {
    id: "support.social_connection",
    moduleId: "support.social_connection",
    title: "Social Connection",
    description: "Use guided outreach prompts to reconnect with others.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["social_connection", "outreach_support"],
    route: "/depression/social",
    tags: ["social_stress", "low_mood", "connection"],
    disorders: [],
    expectedOutcomeMetrics: ["outreach_action", "rating"],
    safetyLevel: SafetyLevel.CAUTION,
    developmentDomain: "depression",
    supportedNeeds: ["social_connection", "low_mood_support"],
    potentiallyRelevantDomains: ["depression", "anxiety", "adhd", "general"],
    actions: ["select_template", "copy_message", "complete", "dismiss"],
    configurableParameters: { template: true, status: true },
    launchPolicy: "confirmation_required",
    lifecycleEvents: ["shown", "started", "completed", "dismissed", "rated"],
    outcomeFields: ["outreach_action", "rating"],
    legacyIds: [FEATURES.DEPRESSION_SOCIAL],
  },
  {
    id: "support.evidence_journal",
    moduleId: "support.evidence_journal",
    title: "Evidence Journal",
    description: "Retain user-approved evidence entries in a private local journal.",
    category: ModuleCategory.EMOTIONAL,
    interventionTypes: ["evidence_journal", "structured_reflection"],
    route: "/depression/evidence",
    tags: ["reflection", "self_support"], disorders: [],
    expectedOutcomeMetrics: ["entries_saved", "rating"], safetyLevel: SafetyLevel.CAUTION,
    developmentDomain: "depression", supportedNeeds: ["cognitive_reframing", "low_mood_support"], potentiallyRelevantDomains: ["depression", "anxiety", "general"],
    actions: ["save_entry", "complete", "abandon"], configurableParameters: { category: true }, launchPolicy: "confirmation_required",
    lifecycleEvents: ["shown", "started", "progressed", "completed", "abandoned", "rated"], outcomeFields: ["entries_saved", "rating"], legacyIds: [],
  },
  {
    id: FEATURES.COMMUNICATION,
    moduleId: FEATURES.COMMUNICATION,
    title: "Conversation Practice",
    description: "Practice real conversations with an AI partner, using voice or text, with structured feedback and adaptive difficulty.",
    category: ModuleCategory.SPECIALIZED,
    interventionTypes: ["communication_simulation", "social_practice"],
    route: "/communication",
    tags: ["communication", "social_practice", "conversation"],
    disorders: [DISORDERS.ASD, DISORDERS.ANXIETY, DISORDERS.ADHD, DISORDERS.APD],
    expectedOutcomeMetrics: ["communication_score", "turns_completed", "difficulty"],
    safetyLevel: SafetyLevel.CAUTION,
    developmentDomain: "general",
    supportedNeeds: ["communication_practice", "social_practice", "confidence_building"],
    potentiallyRelevantDomains: ["asd", "anxiety", "adhd", "apd", "general"],
    actions: ["start", "submit_reply", "pause", "resume", "complete", "abandon"],
    configurableParameters: { domain: true, difficulty: true },
    launchPolicy: "user_initiated",
    lifecycleEvents: ["shown", "started", "completed", "abandoned", "rated"],
    outcomeFields: ["communication_score", "turns_completed", "difficulty"],
    legacyIds: [],
  },
];

export const SUPPORT_MODULES = rawSupportModules.map((module) =>
  validateSupportModuleDefinition({
    privacyDefault: PrivacyLevel.PRIVATE,
    safetyLevel: SafetyLevel.STANDARD,
    supportedRoles: ["user"],
    repetitionLimit: { maxCount: 2, windowHours: 24 },
    ...module,
    ...(moduleAdaptationSets[module.id] ?? {}),
  }),
);

export const SUPPORT_MODULE_LOOKUP = SUPPORT_MODULES.reduce((acc, module) => {
  acc[module.id] = module;
  module.legacyIds.forEach((legacyId) => {
    acc[legacyId] = module;
  });
  return acc;
}, {});

export function getSupportModules() {
  return [...SUPPORT_MODULES];
}

export function getSupportModuleById(moduleId) {
  return SUPPORT_MODULE_LOOKUP[moduleId] ?? null;
}

export function getCanonicalSupportModuleId(moduleId) {
  return getSupportModuleById(moduleId)?.id ?? null;
}

export function getSupportModulesByInterventionType(interventionType) {
  return SUPPORT_MODULES.filter((module) => module.interventionTypes.includes(interventionType));
}

export function getSupportModulesByRoute(route) {
  return SUPPORT_MODULES.filter((module) => module.route === route);
}

