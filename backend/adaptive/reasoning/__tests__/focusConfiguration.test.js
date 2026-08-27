import { describe, expect, it } from "vitest";
import { recommendFocusConfiguration } from "../focusConfiguration.js";
import { decide } from "../../engine/adaptiveEngine.js";
import { buildModuleContext } from "@/support/framework/moduleContextAdapter";

const evidence = { modules: [{ moduleId: "support.focus_session", evidenceCount: 3, confidence: 0.65, preferredConfiguration: { advisory: true, values: { plannedDurationMinutes: 15, breakDurationMinutes: 5 } } }] };

describe("Role 2 Focus configuration", () => {
  it("turns repeated aggregate outcomes into an advisory configuration", () => {
    expect(recommendFocusConfiguration(evidence)).toMatchObject({ plannedDurationMinutes: 15, breakDurationMinutes: 5 });
  });

  it("adds the advisory configuration to a Focus adaptation plan only", () => {
    const outcome = decide({ contextSnapshot: {}, moduleContext: buildModuleContext("support.focus_session"), role4Signals: { supportEvidence: evidence } }, { now: 1 });
    expect(outcome.plan.actions).toEqual(expect.arrayContaining([expect.objectContaining({ target: "PACING", parameters: { focusConfiguration: expect.objectContaining({ plannedDurationMinutes: 15 }) } })]));
  });

  it("does not invent a recommendation from insufficient evidence", () => {
    expect(recommendFocusConfiguration({ modules: [{ moduleId: "support.focus_session", confidence: 0.25, preferredConfiguration: null }] })).toBeNull();
  });
});
