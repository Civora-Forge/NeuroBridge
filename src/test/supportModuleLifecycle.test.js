import { beforeEach, describe, expect, it } from "vitest";
import { MemoryType, InterventionStatus, ModuleCategory } from "@/support/schemas/supportSchemas";
import {
  getCanonicalSupportModuleId,
  getSupportModuleById,
  getSupportModules,
  getSupportModulesByInterventionType,
  getSupportModulesByRoute,
} from "@/support/framework/supportModuleRegistry";
import {
  assessSupportSafety,
  checkModuleEligibility,
  rankSupportModules,
  selectIntervention,
} from "@/support/framework/interventionSelection";
import {
  deliverIntervention,
  getAllowedTransitions,
  getInterventionHistory,
  recordInterventionFeedback,
  recordInterventionOutcome,
  transitionIntervention,
} from "@/support/lifecycle/interventionLifecycle";
import { saveIntervention, saveInterventionOutcome, saveUserMemory } from "@/support/persistence/role4Store";

const USER_A = "lifecycle-user-a";
const USER_B = "lifecycle-user-b";

describe("Support module registry and selection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exposes project-relevant modules through stable lookup helpers", () => {
    const modules = getSupportModules();
    const ids = modules.map((module) => module.id);

    expect(ids).toContain("support.task_breakdown");
    expect(ids).toContain("support.gentle_activity");
    expect(ids).toContain("ocd.exposure-session");
    expect(ids).toContain("dyslexia.adaptive-reading-module");
    expect(getSupportModuleById("ocd.exposure-session").category).toBe(ModuleCategory.SPECIALIZED);
    expect(getSupportModulesByInterventionType("grounding").map((module) => module.id)).toContain("support.mood_checkin");
  });

  it("uses unique need-based IDs and preserves legacy feature aliases", () => {
    const modules = getSupportModules();
    const ids = modules.map((module) => module.id);
    const needBasedModules = modules.filter((module) => module.id.startsWith("support."));

    expect(new Set(ids).size).toBe(ids.length);
    needBasedModules.forEach((module) => {
      expect(module.moduleId).toBe(module.id);
      expect(module.id).not.toMatch(/react|route|component/i);
      expect(module.id).not.toContain("/");
      expect(module.supportedNeeds.length).toBeGreaterThan(0);
      expect(module.actions.length).toBeGreaterThan(0);
      expect(module.lifecycleEvents.length).toBeGreaterThan(0);
    });
    expect(getCanonicalSupportModuleId("adhd.task-breakdown")).toBe("support.task_breakdown");
    expect(getCanonicalSupportModuleId("depression.mvh")).toBe("support.gentle_activity");
  });

  it("maps retained ADHD and depression modules to unique registered routes", () => {
    const expectedRoutes = {
      "support.task_breakdown": "/adhd/breakdown",
      "support.focus_session": "/adhd/focus",
      "support.visual_timeline": "/adhd/timeline",
      "support.mood_checkin": "/adhd/emotion-coach",
      "support.accountability_session": "/adhd/doubling",
      "support.gentle_activity": "/depression/mvh",
      "support.grounding": "/depression/anxietydissolver",
      "support.social_connection": "/depression/social",
      "support.cognitive_reframing": "/depression/reality",
    };

    Object.entries(expectedRoutes).forEach(([moduleId, route]) => {
      expect(getSupportModuleById(moduleId)?.route).toBe(route);
      expect(getSupportModulesByRoute(route).map((module) => module.id)).toEqual([moduleId]);
    });
  });

  it("selects an eligible intervention from explicit request and context", () => {
    const result = selectIntervention({
      userId: USER_A,
      explicitRequest: "I feel overwhelmed and need grounding",
      currentContext: {
        mood: { primaryMood: "anxious" },
        emotion: { label: "overwhelmed" },
      },
      userProfile: { role: "user", disorders: ["anxiety"] },
    });

    expect(result.selectedModule.id).toBe("support.mood_checkin");
    expect(result.fallbackUsed).toBe(false);
    expect(result.reasonCodes).toContain("explicit_request_match");
  });

  it("uses preferences and previous outcomes when ranking modules", () => {
    saveUserMemory(USER_A, {
      id: "pref-reading",
      userId: USER_A,
      type: MemoryType.PREFERENCE,
      key: "reading_accessibility",
      value: { preferred: true },
    });
    saveInterventionOutcome(USER_A, {
      id: "reading-success",
      userId: USER_A,
      interventionId: "old-reading",
      moduleId: "dyslexia.adaptive-reading-module",
      interventionType: "reading_accessibility",
      category: ModuleCategory.LEARNING,
      status: InterventionStatus.COMPLETED,
      completed: true,
      rating: 5,
    });

    const ranked = rankSupportModules({
      userId: USER_A,
      explicitRequest: "Reading is tiring today",
      userProfile: { role: "user", disorders: ["dyslexia"] },
    });

    expect(ranked[0].module.id).toBe("dyslexia.adaptive-reading-module");
    expect(ranked[0].eligibility.reasonCodes).toContain("user_preference_match");
    expect(ranked[0].eligibility.reasonCodes).toContain("positive_previous_outcomes");
  });

  it("blocks crisis language instead of delivering an automated module", () => {
    const safety = assessSupportSafety({ explicitRequest: "I might kill myself" });
    const result = selectIntervention({ userId: USER_A, explicitRequest: "I might kill myself" });

    expect(safety.allowed).toBe(false);
    expect(safety.reasonCodes).toContain("crisis_language_detected");
    expect(result.selectedModule).toBeNull();
    expect(result.reasonCodes).toContain("no_safe_module_available");
  });

  it("enforces repetition limits for recent interventions", () => {
    const module = getSupportModuleById("ocd.exposure-session");
    saveIntervention(USER_A, {
      id: "repeat-1",
      userId: USER_A,
      moduleId: module.id,
      interventionType: module.interventionTypes[0],
      category: module.category,
      title: module.title,
      status: InterventionStatus.SHOWN,
    });
    saveIntervention(USER_A, {
      id: "repeat-2",
      userId: USER_A,
      moduleId: module.id,
      interventionType: module.interventionTypes[0],
      category: module.category,
      title: module.title,
      status: InterventionStatus.SHOWN,
    });

    const eligibility = checkModuleEligibility(module, {
      userId: USER_A,
      explicitRequest: "exposure practice",
      userProfile: { role: "user", disorders: ["ocd"] },
    });

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.blockedReasons).toContain("repetition_limit_reached");
  });
});

