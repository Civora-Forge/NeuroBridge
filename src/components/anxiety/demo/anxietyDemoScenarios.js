/**
 * anxietyDemoScenarios.js — Isolated deterministic scenarios using real production engine logic
 *
 * Responsibilities:
 *   - Provides deterministic test and demonstration scenarios for evaluator inspection.
 *   - Invocates production state derivation, reasoning, planning, and adaptation functions directly.
 *   - No "if (demoMode)" contamination in production domain logic.
 */

import { deriveAnxietyState } from "../domain/anxietyStateEngine";
import { reasonAnxietyPattern } from "../domain/anxietyReasoner";
import { createEpisode, updateEpisode } from "../domain/anxietyEpisodeEngine";
import { planInterventions } from "../planning/anxietyPlanner";
import { createOutcomeRecord } from "../adaptation/anxietyOutcomeModel";
import { recordOutcome, getPersonalizedModifier, clearUserOutcomes } from "../adaptation/anxietyPersonalization";
import { AnxietyPatternType, InterventionId } from "../domain/anxietyTypes";

/**
 * Scenario 1: Acute Physiological Escalation
 */
export function runScenario1_PhysiologicalEscalation(userId = "demo_user") {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const history = [
    { severity: 3, level: 3, loggedAt: tenMinutesAgo },
  ];

  const input = {
    severity: 8,
    selectedTags: ["racing_heart", "tension_shaking"],
    triggerText: "Sudden racing pulse and tight chest before entering the venue",
    timestamp: now,
  };

  // Run production pipeline
  const state = deriveAnxietyState(input, history);
  const reasoning = reasonAnxietyPattern(state);
  const episode = createEpisode(state, input.triggerText, now);
  const plan = planInterventions(state, reasoning, episode, userId);

  return {
    scenarioId: "scenario_1_physiological",
    title: "Scenario 1: Acute Physiological Escalation",
    input,
    history,
    state,
    reasoning,
    episode,
    plan,
    expectedPattern: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
    expectedRecommendation: InterventionId.PHYSIOLOGICAL_BREATHING,
  };
}

/**
 * Scenario 2: Cognitive Worry Loop
 */
export function runScenario2_CognitiveWorryLoop(userId = "demo_user") {
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const history = [
    { severity: 5, level: 5, loggedAt: threeHoursAgo },
  ];

  const input = {
    severity: 6,
    selectedTags: ["worry_loop", "catastrophizing"],
    triggerText: "What if I fail the exam and everything is ruined and completely hopeless",
    timestamp: now,
  };

  // Run production pipeline
  const state = deriveAnxietyState(input, history);
  const reasoning = reasonAnxietyPattern(state);
  const episode = createEpisode(state, input.triggerText, now);
  const plan = planInterventions(state, reasoning, episode, userId);

  return {
    scenarioId: "scenario_2_cognitive",
    title: "Scenario 2: Cognitive Worry Loop",
    input,
    history,
    state,
    reasoning,
    episode,
    plan,
    expectedPattern: AnxietyPatternType.COGNITIVE_WORRY_LOOP,
    expectedRecommendation: InterventionId.COGNITIVE_REFRAME,
  };
}

/**
 * Scenario 3: State-Specific Personalized Adaptation
 * Demonstrates that breathing success boosts future physiological episodes but does NOT contaminate cognitive episodes.
 */
export function runScenario3_PersonalizedAdaptation(userId = "demo_user") {
  // Step 1: Pre-populate history with successful breathing outcomes for PHYSIOLOGICAL_ESCALATION
  const simulatedHistoricalOutcomes = [
    createOutcomeRecord({
      userId,
      interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
      patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      preSeverity: 8,
      postSeverity: 4,
      completed: true,
      durationSeconds: 120,
    }),
    createOutcomeRecord({
      userId,
      interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
      patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      preSeverity: 7,
      postSeverity: 4,
      completed: true,
      durationSeconds: 120,
    }),
  ];

  // Test on a new Physiological Escalation episode
  const physScenario = runScenario1_PhysiologicalEscalation(userId);
  const physPlanWithLearning = planInterventions(
    physScenario.state,
    physScenario.reasoning,
    physScenario.episode,
    userId,
    simulatedHistoricalOutcomes
  );

  const physBreathingCandidate = physPlanWithLearning.allCandidates.find(
    (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
  );

  // Test on a new Cognitive episode
  const cogScenario = runScenario2_CognitiveWorryLoop(userId);
  const cogPlanWithLearning = planInterventions(
    cogScenario.state,
    cogScenario.reasoning,
    cogScenario.episode,
    userId,
    simulatedHistoricalOutcomes
  );

  const cogBreathingCandidate = cogPlanWithLearning.allCandidates.find(
    (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
  );

  return {
    scenarioId: "scenario_3_adaptation",
    title: "Scenario 3: State-Specific Personalization",
    simulatedOutcomes: simulatedHistoricalOutcomes,
    physiologicalEpisode: {
      pattern: physScenario.reasoning.pattern,
      breathingScore: physBreathingCandidate?.score,
      personalizedBonus: physBreathingCandidate?.personalizedBonus,
      personalizationNote: physBreathingCandidate?.personalizationNote,
      topRecommendation: physPlanWithLearning.recommendedIntervention.id,
    },
    cognitiveEpisode: {
      pattern: cogScenario.reasoning.pattern,
      breathingScore: cogBreathingCandidate?.score,
      personalizedBonus: cogBreathingCandidate?.personalizedBonus,
      personalizationNote: cogBreathingCandidate?.personalizationNote,
      topRecommendation: cogPlanWithLearning.recommendedIntervention.id,
    },
    learningConfirmed:
      (physBreathingCandidate?.personalizedBonus || 0) > 0 &&
      (cogBreathingCandidate?.personalizedBonus || 0) === 0,
  };
}

/**
 * Scenario 4: Stable Baseline (Monitor Only)
 */
export function runScenario4_MonitorOnly(userId = "demo_user") {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const history = [
    { severity: 2, level: 2, loggedAt: twoHoursAgo },
  ];

  const input = {
    severity: 2,
    selectedTags: [],
    triggerText: "Reading calmly at desk",
    timestamp: now,
  };

  // Run production pipeline
  const state = deriveAnxietyState(input, history);
  const reasoning = reasonAnxietyPattern(state);
  const episode = createEpisode(state, input.triggerText, now);
  const plan = planInterventions(state, reasoning, episode, userId);

  return {
    scenarioId: "scenario_4_monitor",
    title: "Scenario 4: Stable Baseline (Monitor Only)",
    input,
    history,
    state,
    reasoning,
    episode,
    plan,
    expectedPattern: AnxietyPatternType.STABLE_BASELINE,
    expectedRecommendation: InterventionId.NO_INTERVENTION,
    isMonitorOnly: plan.isMonitorOnly,
  };
}

export const DEMO_SCENARIO_RUNNERS = [
  { id: "scenario_1", title: "Scenario 1: Physiological Escalation", run: runScenario1_PhysiologicalEscalation },
  { id: "scenario_2", title: "Scenario 2: Cognitive Worry Loop", run: runScenario2_CognitiveWorryLoop },
  { id: "scenario_3", title: "Scenario 3: Learned Outcome Adaptation", run: runScenario3_PersonalizedAdaptation },
  { id: "scenario_4", title: "Scenario 4: Stable Baseline (Monitor Only)", run: runScenario4_MonitorOnly },
];
