export const CHALLENGE_SELECTION_OPTIONS = [
  {
    id: "calm_under_pressure",
    title: "Staying calm in intense moments",
    description: "Stress spikes, panic sensations, or hard-to-settle thoughts.",
    tags: ["panic", "overwhelm", "stress_reactivity"],
  },
  {
    id: "reduce_avoidance",
    title: "Facing avoided situations",
    description: "Putting off places, tasks, or conversations due to discomfort.",
    tags: ["avoidance", "fear", "uncertainty"],
  },
  {
    id: "daily_motivation",
    title: "Building daily momentum",
    description: "Trouble starting tasks, low energy, or inconsistent routines.",
    tags: ["low_motivation", "low_energy", "routine_disruption"],
  },
  {
    id: "focus_and_planning",
    title: "Improving focus and planning",
    description: "Distractibility, task switching, or time management strain.",
    tags: ["distractibility", "task_switching", "time_blindness"],
  },
  {
    id: "sensory_balance",
    title: "Managing sensory overload",
    description: "Noise, crowds, transitions, or social environments feel overwhelming.",
    tags: ["sensory_overload", "social_strain", "processing_load"],
  },
];

export const ONBOARDING_QUESTIONS = [
  {
    id: "avoidance_behavior",
    question: "How often do you avoid situations because they feel emotionally intense?",
    options: [
      { id: "often", text: "Often", tags: ["avoidance", "fear"], weight: 2 },
      { id: "sometimes", text: "Sometimes", tags: ["avoidance"], weight: 1 },
      { id: "rarely", text: "Rarely", tags: [], weight: 0 },
    ],
  },
  {
    id: "repetitive_actions",
    question: "Do you feel pushed to repeat actions until they feel complete or safe?",
    options: [
      { id: "frequently", text: "Frequently", tags: ["ritual_loop", "uncertainty"], weight: 2 },
      { id: "occasionally", text: "Occasionally", tags: ["ritual_loop"], weight: 1 },
      { id: "never", text: "Never", tags: [], weight: 0 },
    ],
  },
  {
    id: "panic_reactivity",
    question: "When stress rises, how often do you feel physically on edge (racing heart, breath, urgency)?",
    options: [
      { id: "very_often", text: "Very often", tags: ["panic", "stress_reactivity"], weight: 2 },
      { id: "sometimes", text: "Sometimes", tags: ["stress_reactivity"], weight: 1 },
      { id: "rarely", text: "Rarely", tags: [], weight: 0 },
    ],
  },
  {
    id: "motivation_drive",
    question: "How often is it hard to begin or complete important daily tasks?",
    options: [
      { id: "very_often", text: "Very often", tags: ["low_motivation", "low_energy"], weight: 2 },
      { id: "sometimes", text: "Sometimes", tags: ["low_motivation"], weight: 1 },
      { id: "rarely", text: "Rarely", tags: [], weight: 0 },
    ],
  },
  {
    id: "focus_switching",
    question: "How often do you lose track when switching between tasks?",
    options: [
      { id: "often", text: "Often", tags: ["distractibility", "task_switching"], weight: 2 },
      { id: "sometimes", text: "Sometimes", tags: ["task_switching"], weight: 1 },
      { id: "rarely", text: "Rarely", tags: [], weight: 0 },
    ],
  },
  {
    id: "sensory_overload",
    question: "How frequently do sounds, lights, or crowded spaces feel overwhelming?",
    options: [
      { id: "frequently", text: "Frequently", tags: ["sensory_overload", "processing_load"], weight: 2 },
      { id: "occasionally", text: "Occasionally", tags: ["sensory_overload"], weight: 1 },
      { id: "rarely", text: "Rarely", tags: [], weight: 0 },
    ],
  },
];
