/**
 * SensoryResetIntervention.jsx — Low-stimulation ASD sensory reset experience
 *
 * Provides a calm, low-stimulation visual sanctuary (#1e293b / #0f172a palette)
 * designed to alleviate sensory overload with zero flashing or sudden movements.
 */

import { useState, useEffect, useRef } from "react";
import { Moon, Volume2, VolumeX, CheckCircle2, Shield, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const SENSORY_CHECKLIST = [
  { id: "dim_screen", label: "Dim screen brightness", hint: "Soft, gentle light helps eyes relax" },
  { id: "lower_sound", label: "Lower ambient sound", hint: "Quiet space or headphones" },
  { id: "unclench_body", label: "Unclench shoulders & jaw", hint: "Let your muscles drop and soften" },
];

export default function SensoryResetIntervention({ onComplete, onCancel }) {
  const [checkedItems, setCheckedItems] = useState(["dim_screen"]);
  const [softSound, setSoftSound] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [breathPhase, setBreathPhase] = useState("Inhale gently");
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const startedAtRef = useRef(Date.now());

  // Gentle 8s breath loop: 4s inhale, 4s exhale
  useEffect(() => {
    if (completed) return;
    const interval = setInterval(() => {
      setBreathPhase((prev) => (prev === "Inhale gently" ? "Exhale slowly" : "Inhale gently"));
    }, 4000);
    return () => clearInterval(interval);
  }, [completed]);

  // Optional Web Audio calming 174 Hz tone
  useEffect(() => {
    if (!softSound) {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
          audioContextRef.current?.close();
        } catch {}
        oscillatorRef.current = null;
        audioContextRef.current = null;
      }
      return;
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 174; // Solfeggio 174Hz calm frequency
        gain.gain.value = 0.02; // Very soft volume
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        audioContextRef.current = ctx;
        oscillatorRef.current = osc;
      }
    } catch {
      setSoftSound(false);
    }

    return () => {
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
          audioContextRef.current?.close();
        } catch {}
        oscillatorRef.current = null;
        audioContextRef.current = null;
      }
    };
  }, [softSound]);

  const toggleItem = (id) => {
    setCheckedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFinish = () => {
    setSoftSound(false);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({
      completed: true,
      durationSeconds,
      checklistCount: checkedItems.length,
    });
  };

  if (completed) {
    return (
      <div className="rounded-2xl bg-slate-900 text-slate-100 p-8 text-center space-y-6 animate-in fade-in duration-300 border border-slate-800">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/20 text-teal-300 mx-auto flex items-center justify-center border border-teal-500/30">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-teal-200">
            Sensory Reset complete.
          </h2>
          <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            Take your time getting back. Your senses are grounded and safe.
          </p>
        </div>
        <Button
          onClick={handleFinish}
          className="w-full max-w-xs h-12 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold shadow-lg shadow-teal-950/40"
        >
          Return to App
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900 text-slate-100 p-6 sm:p-8 space-y-6 border border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-950/80 border border-teal-800/50 text-teal-300 text-xs font-semibold">
          <Moon size={13} /> Low-Stimulation Space
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100">
          Sensory Reset
        </h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          A quiet place for your senses to rest.
        </p>
      </div>

      {/* Gentle Breathing Pulse Visual */}
      <div className="rounded-2xl bg-slate-950/70 border border-slate-800/80 p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <div
          className={`w-32 h-32 rounded-full border-2 border-teal-500/30 bg-teal-500/10 flex flex-col items-center justify-center transition-all duration-[4000ms] ease-in-out ${
            breathPhase === "Inhale gently" ? "scale-110 border-teal-400/50" : "scale-90 border-teal-600/20"
          }`}
        >
          <Sparkles size={20} className="text-teal-300 mb-1 opacity-75" />
          <span className="text-xs font-semibold text-teal-200 tracking-wide">{breathPhase}</span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSoftSound(!softSound)}
            className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              softSound
                ? "bg-teal-500/20 border-teal-500/50 text-teal-200"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            }`}
          >
            {softSound ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {softSound ? "Soft hum playing" : "Turn on soft hum"}
          </button>
        </div>
      </div>

      {/* 3-Step Sensory Checklist */}
      <div className="space-y-2.5">
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
          Quiet adjustments (tap to check):
        </p>
        <div className="space-y-2">
          {SENSORY_CHECKLIST.map((item) => {
            const isChecked = checkedItems.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                  isChecked
                    ? "bg-teal-950/40 border-teal-600/50 text-teal-100"
                    : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.hint}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                    isChecked ? "bg-teal-500 border-teal-400 text-slate-950 font-bold" : "border-slate-700 bg-slate-800"
                  }`}
                >
                  {isChecked && <CheckCircle2 size={15} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <Button
          onClick={() => setCompleted(true)}
          className="w-full max-w-xs h-12 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold text-sm shadow-lg shadow-teal-950/40"
        >
          I'm ready to continue
        </Button>
        <button
          type="button"
          onClick={() => {
            setSoftSound(false);
            onCancel?.();
          }}
          className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-4"
        >
          Exit without saving
        </button>
      </div>
    </div>
  );
}
