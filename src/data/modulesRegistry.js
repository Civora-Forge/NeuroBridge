import { FEATURES } from "@/lib/featureRegistry";
import { getCanonicalSupportModuleId } from "@/support/framework/supportModuleRegistry";

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
    description: "Focus and planning tools, including Visual Timeline and Focus Session.",
    icon: "Zap",
    launchRoute: "/adhd",
    tags: ["focus", "time_blindness", "planning"],
    isNavigationOnly: true,
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
    title: "Focus Session",
    description: "Use timed focus blocks with reset cues.",
    icon: "Timer",
    launchRoute: "/adhd/focus",
    tags: ["focus", "distraction"],
  },
  [FEATURES.ADHD_EMOTION]: {
    id: FEATURES.ADHD_EMOTION,
    title: "Mood Check-in",
    description: "Regulate emotional spikes with quick prompts.",
    icon: "Brain",
    launchRoute: "/adhd/emotion-coach",
    tags: ["emotion_regulation", "panic", "stress"],
  },
  [FEATURES.ADHD_DOUBLING]: {
    id: FEATURES.ADHD_DOUBLING,
    title: "Accountability Session",
    description: "Stay on task with guided accountability sessions.",
    icon: "Activity",
    launchRoute: "/adhd/doubling",
    tags: ["task_start", "focus", "planning"],
  },
  "support.task_breakdown": {
    id: "support.task_breakdown",
    title: "Task Breakdown",
    description: "Split large tasks into easier guided steps.",
    icon: "Activity",
    launchRoute: "/adhd/breakdown",
    tags: ["overwhelm", "planning", "task_start"],
  },
  "support.focus_session": {
    id: "support.focus_session",
    title: "Focus Session",
    description: "Use timed focus blocks with reset cues.",
    icon: "Timer",
    launchRoute: "/adhd/focus",
    tags: ["focus", "distraction"],
  },
  "support.visual_timeline": {
    id: "support.visual_timeline",
    title: "Visual Timeline",
    description: "Organize schedules for better time awareness.",
    icon: "Clock",
    launchRoute: "/adhd/timeline",
    tags: ["time_blindness", "planning"],
  },
  "support.mood_checkin": {
    id: "support.mood_checkin",
    title: "Mood Check-in",
    description: "Regulate emotional spikes with quick prompts.",
    icon: "Brain",
    launchRoute: "/adhd/emotion-coach",
    tags: ["emotion_regulation", "panic", "stress"],
  },
  "support.accountability_session": {
    id: "support.accountability_session",
    title: "Accountability Session",
    description: "Stay on task with guided accountability sessions.",
    icon: "Activity",
    launchRoute: "/adhd/doubling",
    tags: ["task_start", "focus", "planning"],
  },
  "support.gentle_activity": {
    id: "support.gentle_activity",
    title: "Gentle Activity",
    description: "Try a short sequence of low-energy actions.",
    icon: "Activity",
    launchRoute: "/depression/mvh",
    tags: ["low_mood", "low_energy", "stability"],
  },
  "support.grounding": {
    id: "support.grounding",
    title: "Grounding",
    description: "Use a timed technique to steady your attention.",
    icon: "Leaf",
    launchRoute: "/depression/anxietydissolver",
    tags: ["panic", "stress", "anxiety", "emotion_regulation"],
  },
  "support.social_connection": {
    id: "support.social_connection",
    title: "Social Connection",
    description: "Prepare a low-pressure message for someone you trust.",
    icon: "Clock",
    launchRoute: "/depression/social",
    tags: ["social_stress", "low_mood", "connection"],
  },
  "support.cognitive_reframing": {
    id: "support.cognitive_reframing",
    title: "Cognitive Reframing",
    description: "Use structured questions to review a difficult thought.",
    icon: "Timer",
    launchRoute: "/depression/reality",
    tags: ["intrusive_thoughts", "rumination", "low_mood"],
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
  [FEATURES.ASD_STORIES]: {
    id: FEATURES.ASD_STORIES,
    title: "Social Story Builder",
    description: "Practice social scenarios with visual story cards.",
    icon: "BookOpen",
    launchRoute: "/asd/stories",
    tags: ["social_stress", "communication"],
    homeGroup: FEATURES.ASD,
  },
  [FEATURES.ASD_EMOTION]: {
    id: FEATURES.ASD_EMOTION,
    title: "Emotional Check-in",
    description: "Tap emotion cards to hear support guidance aloud.",
    icon: "Smile",
    launchRoute: "/asd/emotion",
    tags: ["emotion_regulation", "social_stress"],
    homeGroup: FEATURES.ASD,
  },
  [FEATURES.ASD_SOCIAL_SCENARIOS]: {
    id: FEATURES.ASD_SOCIAL_SCENARIOS,
    title: "Social Scenario Simulator",
    description: "Practice real conversations with guided feedback and gentle adaptation.",
    icon: "MessageCircle",
    launchRoute: "/asd/social-scenarios",
    tags: ["social_stress", "communication", "practice"],
    homeGroup: FEATURES.ASD,
  },
  [FEATURES.COMMUNICATION]: {
    id: FEATURES.COMMUNICATION,
    title: "Conversation Practice",
    description: "Practice real conversations by voice or text with an AI partner and structured feedback.",
    icon: "MessagesSquare",
    launchRoute: "/communication",
    tags: ["communication", "social_stress", "practice", "voice"],
  },
  "dyslexia.adaptive-reading": {
    id: "dyslexia.adaptive-reading",
    title: "Adaptive Reading",
    description: "Practice guided reading with adaptive pacing.",
    icon: "Leaf",
    launchRoute: "/dyslexia/adaptive-reading",
    tags: ["reading_fatigue", "focus"],
  },
  [FEATURES.DYSLEXIA_ADAPTIVE_READING]: {
    id: FEATURES.DYSLEXIA_ADAPTIVE_READING,
    title: "Adaptive Reading Module",
    description: "OpenDyslexic reader with TTS, focus mode, reading ruler, and full accessibility controls.",
    icon: "BookOpenText",
    launchRoute: "/dyslexia/adaptive-reading",
    tags: ["reading_fatigue", "focus", "tts", "accessibility"],
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
    title: "Gentle Activity",
    description: "Use structured regulation and activation guidance.",
    icon: "Activity",
    launchRoute: "/depression/mvh",
    tags: ["low_mood", "stability"],
  },
  [FEATURES.DEPRESSION_ANXIETY_DISSOLVER]: {
    id: FEATURES.DEPRESSION_ANXIETY_DISSOLVER,
    title: "Grounding",
    description: "Lower anxiety intensity with guided techniques.",
    icon: "Leaf",
    launchRoute: "/depression/anxietydissolver",
    tags: ["panic", "stress", "emotion_regulation"],
  },
  [FEATURES.DEPRESSION_SOCIAL]: {
    id: FEATURES.DEPRESSION_SOCIAL,
    title: "Social Connection",
    description: "Rebuild social momentum with guided outreach tasks.",
    icon: "Clock",
    launchRoute: "/depression/social",
    tags: ["social_stress", "low_mood"],
  },
  [FEATURES.DEPRESSION_REALITY]: {
    id: FEATURES.DEPRESSION_REALITY,
    title: "Cognitive Reframing",
    description: "Reframe difficult thoughts using structured prompts.",
    icon: "Timer",
    launchRoute: "/depression/reality",
    tags: ["intrusive_thoughts", "rumination"],
  },
};

