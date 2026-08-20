/**
 * demoContextSnapshots.js — Deterministic realistic ContextSnapshots for evaluator demonstrations
 *
 * Simulates raw ContextProvider data structures representing distinct behavioral telemetry situations.
 */

export const scenario1_physiologicalSnapshot = {
  snapshotId: "demo-snap-phys-001",
  timestamp: new Date().toISOString(),
  behavior: {
    taskSwitchFrequency: 0.85,
    typingPauseDuration: 1200,
    correctionRate: 0.2,
    idleDuration: 8,
    interactionLatency: 1.2,
  },
  deviceInteraction: {
    focusSessionInterruptions: 3,
    repeatedNavigation: 2,
    timeSinceLastInteraction: 4,
    currentSessionDuration: 720, // 12 minutes
  },
  activity: {
    taskSwitching: "high",
    currentTask: "reading_assignment",
    sessionDurationMs: 12 * 60 * 1000,
  },
  environment: {
    timeOfDay: "afternoon",
    deviceType: "desktop",
  },
};

export const scenario2_cognitiveSnapshot = {
  snapshotId: "demo-snap-cog-002",
  timestamp: new Date().toISOString(),
  behavior: {
    taskSwitchFrequency: 0.25,
    typingPauseDuration: 4200,
    correctionRate: 0.52,
    idleDuration: 15,
    interactionLatency: 4.5,
  },
  deviceInteraction: {
    focusSessionInterruptions: 1,
    repeatedNavigation: 4,
    timeSinceLastInteraction: 8,
    currentSessionDuration: 4200, // 70 minutes
  },
  activity: {
    taskSwitching: "low",
    currentTask: "writing_report",
    sessionDurationMs: 70 * 60 * 1000,
  },
  environment: {
    timeOfDay: "night",
    deviceType: "desktop",
  },
};

export const scenario3_avoidanceSnapshot = {
  snapshotId: "demo-snap-avoid-003",
  timestamp: new Date().toISOString(),
  behavior: {
    taskSwitchFrequency: 0.1,
    typingPauseDuration: 0,
    correctionRate: 0,
    idleDuration: 190, // > 3 minutes inactivity freeze
    interactionLatency: 45,
  },
  deviceInteraction: {
    focusSessionInterruptions: 0,
    repeatedNavigation: 1,
    timeSinceLastInteraction: 190,
    currentSessionDuration: 1800,
  },
  activity: {
    taskSwitching: "low",
    currentTask: "math_problem_set",
    sessionDurationMs: 30 * 60 * 1000,
  },
  environment: {
    timeOfDay: "morning",
    deviceType: "desktop",
  },
};

export const scenario4_stableBaselineSnapshot = {
  snapshotId: "demo-snap-baseline-004",
  timestamp: new Date().toISOString(),
  behavior: {
    taskSwitchFrequency: 0.15,
    typingPauseDuration: 850,
    correctionRate: 0.08,
    idleDuration: 12,
    interactionLatency: 2.1,
  },
  deviceInteraction: {
    focusSessionInterruptions: 0,
    repeatedNavigation: 0,
    timeSinceLastInteraction: 6,
    currentSessionDuration: 900,
  },
  activity: {
    taskSwitching: "low",
    currentTask: "daily_dashboard",
    sessionDurationMs: 15 * 60 * 1000,
  },
  environment: {
    timeOfDay: "afternoon",
    deviceType: "desktop",
  },
};
