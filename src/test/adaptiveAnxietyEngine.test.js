import { describe, expect, it, beforeEach } from "vitest";
import {
  EpisodeStatus,
  AnxietyPatternType,
  InterventionId,
  InterventionCategory,
  CORE_CBT_PATTERNS,
} from "@/components/anxiety/domain/anxietyTypes";
import {
  adaptContextToAnxietyEvidence,
} from "@/components/anxiety/domain/anxietyContextAdapter";
import {
  deriveAnxietyState,
  deriveEscalation,
} from "@/components/anxiety/domain/anxietyStateEngine";
import { reasonAnxietyPattern } from "@/components/anxiety/domain/anxietyReasoner";
import {
  createEpisode,
  updateEpisode,
} from "@/components/anxiety/domain/anxietyEpisodeEngine";
import { ANXIETY_CANDIDATES } from "@/components/anxiety/planning/anxietyCandidates";
import { planInterventions } from "@/components/anxiety/planning/anxietyPlanner";
import {
  createOutcomeRecord,
  evaluateSubjectiveResponse,
} from "@/components/anxiety/adaptation/anxietyOutcomeModel";
import {
  recordOutcome,
  recordDismissal,
  getRecentDismissalCount,
  getPersonalizedModifier,
  clearUserOutcomes,
  loadUserOutcomes,
} from "@/components/anxiety/adaptation/anxietyPersonalization";
import {
  scenario1_physiologicalSnapshot,
  scenario2_cognitiveSnapshot,
  scenario3_avoidanceSnapshot,
  scenario4_stableBaselineSnapshot,
} from "@/components/anxiety/demo/demoContextSnapshots";
import {
  runScenario1_PhysiologicalEscalation,
  runScenario2_CognitiveWorryLoop,
  runScenario3_AvoidanceDriven,
  runScenario4_MonitorOnly,
  runScenario5_PersonalizedAdaptation,
} from "@/components/anxiety/demo/anxietyDemoScenarios";

