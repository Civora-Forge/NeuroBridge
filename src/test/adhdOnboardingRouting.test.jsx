import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { selectModulesForUser } from "@backend/adaptive/reasoning/moduleSelector";
import ADHDPage, { ADHD_LANDING_TOOLS } from "@/pages/adhd/ADHDPage";
import { FEATURES, getCanonicalEnabledModuleId, resolveEnabledFeatures } from "@/lib/featureRegistry";
import { getCanonicalSupportModuleId, getSupportModuleById } from "@/support/framework/supportModuleRegistry";
import ProtectedRoute from "@/components/ProtectedRoute";

const authState = vi.hoisted(() => ({
  user: { id: "adhd-user", onboardingCompleted: true },
  role: "user",
  isAuthenticated: true,
  isLoading: false,
  hasFeature: () => true,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState,
}));

const ADHD_MODULE_IDS = [
  "support.task_breakdown",
  "support.focus_session",
  "support.visual_timeline",
  "support.mood_checkin",
  "support.accountability_session",
];

afterEach(() => {
  cleanup();
  authState.hasFeature = () => true;
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

describe("ADHD onboarding and navigation", () => {
  it("recommends individual canonical ADHD modules instead of the dashboard", () => {
    const result = selectModulesForUser({ selectedChallenges: ["adhd"], answersByQuestionId: {} });

    expect(result.enabledModules).toEqual(ADHD_MODULE_IDS.slice(0, 2));
    expect(result.enabledModules.every((moduleId) => moduleId.startsWith("support."))).toBe(true);
    expect(result.selectedModules.map((module) => module.title)).not.toContain("ADHD Dashboard");
  });

  it("resolves canonical, legacy, and existing dashboard IDs for ADHD route access", () => {
    expect(getCanonicalSupportModuleId(FEATURES.ADHD_BREAKDOWN)).toBe("support.task_breakdown");
    expect(getCanonicalEnabledModuleId(FEATURES.ADHD_BREAKDOWN)).toBe("support.task_breakdown");
    expect(resolveEnabledFeatures({ enabledModules: ["support.task_breakdown"] }).has(FEATURES.ADHD_BREAKDOWN)).toBe(true);
    expect(resolveEnabledFeatures({ enabledModules: [FEATURES.ADHD_BREAKDOWN] }).has(FEATURES.ADHD_BREAKDOWN)).toBe(true);
    expect(resolveEnabledFeatures({ enabledModules: [FEATURES.ADHD] }).has(FEATURES.ADHD_BREAKDOWN)).toBe(true);
  });

  it.each([
    ["support.task_breakdown"],
    [FEATURES.ADHD_BREAKDOWN],
  ])("allows direct navigation when %s is enabled", (enabledModule) => {
    const enabledFeatures = resolveEnabledFeatures({ enabledModules: [enabledModule] });
    authState.hasFeature = (feature) => enabledFeatures.has(feature);

    render(
      <MemoryRouter initialEntries={["/adhd/breakdown"]}>
        <ProtectedRoute feature={FEATURES.ADHD_BREAKDOWN}>
          <h1>Task Breakdown Route</h1>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Task Breakdown Route" })).toBeInTheDocument();
  });

  it.each(ADHD_LANDING_TOOLS)("opens $title at its registered route", (tool) => {
    render(
      <MemoryRouter initialEntries={["/adhd"]}>
        <ADHDPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("link", { name: new RegExp(tool.title, "i") }));
    expect(screen.getByTestId("location")).toHaveTextContent(tool.to);
    expect(getSupportModuleById(tool.moduleId)?.route).toBe(tool.to);
  });

  it("uses clear English text without the previously malformed visible strings", () => {
    render(
      <MemoryRouter>
        <ADHDPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Focus and Planning")).toBeInTheDocument();
    expect(screen.queryByText(/Ã|ðŸ|â€/)).not.toBeInTheDocument();
  });
});
