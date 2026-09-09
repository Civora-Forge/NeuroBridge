/**
 * asdVisualStyleStore.js — live in-memory layer over the existing "Look & tone"
 * preference (`nb_asd_visual_style`, see @/components/asd/ui/asdVisualStyle).
 *
 * The durable value stays in localStorage under the existing key; this store
 * just makes every `useASDVisualStyle()` / `AsdVisualRoot` subscriber re-render
 * the instant a style changes, so the hub, feature cards and DOM attribute all
 * update without a page refresh.
 *
 * Ownership: ASD Experience Engineer
 */

import { create } from "zustand";
import {
  VISUAL_STYLE_PRESENTATION,
  VISUAL_STYLE_DEFAULT,
  persistVisualStyle,
  readStoredVisualStyle,
} from "@/components/asd/ui/asdVisualStyle";

export const useAsdVisualStyleStore = create((set) => ({
  style: readStoredVisualStyle() ?? "",
  setStyle: (next) => {
    const resolved = VISUAL_STYLE_PRESENTATION[next] ? next : VISUAL_STYLE_DEFAULT;
    if (persistVisualStyle(resolved)) {
      set({ style: resolved });
    }
  },
  reload: () => set({ style: readStoredVisualStyle() ?? "" }),
  _clear: () => set({ style: "" }),
}));

export default useAsdVisualStyleStore;