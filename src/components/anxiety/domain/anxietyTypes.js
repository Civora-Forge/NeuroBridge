/**
 * anxietyTypes.js — Domain types and constants for the Adaptive Anxiety Engine
 */

export const EpisodeStatus = {
  BASELINE: "BASELINE",
  ESCALATING: "ESCALATING",
  ACTIVE: "ACTIVE",
  RECOVERING: "RECOVERING",
  RESOLVED: "RESOLVED",
};

export const AnxietyPatternType = {
  PHYSIOLOGICAL_ESCALATION: "PHYSIOLOGICAL_ESCALATION",
  COGNITIVE_WORRY_LOOP: "COGNITIVE_WORRY_LOOP",
  AVOIDANCE_DRIVEN: "AVOIDANCE_DRIVEN",
  SENSORY_OVERWHELM: "SENSORY_OVERWHELM",
  STABLE_BASELINE: "STABLE_BASELINE",
  GENERAL_ANXIETY: "GENERAL_ANXIETY",
};

export const InterventionCategory = {
  PHYSIOLOGICAL: "physiological",
  COGNITIVE: "cognitive",
  BEHAVIORAL: "behavioral",
  MONITOR: "monitor",
};

export const InterventionId = {
  PHYSIOLOGICAL_BREATHING: "physiological_breathing",
  PHYSIOLOGICAL_GROUNDING: "physiological_grounding",
  COGNITIVE_REFRAME: "cognitive_reframe",
  BEHAVIORAL_MICRO_ACTION: "behavioral_micro_action",
  NO_INTERVENTION: "no_intervention",
};

export const CONTEXT_TAGS = {
  // Physical / Arousal tags
  RACING_HEART: { id: "racing_heart", label: "Racing Heart / Palpitations", category: "physical", arousalWeight: 0.8 },
  SHORT_BREATH: { id: "short_breath", label: "Shortness of Breath", category: "physical", arousalWeight: 0.75 },
  TENSION_SHAKING: { id: "tension_shaking", label: "Physical Tension / Shaking", category: "physical", arousalWeight: 0.7 },
  CHEST_TIGHTNESS: { id: "chest_tightness", label: "Chest Tightness", category: "physical", arousalWeight: 0.75 },

  // Cognitive / Rumination tags
  WORRY_LOOP: { id: "worry_loop", label: "Looping Thoughts / 'What If'", category: "cognitive", ruminationWeight: 0.8 },
  CATASTROPHIZING: { id: "catastrophizing", label: "Expecting the Worst", category: "cognitive", ruminationWeight: 0.75 },
  MIND_RACING: { id: "mind_racing", label: "Racing Thoughts", category: "cognitive", ruminationWeight: 0.7 },

  // Avoidance / Behavioral tags
  PROCRASTINATION: { id: "procrastination", label: "Task Procrastination / Delay", category: "behavioral", avoidanceWeight: 0.8 },
  TASK_PARALYSIS: { id: "task_paralysis", label: "Task Paralysis / Overwhelm", category: "behavioral", avoidanceWeight: 0.75 },
  AVOIDING_SITUATION: { id: "avoiding_situation", label: "Withdrawing / Avoiding Situation", category: "behavioral", avoidanceWeight: 0.85 },

  // Sensory / Environmental tags
  LOUD_ENVIRONMENT: { id: "loud_environment", label: "Loud / Crowded Environment", category: "sensory", sensoryWeight: 0.8 },
  SENSORY_OVERLOAD: { id: "sensory_overload", label: "Sensory Overload", category: "sensory", sensoryWeight: 0.85 },
};

/**
 * 7 Core Cognitive Distortion Profiles for CBT Reframing
 */
export const CORE_CBT_PATTERNS = [
  {
    id: "catastrophizing",
    name: "Catastrophizing",
    keywords: ["ruined", "disaster", "worst", "terrible", "everything will fail", "it will all go wrong", "doomed", "end of everything"],
    evidencePrompt: "What is the most realistic outcome if this goes imperfectly rather than disastrously?",
    balancedThought: "This is difficult and uncomfortable, but it is manageable. I can handle the next step.",
    actionStep: "Identify one immediate next action and focus solely on that step.",
  },
  {
    id: "all_or_nothing",
    name: "All-or-Nothing Thinking",
    keywords: ["always", "never", "everyone", "nobody", "completely", "totally", "every time", "failed completely"],
    evidencePrompt: "Can you name one exception where this absolute statement was not 100% true?",
    balancedThought: "Real life is nuanced rather than all-or-nothing. A partial success or mistake does not erase effort.",
    actionStep: "Replace absolute words with 'sometimes' or 'in this specific instance'.",
  },
  {
    id: "mind_reading",
    name: "Mind Reading",
    keywords: ["they think", "judging me", "laughing at me", "everyone is looking", "think i'm stupid", "they hate me", "awkward"],
    evidencePrompt: "What verifiable factual evidence supports what they think, versus an assumption?",
    balancedThought: "I cannot know others' thoughts with certainty. Most people are focused on their own tasks.",
    actionStep: "Focus on your own actions and take one grounded breath before speaking or acting.",
  },
  {
    id: "fortune_telling",
    name: "Fortune Telling (Predicting the Worst)",
    keywords: ["will fail", "i know it won't work", "never get better", "going to mess up", "won't be able to"],
    evidencePrompt: "What times in the past did a predicted bad outcome turn out okay or workable?",
    balancedThought: "My fear is predicting a future that hasn't happened. I can prepare without assuming failure.",
    actionStep: "Write down the preparation you have already done and take one small step.",
  },
  {
    id: "overgeneralization",
    name: "Overgeneralization",
    keywords: ["nothing ever works", "same thing again", "always happens to me", "i can't do anything right"],
    evidencePrompt: "Is this single incident proof of an unchangeable rule, or an isolated event?",
    balancedThought: "One difficult moment or setback does not define my overall ability or future outcomes.",
    actionStep: "Treat this situation as a single distinct learning point.",
  },
  {
    id: "perfectionism",
    name: "Perfectionism",
    keywords: ["must be perfect", "can't make mistakes", "flawless", "not good enough", "mess up"],
    evidencePrompt: "What does 'good enough' look like for this task to be completed safely and effectively?",
    balancedThought: "Progress and completion matter more than perfection. Mistakes are part of learning.",
    actionStep: "Define one realistic completion criterion and stop when that threshold is met.",
  },
  {
    id: "intolerance_of_uncertainty",
    name: "Intolerance of Uncertainty",
    keywords: ["need to know", "can't stand not knowing", "uncertain", "what if", "out of control", "not sure"],
    evidencePrompt: "What factors can you influence right now, and what factors must be tolerated?",
    balancedThought: "I can tolerate some uncertainty while continuing to take useful actions in the present.",
    actionStep: "List 1 thing within your control and 1 thing outside your control, then act on what you can control.",
  },
];
