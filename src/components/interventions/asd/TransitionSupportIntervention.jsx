/**
 * TransitionSupportIntervention.jsx — NOW -> NEXT -> THEN Visual Transition Support
 *
 * Sequence:
 *   1. NOW: Wrap up current task (1-tap checkoff)
 *   2. NEXT: Take a short break / stretch
 *   3. THEN: Start the next activity with low uncertainty
 */

import { useState, useRef } from "react";
import { ArrowRight, CheckCircle2, Clock, Sparkles, Coffee, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TransitionSupportIntervention({ onComplete, onCancel }) {
  const [currentStage, setCurrentStage] = useState(0); // 0 = NOW, 1 = NEXT, 2 = THEN, 3 = COMPLETED
  const [nowDone, setNowDone] = useState(false);
  const [nextDone, setNextDone] = useState(false);
  const startedAtRef = useRef(Date.now());

  const handleFinish = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({ completed: true, durationSeconds });
  };

  if (currentStage === 3) {
    return (
      <div className="rounded-2xl bg-white border border-[#B2DFDB] p-6 sm:p-8 text-center space-y-6 shadow-[4px_4px_0_#D5F5EC] animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-[#D5F5EC] text-[#0D9488] mx-auto flex items-center justify-center border border-[#B2DFDB]">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-[#134E4A]">
            Transition complete! You're ready for what's next.
          </h2>
          <p className="text-sm text-[#5F8A87] max-w-md mx-auto leading-relaxed">
            You smoothly wrapped up the previous task, took a moment to reset, and prepared for your next step.
          </p>
        </div>
        <Button
          onClick={handleFinish}
          className="w-full max-w-xs h-12 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold shadow-[2px_2px_0_#B2DFDB]"
        >
          Return to App
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-[#B2DFDB] p-6 sm:p-8 space-y-6 shadow-[4px_4px_0_#D5F5EC]">
      <div className="text-center space-y-1.5">
        <Badge variant="outline" className="text-xs border-[#B2DFDB] text-[#0D9488] bg-[#F0FAF7]">
          Predictable Transition Flow
        </Badge>
        <h2 className="text-2xl font-bold tracking-tight text-[#134E4A]">
          Now · Next · Then
        </h2>
        <p className="text-xs text-[#5F8A87]">
          One small step at a time reduces transition stress.
        </p>
      </div>

      {/* 3 Step Cards */}
      <div className="space-y-3">
        {/* NOW */}
        <div
          className={`p-4 rounded-2xl border-2 transition-all ${
            currentStage === 0
              ? "bg-[#F0FAF7] border-[#0D9488] shadow-sm"
              : nowDone
              ? "bg-[#E6F8F3] border-[#B2DFDB] opacity-80"
              : "bg-slate-50 border-slate-200 opacity-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#0D9488] text-white text-xs font-black tracking-wider">
                NOW
              </span>
              <span className="text-sm font-bold text-[#134E4A]">Wrap up current activity</span>
            </div>
            {nowDone ? (
              <CheckCircle2 size={20} className="text-[#0D9488]" />
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setNowDone(true);
                  setCurrentStage(1);
                }}
                className="h-8 text-xs bg-[#0D9488] text-white hover:bg-[#0F766E] font-bold"
              >
                Mark Done
              </Button>
            )}
          </div>
          <p className="text-xs text-[#5F8A87] mt-2">
            Save what you're doing or close unnecessary tabs.
          </p>
        </div>

        {/* NEXT */}
        <div
          className={`p-4 rounded-2xl border-2 transition-all ${
            currentStage === 1
              ? "bg-[#F0FAF7] border-[#0D9488] shadow-sm"
              : nextDone
              ? "bg-[#E6F8F3] border-[#B2DFDB] opacity-80"
              : "bg-slate-50 border-slate-200 opacity-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#5EEAD4] text-[#134E4A] text-xs font-black tracking-wider">
                NEXT
              </span>
              <span className="text-sm font-bold text-[#134E4A]">Take a 1-minute pause</span>
            </div>
            {currentStage === 1 && (
              <Button
                size="sm"
                onClick={() => {
                  setNextDone(true);
                  setCurrentStage(2);
                }}
                className="h-8 text-xs bg-[#0D9488] text-white hover:bg-[#0F766E] font-bold"
              >
                Done Pause
              </Button>
            )}
            {nextDone && <CheckCircle2 size={20} className="text-[#0D9488]" />}
          </div>
          <p className="text-xs text-[#5F8A87] mt-2">
            Take a sip of water, stretch your hands, or close your eyes.
          </p>
        </div>

        {/* THEN */}
        <div
          className={`p-4 rounded-2xl border-2 transition-all ${
            currentStage === 2
              ? "bg-[#F0FAF7] border-[#0D9488] shadow-sm"
              : "bg-slate-50 border-slate-200 opacity-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#CCFBF1] text-[#0D9488] text-xs font-black tracking-wider">
                THEN
              </span>
              <span className="text-sm font-bold text-[#134E4A]">Start your next task</span>
            </div>
            {currentStage === 2 && (
              <Button
                size="sm"
                onClick={() => setCurrentStage(3)}
                className="h-8 text-xs bg-[#0D9488] text-white hover:bg-[#0F766E] font-bold"
              >
                I'm Ready
              </Button>
            )}
          </div>
          <p className="text-xs text-[#5F8A87] mt-2">
            Open your next goal with a clear, refreshed focus.
          </p>
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => onCancel?.()}
          className="text-xs text-[#5F8A87] hover:text-[#134E4A] underline underline-offset-4"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
