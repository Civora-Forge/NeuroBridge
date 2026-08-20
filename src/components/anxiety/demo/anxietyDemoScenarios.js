/**
 * anxietyDemoScenarios.js — Isolated deterministic test scenarios driving the production adaptive engine
 *
 * Responsibilities:
 *   - Feeds realistic demo ContextSnapshots through the exact production adapter & reasoning pipeline.
 *   - No hardcoded pattern/intervention assignments.
 *   - Demonstrates genuine state-specific personalized outcome learning.
 */

import {
  scenario1_physiologicalSnapshot,
  scenario2_cognitiveSnapshot,
  scenario3_avoidanceSnapshot,
  scenario4_stableBaselineSnapshot,
} from "./demoContextSnapshots";
import { adaptContextToAnxietyEvidence } from "../domain/anxietyContextAdapter";
import { deriveAnxietyState } from "../domain/anxietyStateEngine";
import { reasonAnxietyPattern } from "../domain/anxietyReasoner";
import { createEpisode, updateEpisode } from "../domain/anxietyEpisodeEngine";
import { planInterventions } from "../planning/anxietyPlanner";
import { createOutcomeRecord } from "../adaptation/anxietyOutcomeModel";
import { recordOutcome, getPersonalizedModifier } from "../adaptation/anxietyPersonalization";
import { AnxietyPatternType, InterventionId } from "../domain/anxietyTypes";

/**
 * Scenario 1: Acute Physiological Escalation from Passive Context
 */
export function runScenario1_PhysiologicalEscalation(userId = "demo_evaluator") {
  const snapshot = scenario1_physiologicalSnapshot;
  const userBaseline = { taskSwitchFrequency: 0.2, correctionRate: 0.1 };

  // Run production pipeline from snapshot
  const state = deriveAnxietyState({ contextSnapshot: snapshot, userBaseline });
  const reasoning = reasonAnxietyPattern(state);
  const episode = createEpisode(state, "Passive motor restlessness telemetry");
  const plan = planInterventions(state, reasoning, episode, userId);

  return {
    scenarioId: "scenario_1_physiological",
    title: "Scenario 1: Physiological Escalation (Passive Churn)",
    rawSnapshot: snapshot,
    state,
    reasoning,
    episode,
    plan,
    expectedPattern: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
    expectedRecommendation: InterventionId.PHYSIOLOGICAL_BREATHING,
  };
}

/**
 * Scenario 2: Cognitive Worry Loop from Passive Context
 */
export function runScenario2_CognitiveWorryLoop(userId = "demo_evaluator") {
  const snapshot = scenario2_cognitiveSnapshot;
  const userBaseline = { taskSwitchFrequency: 0.2, correctionRate: 0.1 };

  // Run production pipeline from snapshot
  const state = deriveAnxietyState({ contextSnapshot: snapshot, userBaseline });
  const reasoning = reasonAnxietyPattern(state);
  const episode = createEpisode(state, "Typing hesitation & navigation churn");
  const plan = planInterventions(state, reasoning, episode, userId);

  return {
    scenarioId: "scenario_2_cognitive",
    title: "Scenario 2: Cognitive Worry Loop (Hesitation Bursts)",
    rawSnapshot: snapshot,
    state,
    reasoning,
    episode,
    plan,
    expectedPattern: AnxietyPatternType.COGNITIVE_WORRY_LOOP,
    expectedRecommendation: InterventionId.COGNITIVE_REFRAME,
  };
}

/**
 * Scenario 3: Avoidance & Task Initiation Freeze from Passive Context
 */
export function runScenario3_AvoidanceDriven(userId = "demo_evaluator") {
  const snapshot = scenario3_avoidanceSnapshot;
  const userBaseline = { taskSwitchFrequency: 0.2, correctionRate: 0.1 };

  // Run production pipeline from snapshot
  const state = deriveAnxietyState({ contextSnapshot: snapshot, userBaseline });
  const reasoning = reasonAnxietyPattern(state);
  const episode = createEpisode(state, "Inactivity freeze on active task");
  const plan = planInterventions(state, reasoning, episode, userId);

  return {
    scenarioId: "scenario_3_avoidance",
    title: "Scenario 3: Avoidance / Task Freeze (Inactivity)",
    rawSnapshot: snapshot,
    state,
    reasoning,
    episode,
    plan,
    expectedPattern: AnxietyPatternType.AVOIDANCE_DRIVEN,
    expectedRecommendation: InterventionId.BEHAVIORAL_MICRO_ACTION,
  };
}

