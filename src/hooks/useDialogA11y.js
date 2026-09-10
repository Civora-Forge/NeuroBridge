import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Shared focus-management behavior for hand-rolled modal dialogs (the ones
 * that aren't built on Radix Dialog, which already does this itself):
 * move focus in on open, trap Tab/Shift+Tab inside the panel, close on
 * Escape, and restore focus to whatever opened the dialog on close.
 * Mirrors the pattern already used by AgentChat's chat panel.
 *
 * @param {React.RefObject<HTMLElement>} panelRef - the dialog's root element
 * @param {boolean} isOpen
 * @param {() => void} onClose
 */
export default function useDialogA11y(panelRef, isOpen, onClose) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      const target = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      target?.focus();
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus?.();
      previouslyFocusedRef.current = null;
    }
  }, [isOpen, panelRef]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onClose, panelRef]);
}
