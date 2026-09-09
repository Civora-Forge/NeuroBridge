import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, renderHook, act } from "@testing-library/react";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: null, role: "user" }),
}));

import useAsdVisualStyleStore from "@/stores/asdVisualStyleStore";
import { useASDVisualStyle } from "@/components/asd/ui/useASDVisualStyle";
import { AsdVisualRoot } from "@/components/asd/ui/AsdVisualRoot";
import {
  VISUAL_STYLES,
  VISUAL_STYLE_STORAGE_KEY,
  VISUAL_STYLE_DEFAULT,
} from "@/components/asd/ui/asdVisualStyle";

describe("asdVisualStyleStore — Look & tone applies immediately", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAsdVisualStyleStore.getState().reload();
  });

  it("setStyle updates the shared store immediately", () => {
    expect(useAsdVisualStyleStore.getState().style).toBe("");
    act(() => {
      useAsdVisualStyleStore.getState().setStyle(VISUAL_STYLES.YOUNGER);
    });
    expect(useAsdVisualStyleStore.getState().style).toBe(VISUAL_STYLES.YOUNGER);
  });

  it("persists to the existing storage key", () => {
    act(() => {
      useAsdVisualStyleStore.getState().setStyle(VISUAL_STYLES.OLDER);
    });
    expect(localStorage.getItem(VISUAL_STYLE_STORAGE_KEY)).toBe(VISUAL_STYLES.OLDER);
  });

  it("every useASDVisualStyle subscriber sees the new style without a refresh", () => {
    const first = renderHook(() => useASDVisualStyle());
    const second = renderHook(() => useASDVisualStyle());
    expect(first.result.current.style).toBe(VISUAL_STYLE_DEFAULT);
    act(() => {
      first.result.current.setStyle(VISUAL_STYLES.YOUNGER);
    });
    expect(first.result.current.style).toBe(VISUAL_STYLES.YOUNGER);
    expect(second.result.current.style).toBe(VISUAL_STYLES.YOUNGER);
  });

  it("AsdVisualRoot keeps the html attribute in sync while mounted", () => {
    render(<AsdVisualRoot><span>hi</span></AsdVisualRoot>);
    expect(document.documentElement.getAttribute("data-asd-visual-style")).toBe(VISUAL_STYLE_DEFAULT);
    act(() => {
      useAsdVisualStyleStore.getState().setStyle(VISUAL_STYLES.YOUNGER);
    });
    expect(document.documentElement.getAttribute("data-asd-visual-style")).toBe(VISUAL_STYLES.YOUNGER);
  });
});