import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import {
  SUPPORT_TOOL_THEME_BY_MODULE,
  resolveSupportToolTheme,
  supportToolThemeContrastChecks,
} from "@/theme/supportToolThemes";
import homeSource from "../pages/Home.jsx?raw";
import loginSource from "../pages/LoginUser.jsx?raw";
import taskSource from "../pages/adhd/TaskBreakdown.jsx?raw";
import focusSource from "../pages/adhd/FocusSessions.jsx?raw";
import timelineSource from "../pages/adhd/VisualTimeline.jsx?raw";
import moodSource from "../pages/adhd/EmotionCoach.jsx?raw";
import accountabilitySource from "../pages/adhd/BodyDoubling.jsx?raw";
import activitySource from "../pages/depression/MVHProtocol.jsx?raw";
import groundingSource from "../pages/depression/AnxietyDissolver.jsx?raw";
import connectionSource from "../pages/depression/SocialBroadcaster.jsx?raw";
import reframingSource from "../pages/depression/CognitiveReframer.jsx?raw";
import journalSource from "../pages/depression/EvidenceFolder.jsx?raw";
import layoutSource from "../components/support/SupportToolLayout.jsx?raw";

function StatefulChild() {
  const [count, setCount] = React.useState(0);
  return <button onClick={() => setCount((value) => value + 1)}>Count {count}</button>;
}

describe("scoped support tool themes", () => {
  it("maps only the requested support modules to local themes", () => {
    expect(SUPPORT_TOOL_THEME_BY_MODULE).toMatchObject({
      "support.task_breakdown": "adhd_focus",
      "support.focus_session": "adhd_focus",
      "support.visual_timeline": "adhd_focus",
      "support.mood_checkin": "adhd_focus",
      "support.accountability_session": "adhd_focus",
      "support.gentle_activity": "depression_gentle",
      "support.grounding": "depression_gentle",
      "support.social_connection": "depression_gentle",
      "support.cognitive_reframing": "depression_reflection",
      "support.evidence_journal": "depression_reflection",
    });
  });

  it("applies the route defaults only to the requested tool components", () => {
    [taskSource, focusSource, timelineSource, moodSource, accountabilitySource].forEach((source) => {
      expect(source).toContain('theme="adhd_focus"');
    });
    [activitySource, groundingSource, connectionSource].forEach((source) => {
      expect(source).toContain('theme="depression_gentle"');
    });
    [reframingSource, journalSource].forEach((source) => {
      expect(source).toContain('theme="depression_reflection"');
    });
  });

  it("uses the shared support tool layout for every targeted page", () => {
    [taskSource, focusSource, timelineSource, moodSource, accountabilitySource, activitySource, groundingSource, connectionSource, reframingSource, journalSource].forEach((source) => {
      expect(source).toContain('SupportToolLayout');
      expect(source).not.toMatch(/support-tool-page[^"']*(min-h-screen|max-w-(md|xl|2xl|3xl|4xl))/);
    });
    expect(layoutSource).toContain('support-tool-page support-tool-layout');
    expect(layoutSource).toContain('support-tool-completion');
    expect(layoutSource).toContain('support-tool-notice');
  });

  it("scopes tokens to the provider and safely falls back for invalid overrides", () => {
    const { container } = render(<SupportToolThemeProvider theme="adhd_focus"><p>Tool</p></SupportToolThemeProvider>);
    expect(container.firstChild).toHaveAttribute("data-support-theme", "adhd_focus");
    expect(container.firstChild.style.getPropertyValue("--tool-primary")).toBe("#315F45");
    expect(resolveSupportToolTheme("adhd_focus", "not-a-theme")).toBe("adhd_focus");
    expect(resolveSupportToolTheme("adhd_focus", "neutral")).toBeNull();
  });

  it("does not remount module state when the local theme changes", () => {
    const { rerender } = render(<SupportToolThemeProvider theme="adhd_focus"><StatefulChild /></SupportToolThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Count 0" }));
    rerender(<SupportToolThemeProvider theme="depression_gentle"><StatefulChild /></SupportToolThemeProvider>);
    expect(screen.getByRole("button", { name: "Count 1" })).toBeInTheDocument();
  });

  it("meets AA text contrast and meaningful UI contrast requirements", () => {
    supportToolThemeContrastChecks().forEach((check) => {
      expect(check.textOnBackground).toBeGreaterThanOrEqual(4.5);
      expect(check.mutedOnBackground).toBeGreaterThanOrEqual(4.5);
      expect(check.primaryOnSurface).toBeGreaterThanOrEqual(3);
      expect(check.focusOnSurface).toBeGreaterThanOrEqual(3);
    });
  });

  it("keeps the provider local to support tools", () => {
    expect(homeSource).not.toContain("SupportToolThemeProvider");
    expect(loginSource).not.toContain("SupportToolThemeProvider");
  });
});