describe("Low-Cognitive-Load Adaptive Anxiety Engine", () => {
  const TEST_USER = "test_evaluator_user_99";

  beforeEach(() => {
    clearUserOutcomes(TEST_USER);
  });

  describe("1. Anxiety Context Adapter (Passive Telemetry Extraction)", () => {
    it("extracts task_friction evidence when task switching is elevated", () => {
      const result = adaptContextToAnxietyEvidence({
        behavior: { taskSwitchFrequency: 0.8 },
      });
      const friction = result.evidence.find((e) => e.type === "task_friction");
      expect(friction).toBeTruthy();
      expect(friction.strength).toBe(0.8);
      expect(friction.confidence).toBeGreaterThan(0.7);
    });

    it("extracts hesitation_bursts evidence when typing pause and correction rate are elevated", () => {
      const result = adaptContextToAnxietyEvidence({
        behavior: { typingPauseDuration: 3500, correctionRate: 0.45 },
      });
      const hesitation = result.evidence.find((e) => e.type === "hesitation_bursts");
      expect(hesitation).toBeTruthy();
      expect(hesitation.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("extracts task_inactivity_freeze evidence when user is idle with an active task", () => {
      const result = adaptContextToAnxietyEvidence({
        behavior: { idleDuration: 120 },
        activity: { currentTask: "math_problem_set" },
      });
      const freeze = result.evidence.find((e) => e.type === "task_inactivity_freeze");
      expect(freeze).toBeTruthy();
      expect(freeze.description).toMatch(/inactivity/i);
    });

    it("does not fabricate personal baseline deviation if baseline is absent, keeps confidence conservative", () => {
      const result = adaptContextToAnxietyEvidence({
        behavior: { taskSwitchFrequency: 0.8 },
      });
      expect(result.behavioralDeviation.baselineAvailable).toBe(false);
      expect(result.behavioralDeviation.confidence).toBeLessThan(0.75);
    });

    it("computes accurate deviation when user personal baseline is provided", () => {
      const baseline = { taskSwitchFrequency: 0.15, correctionRate: 0.05 };
      const result = adaptContextToAnxietyEvidence(
        {
          behavior: { taskSwitchFrequency: 0.75, correctionRate: 0.35 },
        },
        baseline
      );
      expect(result.behavioralDeviation.baselineAvailable).toBe(true);
      expect(result.behavioralDeviation.value).toBeGreaterThan(0.7);
      expect(result.behavioralDeviation.confidence).toBeGreaterThan(0.8);
    });

    it("determines graduated response tiers correctly (Tier 0 for calm, Tier 3 for acute)", () => {
      const calm = adaptContextToAnxietyEvidence(scenario4_stableBaselineSnapshot);
      expect(calm.responseTier).toBe(0);

      const acute = adaptContextToAnxietyEvidence(scenario1_physiologicalSnapshot);
      expect(acute.responseTier).toBeGreaterThanOrEqual(2);
    });
  });

  describe("2. State Derivation & Evidence Attribution", () => {
    it("does not fabricate severity when not explicitly provided (severity.value === null)", () => {
      const state = deriveAnxietyState({
        contextSnapshot: scenario1_physiologicalSnapshot,
      });
      expect(state.severity.value).toBeNull();
      expect(state.severity.confidence).toBe(0.0);
      expect(state.severity.evidence[0]).toMatch(/not explicitly reported/i);
    });

    it("carries direct severity when explicitly provided", () => {
      const state = deriveAnxietyState({
        directSeverity: 8,
      });
      expect(state.severity.value).toBe(8);
      expect(state.severity.confidence).toBe(1.0);
    });

    it("seamlessly incorporates 1-tap semantic clarification without complex questionnaires", () => {
      // 1-tap Body
      const stateBody = deriveAnxietyState({
        contextSnapshot: scenario1_physiologicalSnapshot,
        semanticClarification: "body",
      });
      expect(stateBody.arousal.value).toBeGreaterThanOrEqual(0.8);
      expect(stateBody.arousal.confidence).toBeGreaterThanOrEqual(0.9);

      // 1-tap Thoughts
      const stateThoughts = deriveAnxietyState({
        contextSnapshot: scenario2_cognitiveSnapshot,
        semanticClarification: "thoughts",
      });
      expect(stateThoughts.rumination.value).toBeGreaterThanOrEqual(0.8);
      expect(stateThoughts.rumination.confidence).toBeGreaterThanOrEqual(0.9);

      // 1-tap Getting Started
      const stateStart = deriveAnxietyState({
        contextSnapshot: scenario3_avoidanceSnapshot,
        semanticClarification: "getting_started",
      });
      expect(stateStart.avoidance.value).toBeGreaterThanOrEqual(0.8);
      expect(stateStart.avoidance.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe("3. Behavioral Pattern Reasoning & Graduated Autonomy", () => {
    it("identifies STABLE_BASELINE (Tier 0 / Quiet) when passive signals are normal", () => {
      const state = deriveAnxietyState({
        contextSnapshot: scenario4_stableBaselineSnapshot,
      });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.STABLE_BASELINE);
      expect(reasoning.responseTier).toBe(0);
      expect(reasoning.needsClarification).toBe(false);
      expect(reasoning.rationale).toMatch(/normal baseline/i);
    });

    it("identifies PHYSIOLOGICAL_ESCALATION when motor restlessness & task friction are high", () => {
      const state = deriveAnxietyState({
        contextSnapshot: scenario1_physiologicalSnapshot,
      });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.PHYSIOLOGICAL_ESCALATION);
      expect(reasoning.responseTier).toBeGreaterThanOrEqual(2);
      expect(reasoning.dominantFactors).toContain("arousal");
    });

    it("identifies COGNITIVE_WORRY_LOOP when typing hesitation and correction bursts dominate", () => {
      const state = deriveAnxietyState({
        contextSnapshot: scenario2_cognitiveSnapshot,
      });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.COGNITIVE_WORRY_LOOP);
      expect(reasoning.dominantFactors).toContain("rumination");
    });

    it("identifies AVOIDANCE_DRIVEN when active task has extended inactivity freeze", () => {
      const state = deriveAnxietyState({
        contextSnapshot: scenario3_avoidanceSnapshot,
      });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.AVOIDANCE_DRIVEN);
      expect(reasoning.dominantFactors).toContain("avoidance");
    });
  });

  describe("4. Automatic Candidate Planning & Ranking", () => {
    it("automatically ranks physiological_breathing for PHYSIOLOGICAL_ESCALATION", () => {
      const state = deriveAnxietyState({ contextSnapshot: scenario1_physiologicalSnapshot });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.recommendedIntervention.id).toBe(InterventionId.PHYSIOLOGICAL_BREATHING);
      expect(plan.isMonitorOnly).toBe(false);
    });

    it("automatically ranks cognitive_reframe for COGNITIVE_WORRY_LOOP", () => {
      const state = deriveAnxietyState({ contextSnapshot: scenario2_cognitiveSnapshot });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.recommendedIntervention.id).toBe(InterventionId.COGNITIVE_REFRAME);
    });

    it("automatically ranks behavioral_micro_action for AVOIDANCE_DRIVEN", () => {
      const state = deriveAnxietyState({ contextSnapshot: scenario3_avoidanceSnapshot });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.recommendedIntervention.id).toBe(InterventionId.BEHAVIORAL_MICRO_ACTION);
    });

    it("automatically ranks NO_INTERVENTION (Monitor Only) for STABLE_BASELINE", () => {
      const state = deriveAnxietyState({ contextSnapshot: scenario4_stableBaselineSnapshot });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.recommendedIntervention.id).toBe(InterventionId.NO_INTERVENTION);
      expect(plan.isMonitorOnly).toBe(true);
    });
  });

  describe("5. 1-Tap Outcome & State-Specific Personalization", () => {
    it("evaluates 1-tap subjective responses correctly", () => {
      expect(evaluateSubjectiveResponse("better")).toEqual({ delta: 3, effectiveness: "strong_response" });
      expect(evaluateSubjectiveResponse("same")).toEqual({ delta: 0, effectiveness: "no_response" });
      expect(evaluateSubjectiveResponse("worse")).toEqual({ delta: -2, effectiveness: "adverse" });
    });

    it("applies learned bonus to matching pattern and ZERO bonus to non-matching pattern", () => {
      // Record 1-tap "better" outcome for physiological breathing
      const outcome = createOutcomeRecord({
        userId: TEST_USER,
        interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
        patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
        subjectiveOutcome: "better",
        completed: true,
        durationSeconds: 60,
      });
      recordOutcome(outcome, TEST_USER);

      // Physiological escalation check -> receives bonus
      const statePhys = deriveAnxietyState({ contextSnapshot: scenario1_physiologicalSnapshot });
      const reasoningPhys = reasonAnxietyPattern(statePhys);
      const planPhys = planInterventions(statePhys, reasoningPhys, null, TEST_USER);

      const breathingCandidate = planPhys.allCandidates.find(
        (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
      );
      expect(breathingCandidate.personalizedBonus).toBeGreaterThan(0);
      expect(breathingCandidate.personalizationNote).toMatch(/positive relief/);

      // Cognitive worry check -> receives ZERO breathing bonus
      const stateCog = deriveAnxietyState({ contextSnapshot: scenario2_cognitiveSnapshot });
      const reasoningCog = reasonAnxietyPattern(stateCog);
      const planCog = planInterventions(stateCog, reasoningCog, null, TEST_USER);

      const breathingInCog = planCog.allCandidates.find(
        (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
      );
      expect(breathingInCog.personalizedBonus).toBe(0);
      expect(breathingInCog.personalizationNote).toBeNull();
    });

    it("tracks prompt dismissals to respect user autonomy", () => {
      expect(getRecentDismissalCount(TEST_USER)).toBe(0);
      recordDismissal(TEST_USER, AnxietyPatternType.PHYSIOLOGICAL_ESCALATION);
      recordDismissal(TEST_USER, AnxietyPatternType.PHYSIOLOGICAL_ESCALATION);
      expect(getRecentDismissalCount(TEST_USER)).toBe(2);
    });
  });

  describe("6. Complete End-to-End Deterministic Demo Pipeline", () => {
    it("Scenario 1: Physiological Escalation routes from passive snapshot to breathing", () => {
      const s1 = runScenario1_PhysiologicalEscalation("demo_user_1");
      expect(s1.reasoning.pattern).toBe(AnxietyPatternType.PHYSIOLOGICAL_ESCALATION);
      expect(s1.plan.recommendedIntervention.id).toBe(InterventionId.PHYSIOLOGICAL_BREATHING);
    });

    it("Scenario 2: Cognitive Worry Loop routes from passive snapshot to reframe", () => {
      const s2 = runScenario2_CognitiveWorryLoop("demo_user_2");
      expect(s2.reasoning.pattern).toBe(AnxietyPatternType.COGNITIVE_WORRY_LOOP);
      expect(s2.plan.recommendedIntervention.id).toBe(InterventionId.COGNITIVE_REFRAME);
    });

    it("Scenario 3: Avoidance & Task Freeze routes from passive snapshot to micro-action", () => {
      const s3 = runScenario3_AvoidanceDriven("demo_user_3");
      expect(s3.reasoning.pattern).toBe(AnxietyPatternType.AVOIDANCE_DRIVEN);
      expect(s3.plan.recommendedIntervention.id).toBe(InterventionId.BEHAVIORAL_MICRO_ACTION);
    });

    it("Scenario 4: Stable Baseline routes to monitor only (Tier 0)", () => {
      const s4 = runScenario4_MonitorOnly("demo_user_4");
      expect(s4.reasoning.pattern).toBe(AnxietyPatternType.STABLE_BASELINE);
      expect(s4.plan.recommendedIntervention.id).toBe(InterventionId.NO_INTERVENTION);
      expect(s4.isMonitorOnly).toBe(true);
    });

    it("Scenario 5: Proves state-specific learning without cross-pattern contamination", () => {
      const s5 = runScenario5_PersonalizedAdaptation("demo_user_5");
      expect(s5.learningConfirmed).toBe(true);
      expect(s5.physiologicalEpisode.personalizedBonus).toBeGreaterThan(0);
      expect(s5.cognitiveEpisode.personalizedBonus).toBe(0);
    });
  });
});
