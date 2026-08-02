import { describe, expect, it } from "vitest";
import adhdLandingSource from "../pages/adhd/ADHDPage.jsx?raw";
import focusSource from "../pages/adhd/FocusSessions.jsx?raw";
import timelineSource from "../pages/adhd/VisualTimeline.jsx?raw";
import moodSource from "../pages/adhd/EmotionCoach.jsx?raw";
import accountabilitySource from "../pages/adhd/BodyDoubling.jsx?raw";
import taskSource from "../pages/adhd/TaskBreakdown.jsx?raw";
import depressionLandingSource from "../pages/depression/DepressionDashboard.jsx?raw";
import activitySource from "../pages/depression/MVHProtocol.jsx?raw";
import groundingSource from "../pages/depression/AnxietyDissolver.jsx?raw";
import connectionSource from "../pages/depression/SocialBroadcaster.jsx?raw";
import reframingSource from "../pages/depression/CognitiveReframer.jsx?raw";
import journalSource from "../pages/depression/EvidenceFolder.jsx?raw";

const ACTIVE_MODULE_SOURCES = [
  adhdLandingSource,
  taskSource,
  focusSource,
  timelineSource,
  moodSource,
  accountabilitySource,
  depressionLandingSource,
  activitySource,
  groundingSource,
  connectionSource,
  reframingSource,
  journalSource,
];

describe("Role 4 visible English copy", () => {
  it("contains no known mojibake in active ADHD and depression pages", () => {
    ACTIVE_MODULE_SOURCES.forEach((source) => {
      expect(source).not.toMatch(/Ã|ðŸ|â€|Â|ï¸/);
    });
  });

  it("uses canonical titles and excludes legacy card labels", () => {
    expect(adhdLandingSource).toContain('title: "Focus Session"');
    expect(adhdLandingSource).toContain('title: "Mood Check-in"');
    expect(adhdLandingSource).toContain('title: "Accountability Session"');
    expect(depressionLandingSource).toContain('title: "Gentle Activity"');
    expect(depressionLandingSource).toContain('title: "Grounding"');
    expect(depressionLandingSource).toContain('title: "Social Connection"');
    expect(depressionLandingSource).toContain('title: "Cognitive Reframing"');
    expect(journalSource).toContain("Evidence Journal");
    expect(journalSource).not.toContain("Proof your brain is lying");
  });
});
