import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMemory,
  getMemorySummary,
  getPatterns,
  getPreference,
  getStrategyEffectiveness,
  getUserStrategyEffectiveness,
  recordStrategyOutcome,
  recordUserStrategyOutcome,
  storePattern,
  storePreference,
} from "@/adaptive/memory/memorySystem";
import { buildRole4Signals } from "@backend/adaptive/engine/role4Signals";

const USER = "phase6-user";

describe("Phase 6 memory helper deprecation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("emits a deprecation warning pointing to the Role 4-backed flow", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    getStrategyEffectiveness("grounding");
    storePreference("pace", "slow");

    expect(warn).toHaveBeenCalled();
    const messages = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(messages).toContain("deprecated");
    expect(messages).toContain("getUserStrategyEffectiveness(userId, interventionType)");
    expect(messages).toContain("storeUserMemory");
    warn.mockRestore();
  });

  it("keeps legacy global helpers functional for backward compatibility", () => {
    storePreference("pace", "slow");
    expect(getPreference("pace")).toBe("slow");

    recordStrategyOutcome("grounding", true, { moduleId: "anxiety" });
    recordStrategyOutcome("grounding", false, { moduleId: "anxiety" });
    expect(getStrategyEffectiveness("grounding")).toEqual({ effective: 1, total: 2, rate: 0.5 });

    storePattern("evening_focus", { strength: "high" });
    expect(getPatterns("evening_focus")).toHaveLength(1);

    expect(getMemorySummary()).toEqual({ preferences: 1, strategies: 2, patternTypes: 1 });

    clearMemory();
    expect(getMemorySummary()).toEqual({ preferences: 0, strategies: 0, patternTypes: 0 });
  });

  it("does not wire legacy global strategy history into tier-9 signals", () => {
    recordStrategyOutcome("grounding", true, { moduleId: "anxiety" });

    const signals = buildRole4Signals(USER);

    expect(signals.strategyEffectiveness).toBeUndefined();
  });

  it("keeps the user-scoped Role 4 flow functional and warning-free", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    recordUserStrategyOutcome(USER, "grounding", true, { moduleId: "anxiety" });
    recordUserStrategyOutcome(USER, "grounding", false, { moduleId: "anxiety" });

    expect(getUserStrategyEffectiveness(USER, "grounding")).toEqual({
      effective: 1,
      total: 2,
      rate: 0.5,
    });
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("deprecated"));
    warn.mockRestore();
  });
});
