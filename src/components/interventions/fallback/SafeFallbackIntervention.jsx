/**
 * SafeFallbackIntervention.jsx — Graceful fallback for unknown/unsupported interventions
 *
 * Ensures the app never crashes if an unknown recommendation ID is received.
 * Presents a calm, low-cognitive-load pause screen with an optional gentle breath cycle.
 */

import { useState, useEffect } from "react";
import { Sparkles, Heart, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SafeFallbackIntervention({ onComplete, onCancel }) {
  const [breathCount, setBreathCount] = useState(0);
  const [phase, setPhase] = useState("Breathe in");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (completed) return;
    const interval = setInterval(() => {
      setPhase((prev) => {
        if (prev === "Breathe in") return "Hold gently";
        if (prev === "Hold gently") return "Breathe out";
        setBreathCount((c) => {
          const next = c + 1;
          if (next >= 3) setCompleted(true);
          return next;
        });
        return "Breathe in";
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [completed]);

  const handleFinish = () => {
    onComplete?.({ completed: true, durationSeconds: 30 });
  };

  if (completed) {
    return (
      <div className="text-center py-6 space-y-6 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-teal-100 text-teal-700 mx-auto flex items-center justify-center shadow-sm">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-800">Pause Complete</h2>
          <p className="text-sm text-slate-600 max-w-sm mx-auto">
            You took time to pause and reset. You can return whenever you feel ready.
          </p>
        </div>
        <Button
          onClick={handleFinish}
          className="w-full max-w-xs h-12 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md"
        >
          Return to App
        </Button>
      </div>
    );
  }

  return (
    <div className="text-center py-4 space-y-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
          <Heart size={13} className="text-rose-500" /> Gentle Pause
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Let's take a short pause</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          There is nothing you have to do right now. Just pause and take a few slow breaths.
        </p>
      </div>

      <div className="py-6 flex flex-col items-center justify-center">
        <div
          className={`w-32 h-32 rounded-full border-4 border-teal-400/40 bg-teal-50 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out shadow-inner ${
            phase === "Breathe in" ? "scale-110" : phase === "Breathe out" ? "scale-90" : "scale-100"
          }`}
        >
          <Sparkles size={20} className="text-teal-600 mb-1 animate-pulse" />
          <span className="text-sm font-bold text-slate-700">{phase}</span>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Breath {Math.min(3, breathCount + 1)} of 3
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 pt-2">
        <Button
          onClick={handleFinish}
          className="w-full max-w-xs h-11 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-md"
        >
          I'm Ready to Continue
        </Button>
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-4"
        >
          Exit without saving
        </button>
      </div>
    </div>
  );
}
