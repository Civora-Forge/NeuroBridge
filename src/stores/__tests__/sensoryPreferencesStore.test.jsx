import { describe, expect, it, beforeEach } from "vitest";
import { render, fireEvent, screen, renderHook, act } from "@testing-library/react";
import {
  useSensoryPreferences,
  useSensoryPreferencesStore,
  SENSORY_PREFERENCES_STORAGE_KEY,
} from "../sensoryPreferencesStore";
import SensorySettings from "@/components/neurobridge/SensorySettings";

Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });

describe("sensoryPreferencesStore — settings apply immediately", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSensoryPreferencesStore.getState().reload();
  });

  it("writes the exact data attributes the CSS listens for", () => {
    act(() => {
      useSensoryPreferencesStore.getState().setPreference("visualIntensity", "simple");
      useSensoryPreferencesStore.getState().setPreference("animation", "off");
      useSensoryPreferencesStore.getState().setPreference("density", "simple");
    });
    const root = document.documentElement;
    expect(root.dataset.sensoryVisualIntensity).toBe("simple");
    expect(root.dataset.sensoryVisual).toBe("simple"); // legacy alias kept
    expect(root.dataset.sensoryAnimation).toBe("off");
    expect(root.dataset.sensoryDensity).toBe("simple");
    expect(root.classList.contains("sensory-no-animation")).toBe(true);
  });

  it("persists to the existing storage key, not a new one", () => {
    act(() => {
      useSensoryPreferencesStore.getState().setPreference("animation", "reduced");
    });
    const stored = JSON.parse(localStorage.getItem(SENSORY_PREFERENCES_STORAGE_KEY));
    expect(stored.animation).toBe("reduced");
    expect(stored.visualIntensity).toBe("comfortable");
  });

  it("subscribers re-render immediately when a setting changes (no refresh)", () => {
    const { result } = renderHook(() => useSensoryPreferences());
    expect(result.current.animation).toBe("normal");
    act(() => {
      result.current.setPreference("animation", "reduced");
    });
    expect(result.current.animation).toBe("reduced");
  });

  it("SensorySettings changes a value and the attribute + storage update at once", () => {
    render(<SensorySettings />);
    fireEvent.click(screen.getByRole("button", { name: /sensory settings/i }));
    fireEvent.click(screen.getByRole("button", { name: "Reduced" }));
    expect(document.documentElement.dataset.sensoryAnimation).toBe("reduced");
    expect(JSON.parse(localStorage.getItem(SENSORY_PREFERENCES_STORAGE_KEY)).animation).toBe("reduced");
  });
});