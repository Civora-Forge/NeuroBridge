import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyPresetGlobally, loadPreferences, PREFERENCES_CHANGED_EVENT } from "@/lib/presentationPreferences";

describe("presentationPreferences — applying a preset globally, no mounted component required", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    delete document.documentElement.dataset.sensoryVisual;
    delete document.documentElement.dataset.sensoryAnimation;
    delete document.documentElement.dataset.sensoryDensity;
    delete document.documentElement.dataset.sensoryTextScale;
  });

  it("writes the preset's values to localStorage", () => {
    applyPresetGlobally("low_stimulation");
    const stored = loadPreferences();
    expect(stored.visualIntensity).toBe("simple");
    expect(stored.animation).toBe("off");
  });

  it("applies the preset to <html> data attributes immediately", () => {
    applyPresetGlobally("text_first");
    expect(document.documentElement.dataset.sensoryTextScale).toBe("large");
    expect(document.documentElement.dataset.sensoryVisual).toBe("simple");
  });

  it("toggles the no-animation class when the preset turns animation off", () => {
    applyPresetGlobally("low_stimulation");
    expect(document.documentElement.classList.contains("sensory-no-animation")).toBe(true);
    applyPresetGlobally("standard");
    expect(document.documentElement.classList.contains("sensory-no-animation")).toBe(false);
  });

  it("dispatches a change event so an already-open settings panel can resync", () => {
    const handler = vi.fn();
    window.addEventListener(PREFERENCES_CHANGED_EVENT, handler);
    applyPresetGlobally("focus");
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(PREFERENCES_CHANGED_EVENT, handler);
  });

  it("returns null and does not throw for an unknown preset id", () => {
    expect(() => applyPresetGlobally("nonexistent")).not.toThrow();
    expect(applyPresetGlobally("nonexistent")).toBeNull();
  });
});
