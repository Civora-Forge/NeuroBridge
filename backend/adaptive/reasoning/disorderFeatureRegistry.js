import { FEATURES } from "@/lib/featureRegistry";
import { DISORDERS } from "@/lib/disorders";

export const SUPPORT_MODULE_REGISTRY = [
  {
    id: FEATURES.OCD,
    title: "Exposure Practice",
    description: "Build confidence with gradual challenge exposure.",
    tags: ["avoidance", "fear", "ritual_loop", "uncertainty"],
    disorders: [DISORDERS.OCD, DISORDERS.ANXIETY],
    path: "/ocd",
  },
  {
    id: FEATURES.ANXIETY,
    title: "Calming Toolkit",
    description: "Use grounding, breathing, and regulation routines.",
    tags: ["panic", "overwhelm", "stress_reactivity", "avoidance"],
    disorders: [DISORDERS.ANXIETY, DISORDERS.ASD],
    path: "/anxiety",
  },
  {
    id: FEATURES.DEPRESSION,
    title: "Daily Momentum",
    description: "Rebuild motivation and daily activation in small steps.",
    tags: ["low_motivation", "low_energy", "withdrawal", "hopelessness"],
    disorders: [DISORDERS.DEPRESSION, DISORDERS.ADHD],
    path: "/depression",
  },
  {
    id: FEATURES.ADHD,
    title: "Focus Flow",
    description: "Structure tasks, focus blocks, and executive support.",
    tags: ["distractibility", "task_switching", "low_motivation", "time_blindness"],
    disorders: [DISORDERS.ADHD, DISORDERS.DYSPRAXIA],
    path: "/adhd",
  },
  {
    id: FEATURES.ASD,
    title: "Sensory Balance",
    description: "Reduce overload with sensory and social support routines.",
    tags: ["sensory_overload", "social_strain", "routine_disruption", "stress_reactivity"],
    disorders: [DISORDERS.ASD, DISORDERS.ANXIETY],
    path: "/asd",
  },
  {
    id: FEATURES.DYSLEXIA,
    title: "Reading Support",
    description: "Adaptive reading tools and language reinforcement.",
    tags: ["reading_fatigue", "word_recall", "processing_load"],
    disorders: [DISORDERS.DYSLEXIA],
    path: "/dyslexia",
  },
  {
    id: FEATURES.DYSCALCULIA,
    title: "Number Confidence",
    description: "Step-by-step number and math confidence exercises.",
    tags: ["number_anxiety", "processing_load", "working_memory"],
    disorders: [DISORDERS.DYSCALCULIA],
    path: "/dyscalculia",
  },
  {
    id: FEATURES.DYSPRAXIA,
    title: "Motor Planning",
    description: "Improve sequencing and coordination with guided routines.",
    tags: ["motor_planning", "task_sequencing", "coordination"],
    disorders: [DISORDERS.DYSPRAXIA, DISORDERS.ADHD],
    path: "/dyspraxia",
  },
  {
    id: FEATURES.APD,
    title: "Audio Clarity",
    description: "Support listening clarity and auditory processing.",
    tags: ["auditory_processing", "processing_load", "attention_filtering"],
    disorders: [DISORDERS.APD],
    path: "/apd",
  },
];

export const SUPPORT_MODULE_LOOKUP = SUPPORT_MODULE_REGISTRY.reduce((acc, module) => {
  acc[module.id] = module;
  return acc;
}, {});

export function getModulePath(moduleId) {
  return SUPPORT_MODULE_LOOKUP[moduleId]?.path ?? "/";
}
