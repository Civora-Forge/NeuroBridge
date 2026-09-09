/**
 * AsdVisualRoot.jsx — applies the resolved ASD visual style to the surface.
 *
 * The existing "Look & tone" system (younger / balanced / clear) stays the
 * single source of truth. This component simply grounds that choice on the
 * DOM (`data-asd-visual-style` on <html> and the wrapper) so the shared
 * visual language in asdVisualLanguage.css can respond globally — and it
 * lets sibling components keep reading the same flags via useASDVisualStyle.
 *
 * The attribute is removed on unmount so non-ASD pages are untouched.
 */

import { useEffect } from "react";
import { useASDVisualStyle } from "./useASDVisualStyle";

export function AsdVisualRoot({ children, className = "" }) {
  const { style } = useASDVisualStyle();

  useEffect(() => {
    const doc = document.documentElement;
    const previous = doc.getAttribute("data-asd-visual-style");
    doc.setAttribute("data-asd-visual-style", style);
    return () => {
      if (previous === null) {
        doc.removeAttribute("data-asd-visual-style");
      } else {
        doc.setAttribute("data-asd-visual-style", previous);
      }
    };
  }, [style]);

  return (
    <div data-asd-visual-style={style} className={className}>
      {children}
    </div>
  );
}

export default AsdVisualRoot;