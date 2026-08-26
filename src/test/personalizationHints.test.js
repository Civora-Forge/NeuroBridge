import { beforeEach, describe, expect, it } from "vitest";
import { saveUserMemory } from "@/support/persistence/role4Store";
import {
  getPersonalizationHints,
  getPersonalizationHintsForModules,
  resolveAdvisoryConfiguration,
} from "@/support/personalization";
import { setLearningEnabled } from "@/support/memory";
import { validatePersonalizationHints } from "@/support/schemas/supportSchemas";

const USER_ID = "hint-user";
const MODULE_ID = "support.task_breakdown";

function memory(id, overrides = {}) {
  return saveUserMemory(USER_ID, {
    id,
    memoryId: id,
    userId: USER_ID,
    moduleId: MODULE_ID,
    category: "preferred_configuration",
    type: "preference",
    key: "selected_style",
    value: { observedAssociation: "Standard" },
    evidenceCount: 3,
    supportingReflectionIds: ["reflection-1", "reflection-2", "reflection-3"],
    confidence: 0.65,
    confidenceLevel: "moderate",
    firstObservedAt: "2026-01-01T00:00:00.000Z",
    lastUpdatedAt: "2026-01-03T00:00:00.000Z",
    version: 1,
    status: "active",
    contradictionCount: 0,
    metadata: {},
    schemaVersion: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
    evidenceIds: ["reflection-1", "reflection-2", "reflection-3"],
    ...overrides,
  });
}

describe("Role 4 personalization hints", () => {
  beforeEach(() => localStorage.clear());

  it("returns a valid empty response when memory is absent or the module is unsupported", () => {
    expect(getPersonalizationHints(USER_ID, MODULE_ID)).toMatchObject({ hints: [], confidence: 0, evidenceCount: 0 });
    expect(getPersonalizationHints(USER_ID, "support.unknown")).toMatchObject({ hints: [], confidence: 0 });
  });

  it("returns no hints while learning is disabled without changing memory", () => {
    memory("style-memory");
    setLearningEnabled(USER_ID, false);

    expect(getPersonalizationHints(USER_ID, MODULE_ID).hints).toEqual([]);
    setLearningEnabled(USER_ID, true);
    expect(getPersonalizationHints(USER_ID, MODULE_ID).hints).toHaveLength(1);
  });

  it("ignores deleted, superseded, and low-confidence memories", () => {
    memory("deleted", { status: "deleted" });
    memory("superseded", { status: "superseded" });
    memory("low", { confidence: 0.39, confidenceLevel: "low" });

    expect(getPersonalizationHints(USER_ID, MODULE_ID).hints).toEqual([]);
  });

  it("returns medium and high confidence hints as advisory recommendations", () => {
    memory("medium");
    const medium = getPersonalizationHints(USER_ID, MODULE_ID).hints[0];
    memory("high", { key: "timer_associated_completion", category: "successful_strategy", type: "successful_strategy", value: { observedAssociation: "high_completion" }, confidence: 0.85, confidenceLevel: "high" });
    const high = getPersonalizationHints(USER_ID, MODULE_ID).hints.find((hint) => hint.key === "timerEnabled");

    expect(medium).toMatchObject({ key: "selectedStyle", advisory: "usable", value: "Standard" });
    expect(high).toMatchObject({ key: "timerEnabled", advisory: "strong", value: true });
  });

  it("suppresses automatic use when active memories conflict", () => {
    memory("style-standard");
    memory("style-hero", { value: { observedAssociation: "Hero Mode" } });

    const hint = getPersonalizationHints(USER_ID, MODULE_ID).hints[0];
    expect(hint).toMatchObject({ key: "selectedStyle", value: null, advisory: "observational", reasonCode: "conflicting_evidence" });
  });

  it("derives Task Breakdown completion hints without inventing configuration or copying raw text", () => {
    memory("partial", {
      category: "completion_pattern",
      type: "learning_pattern",
      key: "completion_rate_band",
      value: { observedAssociation: "partial" },
      metadata: { rawTask: "Do not copy", feedback: "Do not copy" },
    });
    memory("invalid-style", { value: { observedAssociation: "Invented Style" } });

    const response = getPersonalizationHints(USER_ID, MODULE_ID);
    expect(response.hints).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "suggestSmallerFirstStep", value: true }),
    ]));
    expect(response.hints.find((hint) => hint.key === "selectedStyle")).toBeUndefined();
    expect(JSON.stringify(response)).not.toContain("Do not copy");
  });

  it("is deterministic, user-scoped, serializable, and schema-valid", () => {
    memory("style-memory");
    const first = getPersonalizationHints(USER_ID, MODULE_ID);
    const second = getPersonalizationHints(USER_ID, MODULE_ID);

    expect(first).toEqual(second);
    expect(getPersonalizationHints("another-user", MODULE_ID).hints).toEqual([]);
    expect(getPersonalizationHintsForModules(USER_ID, [MODULE_ID, MODULE_ID])).toEqual([first]);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(validatePersonalizationHints(first)).toEqual(first);
  });

  it("purely resolves usable hints without overriding explicit configuration", () => {
    const response = getPersonalizationHints(USER_ID, MODULE_ID);
    const result = resolveAdvisoryConfiguration({
      moduleDefaults: { selectedStyle: "Standard", timerEnabled: false },
      personalizationHints: [{
        id: "strong-timer", key: "timerEnabled", value: true, sourceMemoryIds: ["timer"], evidenceCount: 5,
        confidence: 0.85, advisory: "strong", reasonCode: "timer_associated_high_completion",
      }, {
        id: "low-style", key: "selectedStyle", value: "Hero Mode", sourceMemoryIds: ["style"], evidenceCount: 2,
        confidence: 0.4, advisory: "observational", reasonCode: "preferred_style_observed",
      }],
      explicitConfiguration: { timerEnabled: false },
    });

    expect(response.hints).toEqual([]);
    expect(result).toEqual({
      suggestedConfiguration: { selectedStyle: "Standard", timerEnabled: false },
      appliedHintIds: ["strong-timer"],
      ignoredHintIds: ["low-style"],
    });
  });
});
