/**
 * CalmSpaceIntervention.jsx — Minimal Reassuring Calm / Pause Sanctuary
 *
 * Requirements:
 *   - Reassuring message ("There is no rush. Take all the time you need.")
 *   - Gentle breathing bubble
 *   - Optional calming audio toggle
 *   - Clear [ Exit Calm Space ] button with zero friction
 */

import { useState, useEffect, useRef } from "react";
import { Heart, Volume2, VolumeX, Sparkles, LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CalmSpaceIntervention({ onComplete, onCancel }) {
  const [softSound, setSoftSound] = useState(false);
  const [breatheCount, setBreatheCount] = useState(0);
  const [phase, setPhase] = useState("Inhale");
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const startedAtRef = useRef(Date.now());

  // Gentle breath wave
  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => {
        if (prev === "Inhale") return "Hold gently";
        if (prev === "Hold gently") return "Exhale softly";
        setBreatheCount((c) => c + 1);
        return "Inhale";
      });
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Web Audio calming sine wave
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
        osc.frequency.value = 216; // 216Hz calm harmonic
        gain.gain.value = 0.02;
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

  const handleExit = () => {
    setSoftSound(false);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({
      completed: true,
      durationSeconds,
      breatheCount,
    });
  };

  return (
    <div className="rounded-2xl bg-gradient-to-b from-[#F0F4FF] via-white to-[#E8EDFA] border border-[#C7D2FE] p-6 sm:p-8 space-y-6 text-center shadow-[6px_6px_0_#DDE8FC]">
      {/* Reassurance Header */}
      <div className="space-y-2 max-w-md mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DDE8FC] text-[#4F6BF6] text-xs font-semibold">
          <Heart size={13} className="fill-[#818CF8] text-[#818CF8]" /> Calm Sanctuary
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1E2A5E]">
          You are safe here.
        </h2>
        <p className="text-sm text-[#6B7BA8] leading-relaxed">
          There is no rush. Take all the time you need to reset.
        </p>
      </div>

      {/* Gentle Breathing Orb */}
      <div className="py-4 flex flex-col items-center justify-center">
        <div
          className={`w-36 h-36 rounded-full border-4 border-[#818CF8]/30 bg-[#818CF8]/10 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out shadow-inner ${
            phase === "Inhale" ? "scale-110" : phase === "Exhale softly" ? "scale-90" : "scale-100"
          }`}
        >
          <Sparkles size={22} className="text-[#4F6BF6] mb-1 animate-pulse" />
          <span className="text-sm font-bold text-[#1E2A5E]">{phase}</span>
        </div>
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setSoftSound(!softSound)}
            className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
              softSound
                ? "bg-[#DDE8FC] border-[#4F6BF6] text-[#4F6BF6] font-bold"
                : "bg-white border-[#C7D2FE] text-[#6B7BA8] hover:text-[#1E2A5E]"
            }`}
          >
            {softSound ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {softSound ? "Soft hum playing" : "Turn on soft hum"}
          </button>
        </div>
      </div>

      {/* Exit Button */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <Button
          onClick={handleExit}
          className="w-full max-w-xs h-12 rounded-xl bg-[#4F6BF6] hover:bg-[#3B51D4] text-white font-bold text-sm shadow-[2px_2px_0_#C7D2FE] gap-2"
        >
          <CheckCircle2 size={16} />
          Exit Calm Space
        </Button>
      </div>
    </div>
  );
}
