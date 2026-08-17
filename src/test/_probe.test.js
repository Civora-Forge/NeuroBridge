import { describe, it } from "vitest";
import { decide } from "@backend/adaptive/engine/adaptiveEngine";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";

describe("adaptive engine probe", () => {
  it("shows what decide produces for the simulator snapshot", () => {
    const input = {
      contextSnapshot: {
        screen: "asd.social-scenarios",
        session: {
          scenarioId: "college.asking-seminar-question",
          difficulty: "easy",
          status: "active",
          turnCount: 1,
          unexpectedPending: false,
        },
        userProfile: { accessibility: null, disorders: [] },
      },
      moduleContext: buildModuleContext("asd.social-scenarios"),
      userPreferences: buildUserPreferencesFragment({}),
    };
    const { plan, trace } = decide(input, { userId: "probe" });
    console.log("primaryNeed:", plan.primaryNeed);
    console.log("situation:", plan.situation);
    console.log("actionCount:", plan.actions.length);
    console.log("actions:", JSON.stringify(plan.actions.map((a) => ({ target: a.target, type: a.type, priority: a.priority }))));
    console.log("triggeredConditions:", trace.triggeredConditions.length);
    console.log("confidence:", plan.overallConfidence);
  });
});
