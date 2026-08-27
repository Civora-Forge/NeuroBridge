/**
 * GuidedBreathingIntervention.jsx — Paced Box Breathing (4-4-4-4) & 4-7-8 Calming Breathing
 *
 * Requirements:
 *   - Real working timer
 *   - Visual expanding / contracting breathing orb
 *   - Phase countdown & cycle progress
 *   - Start, Pause, Resume, Restart, Finish Early
 *   - 1-tap outcome feedback [ Better ] [ Same ] [ Worse ]
 */

import { useState, useEffect, useRef } from "react";
import { Wind, Play, Pause, RotateCcw, CheckCircle2, Smile, Meh, Frown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function GuidedBreathingIntervention({ onComplete, onCancel }) {
  const [mode, setMode] = useState("box"); // "box" (4-4-4-4) or "relax" (4-7-8)
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const targetCycles = 4;
  const startedAtRef = useRef(Date.now());

  // Timing constants
  const cycleDuration = mode === "box" ? 16 : 19; // Box = 4+4+4+4=16s, 4-7-8 = 4+7+8=19s

  useEffect(() => {
    if (!running || completed) return;
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next > 0 && next % cycleDuration === 0) {
          setCyclesCompleted((c) => {
            const nextCycle = c + 1;
            if (nextCycle >= targetCycles) {
              setRunning(false);
              setCompleted(true);
            }
            return nextCycle;
          });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, completed, cycleDuration, targetCycles]);

  // Phase computation
  const cycleTime = elapsed % cycleDuration;
  let phase = "Inhale";
  let secondsRemaining = 4;
  let scale = 1;

  if (mode === "box") {
    if (cycleTime < 4) {
      phase = "Inhale";
      secondsRemaining = 4 - cycleTime;
      scale = 1.15;
    } else if (cycleTime < 8) {
      phase = "Hold";
      secondsRemaining = 8 - cycleTime;
      scale = 1.15;
    } else if (cycleTime < 12) {
      phase = "Exhale";
      secondsRemaining = 12 - cycleTime;
      scale = 0.9;
    } else {
      phase = "Hold";
      secondsRemaining = 16 - cycleTime;
      scale = 0.9;
    }
  } else {
    // 4-7-8 mode
    if (cycleTime < 4) {
      phase = "Inhale";
      secondsRemaining = 4 - cycleTime;
      scale = 1.2;
    } else if (cycleTime < 11) {
      phase = "Hold";
      secondsRemaining = 11 - cycleTime;
      scale = 1.2;
    } else {
      phase = "Exhale";
      secondsRemaining = 19 - cycleTime;
      scale = 0.85;
    }
  }

  const handleRestart = () => {
    setRunning(false);
    setElapsed(0);
    setCyclesCompleted(0);
    setCompleted(false);
    setFeedback(null);
  };

  const handleFinishEarly = () => {
    setRunning(false);
    setCompleted(true);
  };

  const handleSelectFeedback = (value) => {
    setFeedback(value);
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({
      completed: true,
      durationSeconds,
      cyclesCompleted,
      feedback: value,
      mode,
    });
  };

  if (completed) {
    return (
      <div className="rounded-2xl bg-white border border-[#C7D2FE] p-6 sm:p-8 text-center space-y-6 shadow-[6px_6px_0_#DDE8FC] animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-[#DDE8FC] text-[#4F6BF6] mx-auto flex items-center justify-center border border-[#C7D2FE]">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-[#1E2A5E]">
            Great job. You completed the breathing exercise.
          </h2>
          <p className="text-sm text-[#6B7BA8] max-w-sm mx-auto">
            Completed {cyclesCompleted} cycle{cyclesCompleted === 1 ? "" : "s"} of paced breathing. How do you feel now?
          </p>
        </div>

        {/* 1-Tap Feedback */}
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
          <button
            type="button"
            onClick={() => handleSelectFeedback("better")}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${
              feedback === "better"
                ? "bg-[#34D399]/20 border-[#34D399] shadow-sm font-bold"
                : "bg-white border-[#C7D2FE] hover:border-[#34D399] hover:bg-[#34D399]/5"
            }`}
          >
            <Smile size={24} className="text-[#34D399]" />
            <span className="text-xs font-bold text-[#065F46]">Better</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectFeedback("same")}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${
              feedback === "same"
                ? "bg-slate-100 border-slate-500 shadow-sm font-bold"
                : "bg-white border-[#C7D2FE] hover:border-slate-400 hover:bg-slate-50"
            }`}
          >
            <Meh size={24} className="text-slate-600" />
            <span className="text-xs font-bold text-slate-700">Same</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectFeedback("worse")}
            className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${
              feedback === "worse"
                ? "bg-[#FBBF24]/20 border-[#FBBF24] shadow-sm font-bold"
                : "bg-white border-[#C7D2FE] hover:border-[#FBBF24] hover:bg-[#FBBF24]/5"
            }`}
          >
            <Frown size={24} className="text-[#FBBF24]" />
            <span className="text-xs font-bold text-[#92400E]">Worse</span>
          </button>
        </div>

        {feedback && (
          <div className="pt-3">
            <Button
              onClick={() => {
                const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
                onComplete?.({ completed: true, durationSeconds, cyclesCompleted, feedback, mode });
              }}
              className="w-full max-w-xs h-12 rounded-xl bg-[#4F6BF6] hover:bg-[#3B51D4] text-white font-bold shadow-[2px_2px_0_#C7D2FE]"
            >
              Return to App
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-[#C7D2FE] p-6 sm:p-8 space-y-6 shadow-[6px_6px_0_#DDE8FC]">
      {/* Header with Mode Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#DDE8FC] text-[#4F6BF6] flex items-center justify-center">
            <Wind size={18} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1E2A5E]">Guided Breathing</h2>
            <p className="text-xs text-[#6B7BA8]">Follow the rhythm to center your body</p>
          </div>
        </div>
        <div className="flex rounded-xl bg-[#F0F4FF] p-1 border border-[#C7D2FE]">
          <button
            type="button"
            onClick={() => {
              setMode("box");
              handleRestart();
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              mode === "box" ? "bg-[#4F6BF6] text-white shadow-sm" : "text-[#6B7BA8] hover:text-[#1E2A5E]"
            }`}
          >
            4-4-4-4 Box
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("relax");
              handleRestart();
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              mode === "relax" ? "bg-[#4F6BF6] text-white shadow-sm" : "text-[#6B7BA8] hover:text-[#1E2A5E]"
            }`}
          >
            4-7-8 Calm
          </button>
        </div>
      </div>

      {/* Animated Breathing Orb */}
      <div className="h-52 rounded-2xl bg-[#F0F4FF] border border-[#C7D2FE] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div
          className="w-36 h-36 rounded-full border-4 border-[#4F6BF6]/40 bg-[#4F6BF6]/10 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out shadow-inner"
          style={{ transform: `scale(${running ? scale : 1})` }}
        >
          <span className="text-xs uppercase tracking-widest text-[#6B7BA8] font-bold">
            {running ? phase : "Ready"}
          </span>
          <span className="text-4xl font-black text-[#4F6BF6] mt-0.5">
            {running ? `${secondsRemaining}s` : "4s"}
          </span>
        </div>
        <p className="text-xs text-[#6B7BA8] mt-3 font-medium">
          Cycle {Math.min(targetCycles, cyclesCompleted + 1)} of {targetCycles}
        </p>
      </div>

      {/* Cycle Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-[#6B7BA8] font-medium">
          <span>Cycle Progress</span>
          <span className="text-[#1E2A5E] font-bold">
            {cyclesCompleted}/{targetCycles} cycles
          </span>
        </div>
        <Progress
          value={(Math.min(targetCycles, cyclesCompleted) / targetCycles) * 100}
          className="h-2 bg-[#C7D2FE] [&>[role=progressbar]]:bg-[#4F6BF6]"
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant={running ? "outline" : "default"}
          onClick={() => setRunning(!running)}
          className={`h-12 text-sm font-bold gap-2 rounded-xl ${
            running
              ? "border-[#C7D2FE] text-[#4F6BF6] hover:border-[#4F6BF6] hover:bg-[#F0F4FF]"
              : "bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE]"
          }`}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? "Pause" : elapsed > 0 ? "Resume" : "Start Breathing"}
        </Button>
        <Button
          variant="secondary"
          onClick={handleFinishEarly}
          disabled={elapsed < 4}
          className="h-12 text-sm font-bold gap-2 rounded-xl bg-[#DDE8FC] text-[#4F6BF6] hover:bg-[#C7D2FE]"
        >
          <CheckCircle2 size={16} />
          Finish Early
        </Button>
      </div>

      {/* Cancel / Restart options */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleRestart}
          className="text-xs text-[#6B7BA8] hover:text-[#4F6BF6] flex items-center gap-1"
        >
          <RotateCcw size={13} /> Restart
        </button>
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="text-xs text-[#6B7BA8] hover:text-[#1E2A5E] underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
