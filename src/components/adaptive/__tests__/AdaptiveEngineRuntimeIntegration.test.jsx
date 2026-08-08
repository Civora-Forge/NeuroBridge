import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import AdaptiveEngineBridge from "../AdaptiveEngineBridge.jsx";
import {
  configureAdaptiveFlags,
  resetAdaptiveFlags,
} from "@backend/adaptive/engine/featureFlags";
import { clearUserRole4Data } from "@/support/persistence/role4Store";
import {
  AdaptationActionType,
  AdaptationDimension,
  PriorityTier,
} from "@/support/schemas/supportSchemas";

// Wraps the REAL engine: decide() runs the actual D14 stage and the call is
// recorded so the test can assert both what reaches the engine and what the
// engine produces. No D14 logic is mocked.
const { decideCalls } = vi.hoisted(() => ({ decideCalls: [] }));

vi.mock("@backend/adaptive/engine/adaptiveEngine", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    decide: (input) => {
      const result = actual.decide(input);
      decideCalls.push({ input, result });
      return result;
    },
  };
});

const USER = "runtime-int-user-a";

const SNAPSHOT = {
  timestamp: "2026-08-01T00:00:00.000Z",
  mood: { primaryMood: "overwhelmed", confidence: 0.9 },
  behavior: { taskSwitchFrequency: 1.0 },
  conversation: { urgency: "high" },
};

function renderRuntime(userPreferences) {
  return render(
    <AdaptiveEngineBridge
      moduleId="support.focus_session"
      getSnapshot={() => SNAPSHOT}
      userId={USER}
      userPreferences={userPreferences}
    />,
  );
}

describe("Adaptive Engine runtime integration — D14 input wiring", () => {
  beforeEach(() => {
    resetAdaptiveFlags();
    decideCalls.length = 0;
    localStorage.clear();
    clearUserRole4Data(USER);
    configureAdaptiveFlags({ runtime: true });
  });

  afterEach(() => {
    resetAdaptiveFlags();
  });

  async function awaitDecision() {
    await waitFor(() => expect(decideCalls.length).toBeGreaterThan(0));
    return decideCalls[0];
  }

  it("supplies userPreferences to decide() at runtime", async () => {
    const userPreferences = {
      accessibility: { reduceMotion: true },
      requested: [
        { id: "pref.ui_minimal", target: AdaptationDimension.UI, parameters: { mode: "minimal" } },
      ],
      restricted: [{ id: "restrict.no_ui", target: AdaptationDimension.UI }],
    };
    renderRuntime(userPreferences);

    const { input } = await awaitDecision();
    expect(input.userPreferences).toEqual(userPreferences);
  });

  it("applies accessibility preferences at runtime", async () => {
    renderRuntime({ accessibility: { reduceMotion: true }, requested: [], restricted: [] });

    const { result } = await awaitDecision();
    expect(result.trace.sources).toContain("user_preferences");
    expect(result.trace.preferenceResult.appliedRequests).toEqual(["accessibility.reduceMotion"]);

    const action = result.plan.actions[0];
    expect(action.tier).toBe(PriorityTier.EXPLICIT_PREFERENCE);
    expect(action.type).toBe(AdaptationActionType.MODIFY);
    expect(action.parameters).toEqual({ reduceMotion: true });
  });

  it("applies requested preferences at runtime", async () => {
    renderRuntime({
      accessibility: {},
      requested: [
        { id: "pref.ui_minimal", target: AdaptationDimension.UI, parameters: { mode: "minimal" } },
      ],
      restricted: [],
    });

    const { result } = await awaitDecision();
    expect(result.trace.preferenceResult.appliedRequests).toEqual(["pref.ui_minimal"]);

    const action = result.plan.actions[0];
    expect(action.tier).toBe(PriorityTier.EXPLICIT_USER_REQUEST);
    expect(action.evidence).toContain("policy:pref.ui_minimal@v1");
  });

  it("honors restricted preferences at runtime", async () => {
    renderRuntime({
      accessibility: {},
      requested: [
        { id: "pref.ui_minimal", target: AdaptationDimension.UI, parameters: { mode: "minimal" } },
      ],
      restricted: [{ id: "restrict.no_ui", target: AdaptationDimension.UI }],
    });

    const { result } = await awaitDecision();
    expect(result.trace.preferenceResult.appliedRequests).toEqual([]);
    expect(result.trace.preferenceResult.honoredRestrictions).toEqual(["restrict.no_ui"]);
    // The UI restriction is honored: no UI action survives the restriction.
    // Module-scoped actions from the module's own policies target other
    // dimensions and legitimately remain.
    expect(
      result.plan.actions.some((action) => action.target === AdaptationDimension.UI),
    ).toBe(false);
  });

  it("is unchanged when userPreferences is absent at runtime", async () => {
    renderRuntime(undefined);

    const { input, result } = await awaitDecision();
    expect(input.userPreferences).toBeUndefined();
    expect(result.trace.sources).not.toContain("user_preferences");
    expect(result.trace.preferenceResult).toEqual({
      appliedRequests: [],
      honoredRestrictions: [],
      learnedSignalsUsed: [],
    });
    // Any actions come from the engine's own rules; preferences neither add
    // nor remove anything when the fragment is absent.
    expect(result.trace.overrides.filter((o) => o.kind === "preference")).toEqual([]);
  });
});
