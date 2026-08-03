import { describe, it, expect } from "vitest";
import {
  FEATURES,
  FEATURE_REGISTRY,
  resolveEnabledFeatures,
} from "@/lib/featureRegistry";
import { DISORDERS } from "@/lib/disorders";
import {
  SUPPORT_MODULE_LOOKUP,
  SUPPORT_MODULE_REGISTRY,
  getModulePath,
} from "@backend/adaptive/reasoning/disorderFeatureRegistry";
import { deriveDisordersFromModules } from "@backend/adaptive/reasoning/interventionRanking";

describe("Phase 6 registry review — ownership boundaries", () => {
  it("keeps canonical feature IDs unchanged in lib/featureRegistry", () => {
    expect(FEATURES.OCD).toBe("ocd");
    expect(FEATURES.ADHD).toBe("adhd");
    expect(FEATURES.DYSLEXIA).toBe("dyslexia");
    expect(FEATURES.DYSLEXIA_READER).toBe("dyslexia.reader-mode");
    expect(FEATURE_REGISTRY[FEATURES.OCD].label).toBe("OCD Support");
  });

  it("keeps disorderFeatureRegistry single-sourced on canonical FEATURES IDs", () => {
    const featureValues = new Set(Object.values(FEATURES));
    expect(SUPPORT_MODULE_REGISTRY.length).toBeGreaterThan(0);
    for (const module of SUPPORT_MODULE_REGISTRY) {
      expect(featureValues.has(module.id)).toBe(true);
    }
  });

  it("keeps lib/featureRegistry as the access authority", () => {
    const enabled = resolveEnabledFeatures({ disorders: [DISORDERS.ADHD] });
    expect(enabled.has(FEATURES.ADHD)).toBe(true);
    expect(enabled.has(FEATURES.ADHD_FOCUS)).toBe(true);
    expect(resolveEnabledFeatures({ disorders: [DISORDERS.OCD] }).has(FEATURES.OCD)).toBe(true);
  });

  it("keeps disorder-specific configuration available for scoring", () => {
    const ocdModule = SUPPORT_MODULE_LOOKUP[FEATURES.OCD];
    expect(ocdModule).toBeDefined();
    expect(ocdModule.tags).toContain("avoidance");
    expect(ocdModule.disorders).toContain(DISORDERS.OCD);
    expect(ocdModule.path).toBe("/ocd");
  });

  it("keeps routing behavior unchanged via getModulePath", () => {
    expect(getModulePath(FEATURES.ADHD)).toBe("/adhd");
    expect(getModulePath(FEATURES.DYSCALCULIA)).toBe("/dyscalculia");
    expect(getModulePath("unknown.module")).toBe("/");
  });

  it("keeps personalization disorder inference working from module config", () => {
    const adhdModule = SUPPORT_MODULE_LOOKUP[FEATURES.ADHD];
    const disorders = deriveDisordersFromModules([adhdModule]);
    expect(disorders).toContain(DISORDERS.ADHD);
  });

  it("preserves the documented boundary: identity/access vs disorder configuration", () => {
    const accessEntry = FEATURE_REGISTRY[FEATURES.OCD];
    const configEntry = SUPPORT_MODULE_LOOKUP[FEATURES.OCD];

    expect(accessEntry).not.toBe(configEntry);
    expect(accessEntry.disorders).toEqual([DISORDERS.OCD]);
    expect(configEntry.title).toBe("Exposure Practice");
    expect(configEntry).toHaveProperty("tags");
    expect(configEntry).toHaveProperty("path");
  });
});
