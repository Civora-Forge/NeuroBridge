import { describe, it, expect } from "vitest";
import {
  SUPPORTED_UI_MODES,
  MODE_CONFIGURATIONS,
  buildConfig,
  adaptUI,
  adaptUIAction,
  revertUIAction,
  getUIClasses,
} from "../uiAdapter.js";
import { AdaptationActionType, AdaptationDimension } from "@/support/schemas/supportSchemas";

// ─────────────────────────────────────────────────────────────────
//  Fixtures
// ─────────────────────────────────────────────────────────────────

function uiAction(mode, overrides = {}) {
  return {
    actionId: "action_" + mode,
    type: AdaptationActionType.MODIFY,
    target: AdaptationDimension.UI,
    parameters: { mode },
    tier: 8,
    confidence: 0.8,
    reversible: true,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────
//  1. Supported modes succeed with a structured result
// ─────────────────────────────────────────────────────────────────

describe("adaptUIAction — supported modes", () => {
  it.each(Object.keys(MODE_CONFIGURATIONS))("executes mode '%s'", (mode) => {
    const result = adaptUIAction(uiAction(mode));

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.actionId).toBe("action_" + mode);
    expect(result.mode).toBe(mode);
    expect(result.config).toEqual(MODE_CONFIGURATIONS[mode]);
    expect(result).not.toHaveProperty("error");
  });

  it("returns a fresh config copy that callers may mutate", () => {
    const result = adaptUIAction(uiAction("focus"));
    result.config.complexity = 0;
    result.config.colors.contrast = "low";
    expect(MODE_CONFIGURATIONS.focus.complexity).toBe(0.5);
    expect(MODE_CONFIGURATIONS.focus.colors).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────
//  2. Unsupported modes fail safely with an explicit error
// ─────────────────────────────────────────────────────────────────

describe("adaptUIAction — fail-safe behavior", () => {
  it("rejects an unknown mode with a structured error", () => {
    const result = adaptUIAction(uiAction("party_mode"));

    expect(result.ok).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.error).toContain("party_mode");
  });

  it("rejects a missing mode", () => {
    const result = adaptUIAction({ ...uiAction("focus"), parameters: {} });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("parameters.mode");
  });

  it("rejects an empty/whitespace mode", () => {
    const result = adaptUIAction(uiAction("   "));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("parameters.mode");
  });

  it("rejects a non-object action", () => {
    for (const bad of [null, undefined, "focus"]) {
      const result = adaptUIAction(bad);
      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    }
  });

  it("rejects actions whose target is not UI", () => {
    const result = adaptUIAction({ ...uiAction("focus"), target: "CONTENT" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not a UI action");
  });

  it("rejects actions whose type is not MODIFY", () => {
    const result = adaptUIAction({ ...uiAction("focus"), type: "TOGGLE" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("unsupported UI action type");
  });
});

// ─────────────────────────────────────────────────────────────────
//  3–4. No UserState mutation, no persistence, no network
// ─────────────────────────────────────────────────────────────────

describe("adaptUIAction — side-effect free", () => {
  it("does not mutate or read-require userState", () => {
    const userState = {
      emotionalState: "overwhelmed",
      cognitiveLoad: "high",
      nested: { a: 1 },
    };
    const snapshot = JSON.parse(JSON.stringify(userState));
    const frozen = Object.freeze(userState);

    expect(() => adaptUIAction(uiAction("focus"), frozen)).not.toThrow();
    expect(userState).toEqual(snapshot);
  });

  it("returns only the documented in-memory surface (no persistence/network handles)", () => {
    const result = adaptUIAction(uiAction("focus"));
    expect(Object.keys(result).sort()).toEqual([
      "actionId",
      "applied",
      "config",
      "mode",
      "ok",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────
//  5. Revert behavior
// ─────────────────────────────────────────────────────────────────

describe("revertUIAction", () => {
  it("reverts a reversible UI action to normal", () => {
    const result = revertUIAction(uiAction("focus"));
    expect(result.ok).toBe(true);
    expect(result.reverted).toBe(true);
    expect(result.mode).toBe(SUPPORTED_UI_MODES.normal);
    expect(result.config).toEqual(MODE_CONFIGURATIONS.normal);
  });

  it("treats an already-normal action as already normal", () => {
    const result = revertUIAction(uiAction("normal"));
    expect(result.ok).toBe(true);
    expect(result.alreadyNormal).toBe(true);
    expect(result.mode).toBe(SUPPORTED_UI_MODES.normal);
  });

  it("rejects non-reversible actions explicitly", () => {
    const result = revertUIAction(uiAction("overwhelm", { reversible: false }));
    expect(result.ok).toBe(false);
    expect(result.reverted).toBe(false);
    expect(result.error).toContain("not reversible");
  });

  it("rejects non-UI actions explicitly", () => {
    const result = revertUIAction({ ...uiAction("focus"), target: "CONTENT" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not a UI action");
  });

  it("does not mutate userState", () => {
    const userState = Object.freeze({ emotionalState: "calm" });
    expect(() => revertUIAction(uiAction("focus"), userState)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────
//  Legacy surface (preserved)
// ─────────────────────────────────────────────────────────────────

describe("legacy adaptUI / buildConfig / getUIClasses", () => {
  it("builds the requested mode configuration", () => {
    expect(adaptUI("focus").mode).toBe("focus");
  });

  it("fails safe to normal for unknown modes", () => {
    expect(adaptUI("party_mode").mode).toBe("normal");
    expect(adaptUI(undefined).mode).toBe("normal");
  });

  it("accepts a userState parameter without using it", () => {
    const userState = Object.freeze({ cognitiveLoad: "high" });
    expect(() => adaptUI("focus", userState)).not.toThrow();
  });

  it("buildConfig returns copies of nested objects", () => {
    const a = buildConfig("reading");
    const b = buildConfig("reading");
    a.typography.letterSpacing = "tight";
    expect(b.typography.letterSpacing).toBe("wide");
  });

  it("getUIClasses returns an object (pass-through stub)", () => {
    expect(getUIClasses(buildConfig("focus"))).toEqual({});
  });
});
