import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/featureRegistry";
import { MODULES_REGISTRY, CHALLENGE_MODULE_MAP } from "@/data/modulesRegistry";
import {
  getSupportModules,
  getSupportModuleById,
} from "@/support/framework/supportModuleRegistry";

describe("ASD feature surface", () => {
  it("registers the final four ASD capabilities", () => {
    for (const feature of [
      FEATURES.ASD_STORIES,
      FEATURES.ASD_EMOTION,
      FEATURES.ASD_SOCIAL_SCENARIOS,
      FEATURES.COMMUNICATION,
    ]) {
      expect(MODULES_REGISTRY[feature]).toBeTruthy();
    }
  });

  it("no longer registers the removed routine, quiz, sensory or meltdown modules", () => {
    const ids = getSupportModules().map((module) => module.id);
    for (const removed of [
      "asd.routine-breakdown",
      "asd.emotion-quiz",
      "asd.sensory",
      "asd.meltdown",
    ]) {
      expect(ids).not.toContain(removed);
      expect(getSupportModuleById(removed)).toBeNull();
    }
  });

  it("keeps the shared ASD practice modules registered", () => {
    for (const id of ["asd.emotion-decoder", "asd.social-scenarios"]) {
      expect(getSupportModuleById(id)).not.toBeNull();
    }
  });

  it("no longer lists removed keys in the modules registry", () => {
    expect(MODULES_REGISTRY[FEATURES.ASD_ROUTINE]).toBeUndefined();
    expect(MODULES_REGISTRY["asd.sensory"]).toBeUndefined();
    expect(MODULES_REGISTRY["asd.meltdown"]).toBeUndefined();
  });

  it("maps the ASD challenge surface to the four surviving modules", () => {
    expect(CHALLENGE_MODULE_MAP.asd).toEqual([
      FEATURES.ASD_STORIES,
      FEATURES.ASD_EMOTION,
      FEATURES.ASD_SOCIAL_SCENARIOS,
      FEATURES.COMMUNICATION,
    ]);
  });
});
