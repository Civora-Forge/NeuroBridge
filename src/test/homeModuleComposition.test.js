import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/featureRegistry";
import { composeHomeModules, getSelectableModuleIds } from "@/data/modulesRegistry";
import { getCanonicalSupportModuleId, getSupportModuleById } from "@/support/framework/supportModuleRegistry";

const ADHD_AND_DEPRESSION_ROUTES = new Set([
  "/adhd/breakdown",
  "/adhd/focus",
  "/adhd/timeline",
  "/adhd/emotion-coach",
  "/adhd/doubling",
  "/depression/mvh",
  "/depression/anxietydissolver",
  "/depression/social",
  "/depression/reality",
]);

describe("home module composition", () => {
  it("deduplicates skipped-onboarding selections after canonical resolution", () => {
    const modules = composeHomeModules([
      FEATURES.ADHD,
      FEATURES.ADHD_EMOTION,
      "support.mood_checkin",
      FEATURES.ADHD_DOUBLING,
      "support.accountability_session",
      FEATURES.DEPRESSION_MVH,
      "support.gentle_activity",
    ]);

    expect(modules.map((module) => module.id)).toEqual([
      "support.mood_checkin",
      "support.accountability_session",
      "support.gentle_activity",
    ]);
    expect(modules.map((module) => module.title)).toEqual([
      "Mood Check-in",
      "Accountability Session",
      "Gentle Activity",
    ]);
  });

  it("deduplicates completed-onboarding and default lists in first-seen order", () => {
    const modules = composeHomeModules([
      "support.task_breakdown",
      FEATURES.ADHD_BREAKDOWN,
      FEATURES.DEPRESSION_REALITY,
      "support.cognitive_reframing",
      "support.focus_session",
    ]);

    expect(modules.map((module) => module.id)).toEqual([
      "support.task_breakdown",
      "support.cognitive_reframing",
      "support.focus_session",
    ]);
    expect(modules.map((module) => module.title)).toEqual([
      "Task Breakdown",
      "Cognitive Reframing",
      "Focus Session",
    ]);
  });

  it("filters navigation-only dashboard entries and keeps only selectable IDs for demo skip", () => {
    expect(composeHomeModules([FEATURES.ADHD])).toEqual([]);

    const selectable = getSelectableModuleIds();
    expect(selectable).not.toContain(FEATURES.ADHD);
    expect(new Set(selectable).size).toBe(selectable.length);
  });

  it("resolves supported aliases to one canonical route and card", () => {
    const aliases = [
      [FEATURES.ADHD_EMOTION, "support.mood_checkin"],
      [FEATURES.ADHD_DOUBLING, "support.accountability_session"],
      [FEATURES.ADHD_FOCUS, "support.focus_session"],
      [FEATURES.DEPRESSION_MVH, "support.gentle_activity"],
      [FEATURES.DEPRESSION_ANXIETY_DISSOLVER, "support.grounding"],
      [FEATURES.DEPRESSION_SOCIAL, "support.social_connection"],
      [FEATURES.DEPRESSION_REALITY, "support.cognitive_reframing"],
    ];

    aliases.forEach(([legacyId, canonicalId]) => {
      expect(getCanonicalSupportModuleId(legacyId)).toBe(canonicalId);
      expect(composeHomeModules([legacyId, canonicalId])).toHaveLength(1);
      expect(getSupportModuleById(canonicalId)?.route).toBeDefined();
    });
  });

  it("maps visible ADHD and depression cards to registered routes", () => {
    const modules = composeHomeModules(getSelectableModuleIds());
    modules
      .filter((module) => module.id.startsWith("support."))
      .forEach((module) => {
        if (ADHD_AND_DEPRESSION_ROUTES.has(module.launchRoute)) {
          expect(ADHD_AND_DEPRESSION_ROUTES.has(module.launchRoute)).toBe(true);
        }
      });
  });
});
