import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/featureRegistry";
import { MODULES_REGISTRY } from "@/data/modulesRegistry";
import {
  getSupportModules,
  getSupportModuleById,
} from "@/support/framework/supportModuleRegistry";

describe("ASD feature removal (sensory + meltdown)", () => {
  it("removes the sensory and meltdown feature keys", () => {
    expect(FEATURES.ASD_SENSORY).toBeUndefined();
    expect(FEATURES.ASD_MELTDOWN).toBeUndefined();
  });

  it("no longer registers sensory or meltdown support modules", () => {
    const ids = getSupportModules().map((module) => module.id);
    expect(ids).not.toContain("asd.sensory");
    expect(ids).not.toContain("asd.meltdown");
    expect(getSupportModuleById("asd.sensory")).toBeNull();
    expect(getSupportModuleById("asd.meltdown")).toBeNull();
  });

  it("no longer lists sensory or meltdown in the modules registry", () => {
    expect(MODULES_REGISTRY["asd.sensory"]).toBeUndefined();
    expect(MODULES_REGISTRY["asd.meltdown"]).toBeUndefined();
  });

  it("registers the new shared ASD practice modules", () => {
    for (const id of ["asd.emotion-decoder", "asd.emotion-quiz", "asd.routine-breakdown"]) {
      expect(getSupportModuleById(id)).not.toBeNull();
    }
  });

  it("keeps the surviving ASD features registered", () => {
    for (const feature of [
      FEATURES.ASD_ROUTINE,
      FEATURES.ASD_STORIES,
      FEATURES.ASD_EMOTION,
      FEATURES.ASD_SOCIAL_SCENARIOS,
    ]) {
      expect(MODULES_REGISTRY[feature]).toBeTruthy();
    }
  });
});
