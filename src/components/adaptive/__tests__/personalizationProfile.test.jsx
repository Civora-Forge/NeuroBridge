/**
 * personalizationProfile.test.jsx — Task 5 user controls and live wiring
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import PersonalizationProfilePanel from "../PersonalizationProfilePanel.jsx";
import AdaptiveUIRuntime from "../AdaptiveUIRuntime.jsx";
import { AdaptiveRuntimeContext } from "../adaptiveRuntimeContext.jsx";
import { useAdaptiveBehavioralEngine } from "@/hooks/useAdaptiveBehavioralEngine";
import {
  configurePersonalizationPersistence,
  createLocalProfileStorage,
  getProfileSnapshot,
  resetPersonalizationStore,
} from "@/adaptive/personalization/profileStore";
import {
  PROFILE_CONFIG,
  createProfile,
  promoteLearnedPreferences,
  resolveProfileView,
  setExplicitPreference,
} from "@/adaptive/personalization/profileModel";
import { createMemoryStorage, setLearningStorage } from "@/adaptive/learning/adaptationLearning";
import { resetExecutionStore } from "@/adaptive/execution/uiExecution";
import { resetAdaptiveHysteresis } from "@backend/adaptive/engine/hysteresis";
import { configureAdaptiveFlags, resetAdaptiveFlags } from "@backend/adaptive/engine/featureFlags";
import { AdaptationActionType, AdaptationDimension, PriorityTier } from "@/support/schemas/supportSchemas";

vi.mock("@/components/interventions/InterventionModal", () => ({ __esModule: true, default: () => null }));

const USER = "panel-user";
const NOW = Date.now();
const KEY = "UI:low_stimulation";

let storage;
function seed(profile) {
  createLocalProfileStorage(storage).write(USER, { profile, pending: false });
}
function promoted(key = KEY, score = 0.9) {
  const summaries = { global: { [key]: { key, scope: "global", score, confidence: 0.8, evidenceCount: 6, sufficient: true } }, contexts: {} };
  const t0 = NOW - PROFILE_CONFIG.promote.minStableMs - 1000;
  const first = promoteLearnedPreferences(createProfile(USER, t0), summaries, { now: t0 }).profile;
  return promoteLearnedPreferences(first, summaries, { now: NOW - 1000 }).profile;
}

beforeEach(() => {
  storage = createMemoryStorage();
  resetPersonalizationStore();
  configurePersonalizationPersistence({ local: createLocalProfileStorage(storage), resolveRemote: async () => null });
  setLearningStorage(createMemoryStorage());
  resetExecutionStore();
  resetAdaptiveHysteresis();
  resetAdaptiveFlags();
});
afterEach(() => {
  resetPersonalizationStore();
  setLearningStorage(null);
  resetAdaptiveFlags();
});

describe("PersonalizationProfilePanel", () => {
  it("views and edits explicit preferences, saving immediately, with undo", async () => {
    render(<PersonalizationProfilePanel userId={USER} />);
    await screen.findByText(/saved on this device only/i);
    fireEvent.change(screen.getByLabelText("Guidance pace"), { target: { value: "slow" } });
    await waitFor(() =>
      expect(getProfileSnapshot(USER).profile.explicit.global.guidancePace.value).toBe("slow"),
    );
    expect(within(screen.getByLabelText("Explicit preferences")).getByText(/Guidance pace: Slow · Everywhere/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /undo last change/i }));
    await waitFor(() => expect(getProfileSnapshot(USER).profile.explicit.global.guidancePace.value).toBeNull());
  });

  it("edits module-specific preferences separately from global ones", async () => {
    render(<PersonalizationProfilePanel userId={USER} />);
    await screen.findByText(/saved on this device only/i);
    fireEvent.change(screen.getByLabelText("Apply settings to"), { target: { value: "support.focus_session" } });
    fireEvent.change(screen.getByLabelText("Focus mode"), { target: { value: "avoided" } });
    await waitFor(() =>
      expect(getProfileSnapshot(USER).profile.explicit.contexts["support.focus_session"]["mode:focus_mode"].value).toBe("avoided"),
    );
    expect(getProfileSnapshot(USER).profile.explicit.global).toEqual({});
  });

  it("shows learned preferences separately, lets the user forget them, and resets", async () => {
    seed(setExplicitPreference(promoted(), "motion", "reduced", { now: NOW - 500 }));
    render(<PersonalizationProfilePanel userId={USER} />);
    const learned = await screen.findByLabelText("Learned preferences");
    expect(within(learned).getByText(/Calmer, low-stimulation visuals — usually helpful for you/)).toBeTruthy();
    expect(screen.getByText(/Motion: Reduced/)).toBeTruthy();

    fireEvent.click(within(learned).getByRole("button", { name: /forget/i }));
    await screen.findByText(/nothing learned yet/i);
    expect(getProfileSnapshot(USER).profile.explicit.global.motion.value).toBe("reduced");

    fireEvent.click(screen.getByRole("button", { name: /reset learned preferences/i }));
    await waitFor(() => expect(getProfileSnapshot(USER).profile.resets.learnedAt).toBeGreaterThan(0));
    expect(getProfileSnapshot(USER).profile.explicit.global.motion.value).toBe("reduced");

    fireEvent.click(screen.getByRole("button", { name: /reset everything/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, reset/i }));
    await waitFor(() => expect(getProfileSnapshot(USER).profile.explicit.global).toEqual({}));
  });

  it("asks a signed-out visitor to sign in instead of storing anything", () => {
    render(<PersonalizationProfilePanel userId={null} />);
    expect(screen.getByText(/sign in to keep your support preferences/i)).toBeTruthy();
  });
});

describe("support offers respect the profile", () => {
  const breathing = () => ({
    actionId: `a-${Math.random()}`,
    type: AdaptationActionType.MODIFY,
    target: "ASSISTANCE",
    parameters: { guidedBreathing: true },
    tier: PriorityTier.CURRENT_STATE,
    confidence: 0.8,
    reason: 'Policy "module.breathing" (v1) matched.',
    evidence: ["policy:module.breathing@v1"],
  });
  const plan = () => ({ planId: "p", decisionTraceId: "t", timestamp: NOW, actions: [breathing()], priorityOrder: [], situation: "emotional_distress", primaryNeed: "regulation", overallConfidence: 0.8 });
  const harness = (personalization) => (
    <AdaptiveRuntimeContext.Provider value={{ plan: plan(), trace: null, enabled: true, active: true, userId: USER, moduleId: "reader", personalization }}>
      <AdaptiveUIRuntime><div>content</div></AdaptiveUIRuntime>
    </AdaptiveRuntimeContext.Provider>
  );
  const card = (container) => container.querySelector('[data-adaptive-support-card="true"]');

  it("shows offers by default", () => {
    const { container } = render(harness(resolveProfileView(createProfile(USER, NOW))));
    expect(card(container)).not.toBeNull();
  });

  it("does not show unrequested offers when the user opted out", () => {
    const profile = setExplicitPreference(createProfile(USER, NOW), "avoid:unrequested_offers", true, { now: NOW });
    const { container } = render(harness(resolveProfileView(profile)));
    expect(card(container)).toBeNull();
  });

  it("does not re-ask for an offer the profile learned is unwanted (new device, no local history)", () => {
    configureAdaptiveFlags({ reflection: true });
    const view = resolveProfileView(promoted("RECOMMENDATION:guided_breathing", 0.1));
    const { container } = render(harness(view));
    expect(card(container)).toBeNull();
  });
});

describe("live decision path", () => {
  it("the engine hook reads the profile before planning", async () => {
    const snapshot = { mood: { primaryMood: "anxious", confidence: 0.95 } };
    const getSnapshot = () => snapshot;
    const profile = setExplicitPreference(createProfile(USER, NOW), "mode:calm_visuals", "avoided", { now: NOW });
    const { result } = renderHook(() =>
      useAdaptiveBehavioralEngine({ enabled: true, userId: USER, getSnapshot, personalizationProfile: profile }),
    );
    await waitFor(() => expect(result.current.trace).not.toBeNull());
    expect(result.current.trace.personalization.applied).toEqual([
      expect.objectContaining({ field: "mode:calm_visuals", effect: "suppressed" }),
    ]);
    expect(result.current.plan.actions.some((a) => a.target === AdaptationDimension.UI)).toBe(false);
    await act(async () => {});
  });
});
