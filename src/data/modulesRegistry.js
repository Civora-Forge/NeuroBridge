import { FEATURES } from "@/lib/featureRegistry";

export const CHALLENGE_CATEGORIES = [
  { id: "ocd",          label: "Repetitive Thoughts",    emoji: "🔄" },
  { id: "asd",          label: "Sensory & Social",       emoji: "🌿" },
  { id: "dyslexia",     label: "Reading & Writing",      emoji: "📖" },
  { id: "dyscalculia",  label: "Numbers & Maths",        emoji: "🔢" },
  { id: "dyspraxia",    label: "Movement & Coordination",emoji: "🤸" },
  { id: "adhd",         label: "Focus & Attention",      emoji: "⚡" },
  { id: "anxiety",      label: "Anxiety & Stress",       emoji: "💨" },
  { id: "depression",   label: "Low Mood & Energy",      emoji: "🌤️" },
];

export const MODULES_REGISTRY = {
  [FEATURES.ADHD]: {
    id: FEATURES.ADHD,
    title: "ADHD Dashboard",
    description: "Focus and time management tools: Visual Timeline and Focus Sessions.",
    icon: "Zap",
    launchRoute: "/adhd",
    tags: ["focus", "time_blindness", "planning"],
  },
  [FEATURES.ADHD_TIMELINE]: {
    id: FEATURES.ADHD_TIMELINE,
    title: "Visual Timeline",
    description: "Organize schedules for better time awareness.",
    icon: "Clock",
    launchRoute: "/adhd/timeline",
    tags: ["time_blindness", "planning"],
  },
  [FEATURES.ADHD_BREAKDOWN]: {
    id: FEATURES.ADHD_BREAKDOWN,
    title: "Task Breakdown",
    description: "Split large tasks into easier guided steps.",
    icon: "Activity",
    launchRoute: "/adhd/breakdown",
    tags: ["overwhelm", "planning", "task_start"],
  },
  [FEATURES.ADHD_FOCUS]: {
    id: FEATURES.ADHD_FOCUS,
    title: "Focus Sessions",
    description: "Use timed focus blocks with reset cues.",
    icon: "Timer",
    launchRoute: "/adhd/focus",
    tags: ["focus", "distraction"],
  },
  [FEATURES.ADHD_SOUNDS]: {
    id: FEATURES.ADHD_SOUNDS,
    title: "Soundscapes",
    description: "Stabilize attention with supportive ambient audio.",
    icon: "Leaf",
    launchRoute: "/adhd/sounds",
    tags: ["focus", "noise_sensitivity", "sleep"],
  },
  [FEATURES.ADHD_EMOTION]: {
    id: FEATURES.ADHD_EMOTION,
    title: "Emotion Coach",
    description: "Regulate emotional spikes with quick prompts.",
    icon: "Brain",
    launchRoute: "/adhd/emotion-coach",
    tags: ["emotion_regulation", "panic", "stress"],
  },
  [FEATURES.ADHD_DOUBLING]: {
    id: FEATURES.ADHD_DOUBLING,
    title: "Body Doubling",
    description: "Stay on task with guided accountability sessions.",
    icon: "Activity",
    launchRoute: "/adhd/doubling",
    tags: ["task_start", "focus", "planning"],
  },
  [FEATURES.OCD_HIERARCHY]: {
    id: FEATURES.OCD_HIERARCHY,
    title: "Exposure Hierarchy Builder",
    description: "Build a graded fear ladder from easiest to hardest exposure steps.",
    icon: "Layers",
    launchRoute: "/ocd/exposure-hierarchy",
    tags: ["exposure", "fear", "avoidance"],
  },
  [FEATURES.OCD_SUDS]: {
    id: FEATURES.OCD_SUDS,
    title: "SUDS Anxiety Monitor",
    description: "Rate distress 0\u2013100 during exposures and watch anxiety naturally fall.",
    icon: "BarChart2",
    launchRoute: "/ocd/suds-monitor",
    tags: ["anxiety", "exposure", "monitoring"],
  },
  [FEATURES.OCD_SESSION_TIMER]: {
    id: FEATURES.OCD_SESSION_TIMER,
    title: "Exposure Session Timer",
    description: "Time exposure sessions with supportive prompts to prevent avoidance.",
    icon: "Timer",
    launchRoute: "/ocd/exposure-session",
    tags: ["exposure", "avoidance", "urge_control"],
  },
  [FEATURES.OCD_PROGRESS]: {
    id: FEATURES.OCD_PROGRESS,
    title: "ERP Progress Tracker",
    description: "View long-term growth: exposures completed, mastery levels, and streaks.",
    icon: "TrendingUp",
    launchRoute: "/ocd/progress",
    tags: ["progress", "exposure", "patterns"],
  },
  [FEATURES.ASD_ROUTINE]: {
    id: FEATURES.ASD_ROUTINE,
    title: "Routine Visualizer",
    description: "Build and track daily routines with visual timeline support.",
    icon: "Clock",
    launchRoute: "/asd/routine",
    tags: ["routine", "stability"],
  },
  [FEATURES.ASD_SENSORY]: {
    id: FEATURES.ASD_SENSORY,
    title: "Sensory Regulation",
    description: "Tune sensory thresholds and access calming tools.",
    icon: "Activity",
    launchRoute: "/asd/sensory",
    tags: ["sensory_overload", "overwhelm"],
  },
  [FEATURES.ASD_STORIES]: {
    id: FEATURES.ASD_STORIES,
    title: "Social Story Builder",
    description: "Practice social scenarios with visual story cards.",
    icon: "BookOpen",
    launchRoute: "/asd/stories",
    tags: ["social_stress", "communication"],
  },
  [FEATURES.ASD_MELTDOWN]: {
    id: FEATURES.ASD_MELTDOWN,
    title: "Meltdown Prevention",
    description: "Risk awareness and calming workflow for overload moments.",
    icon: "Shield",
    launchRoute: "/asd/meltdown",
    tags: ["panic", "overwhelm"],
  },
  [FEATURES.ASD_EMOTION]: {
    id: FEATURES.ASD_EMOTION,
    title: "Emotional Check-in",
    description: "Tap emotion cards to hear support guidance aloud.",
    icon: "Smile",
    launchRoute: "/asd/emotion",
    tags: ["emotion_regulation", "social_stress"],
  },
  "dyslexia.adaptive-reading": {
    id: "dyslexia.adaptive-reading",
    title: "Adaptive Reading",
    description: "Practice guided reading with adaptive pacing.",
    icon: "Leaf",
    launchRoute: "/dyslexia/adaptive-reading",
    tags: ["reading_fatigue", "focus"],
  },
  "dyscalculia.number-sense": {
    id: "dyscalculia.number-sense",
    title: "Number Sense Engine",
    description: "Build number intuition with scaffolded exercises.",
    icon: "Activity",
    launchRoute: "/dyscalculia/number-sense",
    tags: ["number_confusion", "working_memory"],
  },
  "dyscalculia.step-practice": {
    id: "dyscalculia.step-practice",
    title: "Guided Step Practice",
    description: "Solve math with structured, step-by-step guidance.",
    icon: "Clock",
    launchRoute: "/dyscalculia/step-practice",
    tags: ["step_support", "planning"],
  },
  "dyscalculia.real-life-math": {
    id: "dyscalculia.real-life-math",
    title: "Real-Life Math",
    description: "Practice everyday math scenarios in context.",
    icon: "Leaf",
    launchRoute: "/dyscalculia/real-life-math",
    tags: ["number_confusion", "stability"],
  },
  "dyscalculia.calm-mode": {
    id: "dyscalculia.calm-mode",
    title: "Calm Mode",
    description: "Reduce pressure during difficult number tasks.",
    icon: "Brain",
    launchRoute: "/dyscalculia/calm-mode",
    tags: ["stress", "overwhelm"],
  },
  "dyscalculia.patterns": {
    id: "dyscalculia.patterns",
    title: "Pattern Trainer",
    description: "Strengthen pattern recognition for math fluency.",
    icon: "Timer",
    launchRoute: "/dyscalculia/patterns",
    tags: ["working_memory", "number_confusion"],
  },

  [FEATURES.DEPRESSION_MVH]: {
    id: FEATURES.DEPRESSION_MVH,
    title: "MVH Protocol",
    description: "Use structured regulation and activation guidance.",
    icon: "Activity",
    launchRoute: "/depression/mvh",
    tags: ["low_mood", "stability"],
  },
  [FEATURES.DEPRESSION_ANXIETY_DISSOLVER]: {
    id: FEATURES.DEPRESSION_ANXIETY_DISSOLVER,
    title: "Anxiety Dissolver",
    description: "Lower anxiety intensity with guided techniques.",
    icon: "Leaf",
    launchRoute: "/depression/anxietydissolver",
    tags: ["panic", "stress", "emotion_regulation"],
  },
  [FEATURES.DEPRESSION_SOCIAL]: {
    id: FEATURES.DEPRESSION_SOCIAL,
    title: "Social Broadcaster",
    description: "Rebuild social momentum with guided outreach tasks.",
    icon: "Clock",
    launchRoute: "/depression/social",
    tags: ["social_stress", "low_mood"],
  },
  [FEATURES.DEPRESSION_PROOF]: {
    id: FEATURES.DEPRESSION_PROOF,
    title: "Evidence Folder",
    description: "Collect positive evidence to challenge negative beliefs.",
    icon: "Brain",
    launchRoute: "/depression/proof",
    tags: ["rumination", "low_mood"],
  },
  [FEATURES.DEPRESSION_REALITY]: {
    id: FEATURES.DEPRESSION_REALITY,
    title: "Cognitive Reframer",
    description: "Reframe difficult thoughts using structured prompts.",
    icon: "Timer",
    launchRoute: "/depression/reality",
    tags: ["intrusive_thoughts", "rumination"],
  },
  [FEATURES.DEPRESSION_VOID]: {
    id: FEATURES.DEPRESSION_VOID,
    title: "Void Whisper",
    description: "Use guided prompts during emotional low points.",
    icon: "Activity",
    launchRoute: "/depression/void",
    tags: ["low_mood", "emotion_regulation"],
  },
};

