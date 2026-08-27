import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "@/App";
import ADHDPage, { ADHD_LANDING_TOOLS } from "@/pages/adhd/ADHDPage";
import DepressionDashboard, { DEPRESSION_LANDING_TOOLS } from "@/pages/depression/DepressionDashboard";
import { FEATURES, resolveEnabledFeatures } from "@/lib/featureRegistry";
import { MODULES_REGISTRY } from "@/data/modulesRegistry";
import { getSupportModuleById } from "@/support/framework/supportModuleRegistry";
import appSource from "../App.jsx?raw";

vi.mock("@/context/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: {
      id: "role4-navigation-user",
      name: "Role 4 Test",
      disorders: ["adhd", "depression"],
      accessibility: {},
      onboardingCompleted: true,
    },
    role: "user",
    isAuthenticated: true,
    isLoading: false,
    hasFeature: () => true,
    logout: () => {},
  }),
}));

vi.mock("@/context/ContextProvider", () => ({
  ContextProvider: ({ children }) => children,
  useContextState: () => ({
    context: null,
    lastUpdated: null,
    processUserMessage: async () => ({}),
    refreshContext: async () => ({}),
  }),
  useContextStateOptional: () => null,
  resolveModuleFromPath: () => "dashboard",
}));

vi.mock("@/components/dev/ContextInspector", () => ({
  default: () => null,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

function renderLandingPage(Page) {
  return render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
  );
}

describe("Role 4 ADHD and depression navigation", () => {
  it("renders ADHDPage as one canonical landing page with only available module cards", () => {
    renderLandingPage(ADHDPage);

    expect(screen.getByRole("heading", { name: "Focus and Planning" })).toBeInTheDocument();
    expect(screen.queryByText("ADHD Hub")).not.toBeInTheDocument();
    expect(ADHD_LANDING_TOOLS.map((tool) => tool.moduleId)).toEqual([
      "support.visual_timeline",
      "support.task_breakdown",
      "support.focus_session",
      "support.mood_checkin",
      "support.accountability_session",
    ]);
  });

  it("registers the canonical ADHD and depression landing routes in the application", () => {
    window.history.pushState({}, "", "/adhd");
    const { unmount } = render(<App />);
    expect(screen.getByRole("heading", { name: "Focus and Planning" })).toBeInTheDocument();
    unmount();

    window.history.pushState({}, "", "/depression");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Daily Momentum" })).toBeInTheDocument();
  });

  it("registers the Evidence Journal route without falling through to the 404 page", () => {
    window.history.pushState({}, "", "/depression/evidence");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Review the evidence" })).toBeInTheDocument();
    expect((appSource.match(/path="\/depression\/evidence"/g) || [])).toHaveLength(1);
  });

  it("renders DepressionDashboard with the active Evidence Journal route", () => {
    renderLandingPage(DepressionDashboard);

    expect(screen.getByRole("heading", { name: "Daily Momentum" })).toBeInTheDocument();
    expect(screen.getByText("Evidence Journal")).toBeInTheDocument();
    expect(screen.queryByText("Void Whisper")).not.toBeInTheDocument();
    expect(DEPRESSION_LANDING_TOOLS.map((tool) => tool.moduleId)).toEqual([
      "support.gentle_activity",
      "support.grounding",
      "support.social_connection",
      "support.cognitive_reframing",
      "support.evidence_journal",
    ]);
    expect(DEPRESSION_LANDING_TOOLS.find((tool) => tool.moduleId === "support.evidence_journal")?.to).toBe("/depression/evidence");
  });

  it("maps every visible landing card to one active Role 4 module route", () => {
    [...ADHD_LANDING_TOOLS, ...DEPRESSION_LANDING_TOOLS].forEach((tool) => {
      expect(getSupportModuleById(tool.moduleId)?.route).toBe(tool.to);
    });
  });

  it("keeps deferred modules hidden", () => {
    expect(MODULES_REGISTRY[FEATURES.DEPRESSION_PROOF]).toBeUndefined();
    expect(MODULES_REGISTRY[FEATURES.DEPRESSION_VOID]).toBeUndefined();
  });

  it("preserves existing diagnosis-based feature resolution for protected leaf routes", () => {
    const adhdFeatures = resolveEnabledFeatures({ disorders: ["adhd"] });
    const depressionFeatures = resolveEnabledFeatures({ disorders: ["depression"] });

    expect(adhdFeatures.has(FEATURES.ADHD_FOCUS)).toBe(true);
    expect(adhdFeatures.has(FEATURES.ADHD_BREAKDOWN)).toBe(true);
    expect(depressionFeatures.has(FEATURES.DEPRESSION_MVH)).toBe(true);
    expect(depressionFeatures.has(FEATURES.DEPRESSION_REALITY)).toBe(true);
  });
});
