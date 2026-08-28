/**
 * InterventionModal.jsx — Role 3 Accessible Intervention Dialog Overlay
 *
 * Hosts the resolved intervention component with clean responsive framing,
 * background backdrop blur, escape key handling, and seamless exit transitions.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import InterventionResolver from "./InterventionResolver";

export default function InterventionModal({
  isOpen,
  recommendationId,
  onClose,
  onComplete,
  autoStart = false,
}) {
  const overlayRef = useRef(null);

  // Escape key support
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="relative w-full max-w-lg my-8 animate-in zoom-in-95 duration-200">
        {/* Top close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close intervention"
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md text-slate-500 hover:text-slate-900 hover:bg-slate-50 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <X size={18} />
        </button>

        {/* Resolved Intervention Content */}
        <InterventionResolver
          recommendationId={recommendationId}
          onComplete={(result) => {
            onComplete?.(result);
            onClose?.();
          }}
          onCancel={onClose}
          autoStart={autoStart}
        />
      </div>
    </div>
  );
}