/**
 * Scenario 4: Stable Baseline (Level 0: Quiet / Do Nothing)
 */
export function runScenario4_MonitorOnly(userId = "demo_evaluator") {
  const snapshot = scenario4_stableBaselineSnapshot;
  const userBaseline = { taskSwitchFrequency: 0.2, correctionRate: 0.1 };

  // Run production pipeline from snapshot
  const state = deriveAnxietyState({ contextSnapshot: snapshot, userBaseline });
  const reasoning = reasonAnxietyPattern(state);
  const episode = createEpisode(state, "Calm baseline telemetry");
  const plan = planInterventions(state, reasoning, episode, userId);

  return {
    scenarioId: "scenario_4_monitor",
    title: "Scenario 4: Stable Baseline (Monitor Only / Level 0)",
    rawSnapshot: snapshot,
    state,
    reasoning,
    episode,
    plan,
    expectedPattern: AnxietyPatternType.STABLE_BASELINE,
    expectedRecommendation: InterventionId.NO_INTERVENTION,
    isMonitorOnly: plan.isMonitorOnly,
  };
}

/**
 * Scenario 5: State-Specific Personalized Adaptation Proof
 * Proves that breathing outcome in physiological state boosts physiological episodes
 * but produces 0 bonus on cognitive episodes.
 */
export function runScenario5_PersonalizedAdaptation(userId = "demo_evaluator") {
  const simulatedHistoricalOutcomes = [
    createOutcomeRecord({
      userId,
      interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
      patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      subjectiveOutcome: "better",
      completed: true,
      durationSeconds: 60,
    }),
    createOutcomeRecord({
      userId,
      interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
      patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
      subjectiveOutcome: "better",
      completed: true,
      durationSeconds: 60,
    }),
  ];

  // 1. Run Physiological Scenario with learned outcomes
  const phys1 = runScenario1_PhysiologicalEscalation(userId);
  const physPlanLearned = planInterventions(
    phys1.state,
    phys1.reasoning,
    phys1.episode,
    userId,
    simulatedHistoricalOutcomes
  );
  const physBreathing = physPlanLearned.allCandidates.find(
    (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
  );

  // 2. Run Cognitive Scenario with learned outcomes
  const cog1 = runScenario2_CognitiveWorryLoop(userId);
  const cogPlanLearned = planInterventions(
    cog1.state,
    cog1.reasoning,
    cog1.episode,
    userId,
    simulatedHistoricalOutcomes
  );
  const cogBreathing = cogPlanLearned.allCandidates.find(
    (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
  );

  return {
    scenarioId: "scenario_5_adaptation",
    title: "Scenario 5: State-Specific Adaptation Proof",
    simulatedOutcomes: simulatedHistoricalOutcomes,
    physiologicalEpisode: {
      pattern: phys1.reasoning.pattern,
      breathingScore: physBreathing?.score,
      personalizedBonus: physBreathing?.personalizedBonus,
      personalizationNote: physBreathing?.personalizationNote,
      topRecommendation: physPlanLearned.recommendedIntervention.id,
    },
    cognitiveEpisode: {
      pattern: cog1.reasoning.pattern,
      breathingScore: cogBreathing?.score,
      personalizedBonus: cogBreathing?.personalizedBonus,
      personalizationNote: cogBreathing?.personalizationNote,
      topRecommendation: cogPlanLearned.recommendedIntervention.id,
    },
    learningConfirmed:
      (physBreathing?.personalizedBonus || 0) > 0 &&
      (cogBreathing?.personalizedBonus || 0) === 0,
  };
}

export const DEMO_SCENARIO_RUNNERS = [
  { id: "scenario_1", title: "Scenario 1: Physiological Escalation", run: runScenario1_PhysiologicalEscalation },
  { id: "scenario_2", title: "Scenario 2: Cognitive Worry Loop", run: runScenario2_CognitiveWorryLoop },
  { id: "scenario_3", title: "Scenario 3: Avoidance & Task Freeze", run: runScenario3_AvoidanceDriven },
  { id: "scenario_4", title: "Scenario 4: Stable Baseline (Level 0)", run: runScenario4_MonitorOnly },
  { id: "scenario_5", title: "Scenario 5: State-Specific Personalization", run: runScenario5_PersonalizedAdaptation },
];