// Hub root cards for grouped toolkits. Any enabled module flagged with
// `homeGroup` collapses into this single card so Home links to the hub instead
// of deep-linking to a tool (keeps browser-back from dumping users on Home).
const HOME_HUB_GROUPS = {
  [FEATURES.ASD]: {
    id: FEATURES.ASD,
    title: "Social & Emotional Support",
    description: "Social stories, emotion tools and conversation practice in one place.",
    icon: "Brain",
    launchRoute: "/asd",
    tags: ["social_stress", "communication", "emotion_regulation"],
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
    FEATURES.ASD_STORIES,
    FEATURES.ASD_EMOTION,
    FEATURES.ASD_SOCIAL_SCENARIOS,
    FEATURES.COMMUNICATION,
  ],
  dyslexia: [
    "dyslexia.adaptive-reading",
    FEATURES.DYSLEXIA_ADAPTIVE_READING,
    FEATURES.ADHD_FOCUS,
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
  adhd: [
    "support.task_breakdown",
    "support.focus_session",
    "support.visual_timeline",
    "support.mood_checkin",
    "support.accountability_session",
  ],
  anxiety: ["support.mood_checkin", FEATURES.COMMUNICATION],
  depression: [
    "support.gentle_activity",
    "support.grounding",
    "support.social_connection",
    "support.cognitive_reframing",
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

/** Build the one deterministic home-card list from raw profile and legacy IDs. */
export function composeHomeModules(candidateModuleIds = []) {
  const seen = new Set();
  const modules = [];

  // Collapse grouped toolkits (e.g. ASD) into a single hub-root card so Home
  // links to the hub rather than deep-linking to an individual tool.
  const activeGroups = new Set();
  for (const candidateId of candidateModuleIds) {
    const groupId = MODULES_REGISTRY[candidateId]?.homeGroup;
    if (groupId && HOME_HUB_GROUPS[groupId]) activeGroups.add(groupId);
  }

  for (const candidateId of candidateModuleIds) {
    if (seen.has(candidateId)) continue;

    if (HOME_HUB_GROUPS[candidateId]) {
      seen.add(candidateId);
      modules.push({ ...HOME_HUB_GROUPS[candidateId], id: candidateId });
      continue;
    }

    const canonicalId = getCanonicalSupportModuleId(candidateId) ?? candidateId;
    if (seen.has(canonicalId)) continue;

    const module = MODULES_REGISTRY[canonicalId] ?? MODULES_REGISTRY[candidateId];
    if (!module || module.isNavigationOnly || module.isHidden || module.isUnavailable) continue;
    if (module.homeGroup && activeGroups.has(module.homeGroup)) continue;

    seen.add(canonicalId);
    modules.push({ ...module, id: canonicalId });
  }

  // Emit hub roots implied by enabled grouped tools, once each.
  for (const [groupId, hub] of Object.entries(HOME_HUB_GROUPS)) {
    if (activeGroups.has(groupId) && !seen.has(groupId)) {
      seen.add(groupId);
      modules.push({ ...hub, id: groupId });
    }
  }

  return modules;
}

export function getSelectableModuleIds() {
  return composeHomeModules(Object.keys(MODULES_REGISTRY)).map((module) => module.id);
}