export const CHALLENGE_MODULE_MAP = {
  ocd: [
    FEATURES.OCD_ERP_TRACKER,
    FEATURES.OCD_HIERARCHY,
    FEATURES.OCD_SUDS,
    FEATURES.OCD_SESSION_TIMER,
    FEATURES.OCD_PROGRESS,
  ],
  asd: [
    FEATURES.ASD_ROUTINE,
    FEATURES.ASD_SENSORY,
    FEATURES.ASD_STORIES,
    FEATURES.ASD_MELTDOWN,
    FEATURES.ASD_EMOTION,
  ],
  dyslexia: [
    "dyslexia.adaptive-reading",
    FEATURES.ADHD_FOCUS,
    FEATURES.ADHD_SOUNDS,
  ],
  dyscalculia: [
    "dyscalculia.number-sense",
    "dyscalculia.step-practice",
    "dyscalculia.real-life-math",
    "dyscalculia.calm-mode",
    "dyscalculia.patterns",
    FEATURES.ADHD_BREAKDOWN,
    FEATURES.ADHD_TIMELINE,
  ],
  dyspraxia: [],
  adhd: [FEATURES.ADHD],
  anxiety: [FEATURES.ADHD_EMOTION],
  depression: [
    FEATURES.DEPRESSION_MVH,
    FEATURES.DEPRESSION_ANXIETY_DISSOLVER,
    FEATURES.DEPRESSION_SOCIAL,
    FEATURES.DEPRESSION_PROOF,
    FEATURES.DEPRESSION_REALITY,
    FEATURES.DEPRESSION_VOID,
  ],
};

export function getModulesForChallenges(challengeIds = []) {
  const moduleIds = new Set();
  for (const challengeId of challengeIds) {
    for (const moduleId of CHALLENGE_MODULE_MAP[challengeId] || []) {
      moduleIds.add(moduleId);
    }
  }

  if (moduleIds.size === 0) {
    Object.keys(MODULES_REGISTRY).forEach((moduleId) => moduleIds.add(moduleId));
  }

  return [...moduleIds].map((moduleId) => MODULES_REGISTRY[moduleId]).filter(Boolean);
}
