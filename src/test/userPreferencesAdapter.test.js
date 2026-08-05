import { describe, it, expect } from "vitest";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";

describe("buildUserPreferencesFragment (D14 input wiring)", () => {
  it("maps the canonical accessibility object unchanged", () => {
    const user = { id: "u1", accessibility: { reduceMotion: false, screenReader: true } };
    expect(buildUserPreferencesFragment(user)).toEqual({
      accessibility: { reduceMotion: false, screenReader: true },
    });
  });

  it("forwards requested and restricted arrays unchanged when present", () => {
    const requested = [{ id: "pref.ui", target: "UI", parameters: { mode: "minimal" } }];
    const restricted = [{ id: "restrict.no_ui", target: "UI" }];
    const user = { id: "u1", accessibility: {}, requested, restricted };
    expect(buildUserPreferencesFragment(user)).toEqual({
      accessibility: {},
      requested,
      restricted,
    });
  });

  it("returns undefined when no D14-relevant preference is present", () => {
    expect(buildUserPreferencesFragment({ id: "u1", disorders: ["adhd"] })).toBeUndefined();
    expect(buildUserPreferencesFragment({})).toBeUndefined();
  });

  it("returns undefined for absent or non-object users", () => {
    expect(buildUserPreferencesFragment(undefined)).toBeUndefined();
    expect(buildUserPreferencesFragment(null)).toBeUndefined();
    expect(buildUserPreferencesFragment("u1")).toBeUndefined();
    expect(buildUserPreferencesFragment([])).toBeUndefined();
  });

  it("ignores malformed accessibility values instead of forwarding them", () => {
    expect(buildUserPreferencesFragment({ accessibility: "yes" })).toBeUndefined();
  });

  it("never forwards unrelated preference keys", () => {
    const fragment = buildUserPreferencesFragment({
      id: "u1",
      selectedProfile: "adhd",
      privacy: { telemetry: false },
      accessibility: { reduceMotion: true },
    });
    expect(fragment).toEqual({ accessibility: { reduceMotion: true } });
  });
});