describe("Intervention lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("delivers an intervention and records valid state transitions", () => {
    const delivered = deliverIntervention({
      userId: USER_A,
      explicitRequest: "I need help starting this task",
      currentContext: { task: { intent: "complete_task" } },
      userProfile: { role: "user", disorders: ["adhd"] },
    });

    expect(delivered.status).toBe("delivered");
    expect(delivered.intervention.status).toBe(InterventionStatus.SHOWN);
    expect(delivered.delivery.route).toBe("/adhd/breakdown");

    const started = transitionIntervention({
      userId: USER_A,
      interventionId: delivered.intervention.id,
      toStatus: InterventionStatus.STARTED,
      reason: "user_started",
    });
    expect(started.intervention.status).toBe(InterventionStatus.STARTED);
    expect(getAllowedTransitions(InterventionStatus.STARTED)).toContain(InterventionStatus.COMPLETED);

    const completed = transitionIntervention({
      userId: USER_A,
      interventionId: delivered.intervention.id,
      toStatus: InterventionStatus.COMPLETED,
      reason: "steps_completed",
    });
    expect(completed.intervention.status).toBe(InterventionStatus.COMPLETED);

    const outcome = recordInterventionOutcome({
      userId: USER_A,
      interventionId: delivered.intervention.id,
      status: InterventionStatus.COMPLETED,
      completed: true,
      durationMs: 300000,
      metrics: { steps_created: 4, steps_completed: 4 },
    });
    expect(outcome.completed).toBe(true);

    const feedback = recordInterventionFeedback({
      userId: USER_A,
      interventionId: delivered.intervention.id,
      rating: 5,
      userFeedback: "The steps were manageable.",
    });
    expect(feedback.intervention.status).toBe(InterventionStatus.RATED);
    expect(feedback.outcome.rating).toBe(5);

    const history = getInterventionHistory(USER_A);
    expect(history).toHaveLength(1);
    expect(history[0].lifecycleEvents.map((event) => event.toStatus)).toEqual([
      InterventionStatus.RATED,
      InterventionStatus.COMPLETED,
      InterventionStatus.STARTED,
      InterventionStatus.SHOWN,
    ]);
    expect(history[0].outcomes).toHaveLength(2);
  });

  it("prevents invalid state transitions", () => {
    const delivered = deliverIntervention({
      userId: USER_A,
      explicitRequest: "focus",
      userProfile: { role: "user", disorders: ["adhd"] },
    });

    expect(() => transitionIntervention({
      userId: USER_A,
      interventionId: delivered.intervention.id,
      toStatus: InterventionStatus.RATED,
    })).toThrow(/Invalid intervention transition/);
  });

  it("prevents cross-user access to interventions, outcomes, and history", () => {
    const delivered = deliverIntervention({
      userId: USER_A,
      explicitRequest: "math calm mode",
      userProfile: { role: "user", disorders: ["dyscalculia"] },
    });

    expect(() => transitionIntervention({
      userId: USER_B,
      interventionId: delivered.intervention.id,
      toStatus: InterventionStatus.STARTED,
    })).toThrow(/Intervention not found for user/);

    expect(() => recordInterventionOutcome({
      userId: USER_B,
      interventionId: delivered.intervention.id,
      status: InterventionStatus.COMPLETED,
    })).toThrow(/Intervention not found for user/);

    expect(getInterventionHistory(USER_B)).toEqual([]);
  });

  it("returns a structured blocked delivery result for unsafe requests", () => {
    const result = deliverIntervention({
      userId: USER_A,
      explicitRequest: "Can you diagnose me and prescribe medication?",
      userProfile: { role: "user" },
    });

    expect(result.status).toBe("delivered");
    expect(result.delivery.safetyMessage).toMatch(/cannot diagnose/);

    const crisis = deliverIntervention({
      userId: USER_A,
      explicitRequest: "I want to self harm",
      userProfile: { role: "user" },
    });
    expect(crisis.status).toBe("blocked");
    expect(crisis.reasonCodes).toContain("crisis_language_detected");
  });
});

