import { describe, expect, it, beforeEach } from "vitest";
import {
  EpisodeStatus,
  AnxietyPatternType,
  InterventionId,
  InterventionCategory,
  CORE_CBT_PATTERNS,
} from "@/components/anxiety/domain/anxietyTypes";
import {
  deriveAnxietyState,
  deriveEscalation,
  tokenizeText,
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
  evaluateEffectiveness,
} from "@/components/anxiety/adaptation/anxietyOutcomeModel";
import {
  recordOutcome,
  getPersonalizedModifier,
  clearUserOutcomes,
  loadUserOutcomes,
} from "@/components/anxiety/adaptation/anxietyPersonalization";
import {
  runScenario1_PhysiologicalEscalation,
  runScenario2_CognitiveWorryLoop,
  runScenario3_PersonalizedAdaptation,
  runScenario4_MonitorOnly,
} from "@/components/anxiety/demo/anxietyDemoScenarios";

describe("Adaptive Anxiety Engine Domain & Architecture", () => {
  const TEST_USER = "test_anxiety_user_1";

  beforeEach(() => {
    clearUserOutcomes(TEST_USER);
  });

  describe("1. Evidence-Backed State Derivation", () => {
    it("derives severity with confidence 1.0 and explicit user evidence", () => {
      const state = deriveAnxietyState({ severity: 8 });
      expect(state.severity.value).toBe(8);
      expect(state.severity.confidence).toBe(1.0);
      expect(state.severity.evidence).toContain("Direct user rating: 8/10");
    });

    it("clamps severity cleanly between 0 and 10", () => {
      const stateLow = deriveAnxietyState({ severity: -5 });
      const stateHigh = deriveAnxietyState({ severity: 15 });
      expect(stateLow.severity.value).toBe(0);
      expect(stateHigh.severity.value).toBe(10);
    });

    it("normalizes temporal escalation velocity based on magnitude and elapsed time", () => {
      const now = new Date();
      const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

      // Fast jump: +4 in 10 minutes
      const fastEscalation = deriveEscalation(8, now.toISOString(), [
        { severity: 4, level: 4, loggedAt: tenMinsAgo },
      ]);
      expect(fastEscalation.value).toBeGreaterThanOrEqual(0.7);
      expect(fastEscalation.confidence).toBeGreaterThan(0.6);
      expect(fastEscalation.evidence[0]).toMatch(/Severity increased by \+4 points/);

      // Slow jump: +4 in 4 hours
      const slowEscalation = deriveEscalation(8, now.toISOString(), [
        { severity: 4, level: 4, loggedAt: fourHoursAgo },
      ]);
      expect(slowEscalation.value).toBeLessThan(0.45);

      // Decreasing or stable: 8 -> 4
      const decreasing = deriveEscalation(4, now.toISOString(), [
        { severity: 8, level: 8, loggedAt: tenMinsAgo },
      ]);
      expect(decreasing.value).toBe(0.0);
    });

    it("derives physiological arousal from physical tags and high severity", () => {
      const state = deriveAnxietyState({
        severity: 8,
        selectedTags: ["racing_heart", "tension_shaking"],
        triggerText: "Pulse is racing and hands are shaking",
      });

      expect(state.arousal.value).toBeGreaterThanOrEqual(0.7);
      expect(state.arousal.confidence).toBeGreaterThanOrEqual(0.7);
      expect(state.arousal.evidence.length).toBeGreaterThan(0);
      expect(state.arousal.evidence.some((e) => e.includes("Physical tension"))).toBe(true);
    });

    it("derives rumination from cognitive tags and worry keywords", () => {
      const state = deriveAnxietyState({
        severity: 6,
        selectedTags: ["worry_loop"],
        triggerText: "What if I fail and ruin the entire project? Can't stop thinking about it.",
      });

      expect(state.rumination.value).toBeGreaterThanOrEqual(0.6);
      expect(state.rumination.confidence).toBeGreaterThanOrEqual(0.6);
      expect(state.rumination.evidence.some((e) => e.includes("Rumination-oriented keywords"))).toBe(true);
    });

    it("derives avoidance from behavioral tags and procrastination keywords", () => {
      const state = deriveAnxietyState({
        severity: 5,
        selectedTags: ["procrastination", "task_paralysis"],
        triggerText: "Avoiding opening my work laptop and putting off the assignment",
      });

      expect(state.avoidance.value).toBeGreaterThanOrEqual(0.7);
      expect(state.avoidance.evidence.some((e) => e.includes("Avoidance"))).toBe(true);
    });
  });

  describe("2. Behavioral Pattern Reasoning", () => {
    it("identifies STABLE_BASELINE when distress is low (<=3) and non-escalating", () => {
      const state = deriveAnxietyState({ severity: 2 });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.STABLE_BASELINE);
      expect(reasoning.urgency).toBe("low");
      expect(reasoning.rationale).toMatch(/low, stable baseline/i);
    });

    it("identifies PHYSIOLOGICAL_ESCALATION when arousal is elevated", () => {
      const state = deriveAnxietyState({
        severity: 8,
        selectedTags: ["racing_heart", "short_breath"],
      });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.PHYSIOLOGICAL_ESCALATION);
      expect(reasoning.urgency).toBe("critical");
      expect(reasoning.dominantFactors).toContain("arousal");
    });

    it("identifies COGNITIVE_WORRY_LOOP when rumination is high and arousal is sub-acute", () => {
      const state = deriveAnxietyState({
        severity: 6,
        selectedTags: ["worry_loop", "catastrophizing"],
        triggerText: "What if everything fails and I am judging myself",
      });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.COGNITIVE_WORRY_LOOP);
      expect(reasoning.dominantFactors).toContain("rumination");
      expect(reasoning.rationale).toMatch(/repetitive worry loops/i);
    });

    it("identifies AVOIDANCE_DRIVEN when avoidance signals dominate", () => {
      const state = deriveAnxietyState({
        severity: 5,
        selectedTags: ["procrastination", "avoiding_situation"],
      });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.AVOIDANCE_DRIVEN);
      expect(reasoning.dominantFactors).toContain("avoidance");
    });

    it("identifies SENSORY_OVERWHELM when environmental sensory overload dominates", () => {
      const state = deriveAnxietyState({
        severity: 6,
        selectedTags: ["loud_environment", "sensory_overload"],
      });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.SENSORY_OVERWHELM);
      expect(reasoning.dominantFactors).toContain("sensory_overload");
    });

    it("defaults to GENERAL_ANXIETY when evidence is ambiguous or non-dominant", () => {
      const state = deriveAnxietyState({ severity: 5 });
      const reasoning = reasonAnxietyPattern(state);

      expect(reasoning.pattern).toBe(AnxietyPatternType.GENERAL_ANXIETY);
    });
  });

  describe("3. Candidate Planning & Ranking", () => {
    it("ranks NO_INTERVENTION (Monitor Only) #1 for STABLE_BASELINE states", () => {
      const state = deriveAnxietyState({ severity: 2 });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.isMonitorOnly).toBe(true);
      expect(plan.recommendedIntervention.id).toBe(InterventionId.NO_INTERVENTION);
      expect(plan.recommendedIntervention.category).toBe(InterventionCategory.MONITOR);
    });

    it("ranks physiological_breathing #1 for PHYSIOLOGICAL_ESCALATION states", () => {
      const state = deriveAnxietyState({
        severity: 8,
        selectedTags: ["racing_heart"],
      });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.recommendedIntervention.id).toBe(InterventionId.PHYSIOLOGICAL_BREATHING);
      expect(plan.recommendedIntervention.score).toBeGreaterThanOrEqual(0.7);
    });

    it("ranks cognitive_reframe #1 for COGNITIVE_WORRY_LOOP states", () => {
      const state = deriveAnxietyState({
        severity: 6,
        selectedTags: ["worry_loop", "catastrophizing"],
      });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.recommendedIntervention.id).toBe(InterventionId.COGNITIVE_REFRAME);
      expect(plan.recommendedIntervention.score).toBeGreaterThan(0.7);
    });

    it("ranks behavioral_micro_action #1 for AVOIDANCE_DRIVEN states", () => {
      const state = deriveAnxietyState({
        severity: 5,
        selectedTags: ["procrastination", "task_paralysis"],
      });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.recommendedIntervention.id).toBe(InterventionId.BEHAVIORAL_MICRO_ACTION);
    });

    it("ranks physiological_grounding #1 for SENSORY_OVERWHELM states", () => {
      const state = deriveAnxietyState({
        severity: 6,
        selectedTags: ["loud_environment", "sensory_overload"],
      });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      expect(plan.recommendedIntervention.id).toBe(InterventionId.PHYSIOLOGICAL_GROUNDING);
    });

    it("applies contraindication penalty to cognitive reframing during acute panic (arousal >= 0.85)", () => {
      const state = deriveAnxietyState({
        severity: 10,
        selectedTags: ["racing_heart", "short_breath", "tension_shaking"],
      });
      const reasoning = reasonAnxietyPattern(state);
      const plan = planInterventions(state, reasoning, null, TEST_USER);

      const reframeCandidate = plan.allCandidates.find(
        (c) => c.id === InterventionId.COGNITIVE_REFRAME
      );
      expect(reframeCandidate.score).toBeLessThan(0.4);
    });
  });

  describe("4. Outcome Quality & State-Specific Personalization", () => {
    it("evaluates outcome response tiers correctly", () => {
      expect(evaluateEffectiveness(4, true, false)).toBe("strong_response");
      expect(evaluateEffectiveness(2, true, false)).toBe("moderate_response");
      expect(evaluateEffectiveness(0, true, false)).toBe("no_response");
      expect(evaluateEffectiveness(-2, true, false)).toBe("adverse");
      expect(evaluateEffectiveness(1, false, true)).toBe("no_response");
    });

    it("records outcome and applies state-specific learned bonus to matching pattern", () => {
      // 1. Initial physiological state
      const statePhys = deriveAnxietyState({
        severity: 8,
        selectedTags: ["racing_heart"],
      });
      const reasoningPhys = reasonAnxietyPattern(statePhys);

      const initialPlan = planInterventions(statePhys, reasoningPhys, null, TEST_USER);
      const initialBreathingScore = initialPlan.allCandidates.find(
        (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
      ).score;

      // 2. Record 2 successful breathing outcomes specifically for PHYSIOLOGICAL_ESCALATION
      const outcome1 = createOutcomeRecord({
        userId: TEST_USER,
        interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
        patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
        preSeverity: 8,
        postSeverity: 4,
        completed: true,
        durationSeconds: 120,
      });
      const outcome2 = createOutcomeRecord({
        userId: TEST_USER,
        interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
        patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
        preSeverity: 7,
        postSeverity: 3,
        completed: true,
        durationSeconds: 120,
      });

      recordOutcome(outcome1, TEST_USER);
      recordOutcome(outcome2, TEST_USER);

      // 3. Re-plan for a similar PHYSIOLOGICAL_ESCALATION episode
      const newPlanPhys = planInterventions(statePhys, reasoningPhys, null, TEST_USER);
      const updatedBreathingCandidate = newPlanPhys.allCandidates.find(
        (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
      );

      expect(updatedBreathingCandidate.personalizedBonus).toBeGreaterThan(0);
      expect(updatedBreathingCandidate.score).toBeGreaterThan(initialBreathingScore);
      expect(updatedBreathingCandidate.personalizationNote).toMatch(/Previously produced an average reduction/);

      // 4. Verify ZERO cross-pattern leakage to COGNITIVE_WORRY_LOOP
      const stateCog = deriveAnxietyState({
        severity: 6,
        selectedTags: ["worry_loop"],
      });
      const reasoningCog = reasonAnxietyPattern(stateCog);
      const planCog = planInterventions(stateCog, reasoningCog, null, TEST_USER);

      const breathingInCog = planCog.allCandidates.find(
        (c) => c.id === InterventionId.PHYSIOLOGICAL_BREATHING
      );
      expect(breathingInCog.personalizedBonus).toBe(0);
      expect(breathingInCog.personalizationNote).toBeNull();
    });

    it("applies penalty when an intervention repeatedly fails or is abandoned for a pattern", () => {
      // Record 2 abandonments with no reduction
      const outcomeBad1 = createOutcomeRecord({
        userId: TEST_USER,
        interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
        patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
        preSeverity: 8,
        postSeverity: 8,
        completed: false,
        abandoned: true,
      });
      const outcomeBad2 = createOutcomeRecord({
        userId: TEST_USER,
        interventionId: InterventionId.PHYSIOLOGICAL_BREATHING,
        patternType: AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
        preSeverity: 7,
        postSeverity: 7,
        completed: false,
        abandoned: true,
      });

      recordOutcome(outcomeBad1, TEST_USER);
      recordOutcome(outcomeBad2, TEST_USER);

      const mod = getPersonalizedModifier(
        InterventionId.PHYSIOLOGICAL_BREATHING,
        AnxietyPatternType.PHYSIOLOGICAL_ESCALATION,
        TEST_USER
      );
      expect(mod.penalty).toBeGreaterThan(0);
      expect(mod.rationale).toMatch(/low completion or minimal relief/);
    });
  });

  describe("5. Episode Lifecycle & Phase Transitions", () => {
    it("transitions from BASELINE to ACTIVE and RECOVERING", () => {
      const stateBaseline = deriveAnxietyState({ severity: 2 });
      const ep1 = createEpisode(stateBaseline);
      expect(ep1.status).toBe(EpisodeStatus.BASELINE);

      // Rising severity -> ACTIVE
      const stateActive = deriveAnxietyState({ severity: 7 });
      const ep2 = updateEpisode(ep1, stateActive);
      expect(ep2.status).toBe(EpisodeStatus.ACTIVE);
      expect(ep2.peakSeverity).toBe(7);

      // Successful intervention -> RECOVERING
      const ep3 = updateEpisode(ep2, deriveAnxietyState({ severity: 4 }), {
        completed: true,
        delta: 3,
        postSeverity: 4,
      });
      expect(ep3.status).toBe(EpisodeStatus.RECOVERING);

      // Return to low baseline -> RESOLVED
      const ep4 = updateEpisode(ep3, deriveAnxietyState({ severity: 2 }), {
        completed: true,
        delta: 2,
        postSeverity: 2,
      });
      expect(ep4.status).toBe(EpisodeStatus.RESOLVED);
    });
  });

  describe("6. Isolated Deterministic Demo Scenarios", () => {
    it("Scenario 1 executes production pipeline for physiological escalation", () => {
      const s1 = runScenario1_PhysiologicalEscalation("demo_evaluator");
      expect(s1.reasoning.pattern).toBe(AnxietyPatternType.PHYSIOLOGICAL_ESCALATION);
      expect(s1.plan.recommendedIntervention.id).toBe(InterventionId.PHYSIOLOGICAL_BREATHING);
    });

    it("Scenario 2 executes production pipeline for cognitive worry loop", () => {
      const s2 = runScenario2_CognitiveWorryLoop("demo_evaluator");
      expect(s2.reasoning.pattern).toBe(AnxietyPatternType.COGNITIVE_WORRY_LOOP);
      expect(s2.plan.recommendedIntervention.id).toBe(InterventionId.COGNITIVE_REFRAME);
    });

    it("Scenario 3 proves state-specific adaptation without cross-pattern contamination", () => {
      const s3 = runScenario3_PersonalizedAdaptation("demo_evaluator");
      expect(s3.learningConfirmed).toBe(true);
      expect(s3.physiologicalEpisode.personalizedBonus).toBeGreaterThan(0);
      expect(s3.cognitiveEpisode.personalizedBonus).toBe(0);
    });

    it("Scenario 4 executes production pipeline for stable baseline monitor only", () => {
      const s4 = runScenario4_MonitorOnly("demo_evaluator");
      expect(s4.reasoning.pattern).toBe(AnxietyPatternType.STABLE_BASELINE);
      expect(s4.plan.recommendedIntervention.id).toBe(InterventionId.NO_INTERVENTION);
      expect(s4.isMonitorOnly).toBe(true);
    });
  });
});
