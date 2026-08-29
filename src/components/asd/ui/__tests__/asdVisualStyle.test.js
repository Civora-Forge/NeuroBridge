import { describe, expect, it, beforeEach } from "vitest";
import {
  VISUAL_STYLES,
  VISUAL_STYLE_DEFAULT,
  VISUAL_STYLE_PRESENTATION,
  persistVisualStyle,
  readStoredVisualStyle,
  resolveVisualStyle,
} from "../asdVisualStyle";

describe("asdVisualStyle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to balanced when nothing suggests otherwise", () => {
    expect(resolveVisualStyle(null)).toBe(VISUAL_STYLE_DEFAULT);
    expect(resolveVisualStyle({ age: 15 })).toBe(VISUAL_STYLES.BALANCED);
  });

  it("maps explicit ages to a subtle treatment (not per-age forks)", () => {
    expect(resolveVisualStyle({ age: 10 }, null)).toBe(VISUAL_STYLES.YOUNGER);
    expect(resolveVisualStyle({ age: 18 }, null)).toBe(VISUAL_STYLES.OLDER);
    expect(resolveVisualStyle({ age: 13 }, null)).toBe(VISUAL_STYLES.BALANCED);
  });

  it("maps ageGroup tags for future profile schemas", () => {
    expect(resolveVisualStyle({ tagProfile: { ageGroup: "child" } })).toBe(VISUAL_STYLES.YOUNGER);
    expect(resolveVisualStyle({ tagProfile: { ageGroup: "adult" } })).toBe(VISUAL_STYLES.OLDER);
  });

  it("persists a stored override and lets it win over age", () => {
    expect(persistVisualStyle(VISUAL_STYLES.OLDER)).toBe(true);
    expect(readStoredVisualStyle()).toBe(VISUAL_STYLES.OLDER);
    expect(resolveVisualStyle({ age: 10 }, readStoredVisualStyle())).toBe(VISUAL_STYLES.OLDER);
  });

  it("ignores invalid persisted values", () => {
    window.localStorage.setItem("nb_asd_visual_style", "banana");
    expect(readStoredVisualStyle()).toBeNull();
    expect(resolveVisualStyle(null, "banana")).toBe(VISUAL_STYLE_DEFAULT);
  });

  it("presentation is a shared adjustment set, not separate implementations", () => {
    const younger = VISUAL_STYLE_PRESENTATION[VISUAL_STYLES.YOUNGER];
    const older = VISUAL_STYLE_PRESENTATION[VISUAL_STYLES.OLDER];
    expect(younger.stickers).toBe(true);
    expect(older.stickers).toBe(false);
    expect(older.gamified).toBe(false);
    expect(older.illustration).toBeLessThan(younger.illustration);
  });

  it("always has young, balanced and older entries", () => {
    expect(Object.keys(VISUAL_STYLE_PRESENTATION).sort()).toEqual(
      ["balanced", "older", "younger"].sort(),
    );
  });
});