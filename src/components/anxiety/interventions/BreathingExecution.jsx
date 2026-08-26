/**
 * BreathingExecution.jsx — Paced 4-4-4-4 Box Breathing execution component
 */

import { useState, useEffect, useRef } from "react";
import { Wind, CheckCircle2, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function BreathingExecution({ onComplete, onCancel }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const targetCycles = 4;
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next > 0 && next % 16 === 0) {
          setCyclesCompleted((c) => c + 1);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const step = elapsed % 16;
  const phase = step < 4 ? "Inhale" : step < 8 ? "Hold" : step < 12 ? "Exhale" : "Hold";
  const secondsInPhase = (step % 4) + 1;
  const scale = phase === "Inhale" ? 1.15 : phase === "Exhale" ? 0.9 : 1.05;

  const handleFinish = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({
      durationSeconds,
      completed: true,
      cyclesCompleted,
    });
  };

  const handleAbandon = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onCancel?.({
      durationSeconds,
      completed: false,
      abandoned: true,
    });
  };

  return (
    <Card className="border-[#C7D2FE] shadow-[6px_6px_0_#DDE8FC] rounded-2xl overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC]" />
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#DDE8FC] flex items-center justify-center text-[#4F6BF6] mb-2">
          <Wind size={24} />
        </div>
        <CardTitle className="text-xl text-[#1E2A5E]">Paced Box Breathing</CardTitle>
        <CardDescription className="text-[#6B7BA8]">
          Follow the 4-4-4-4 rhythm: Inhale 4s, Hold 4s, Exhale 4s, Hold 4s.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Breathing Animation Area */}
        <div className="h-48 rounded-2xl border border-[#C7D2FE] bg-[#F0F4FF]/60 flex flex-col items-center justify-center p-4 relative overflow-hidden">
          <div
            className="w-32 h-32 rounded-full border-4 border-[#4F6BF6]/30 bg-[#4F6BF6]/5 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out shadow-inner"
            style={{ transform: `scale(${running ? scale : 1})` }}
          >
            <span className="text-xs uppercase tracking-widest text-[#6B7BA8] font-semibold">
              {running ? phase : "Ready"}
            </span>
            <span className="text-3xl font-black text-[#4F6BF6] mt-0.5">
              {running ? `${4 - (step % 4)}s` : "4s"}
            </span>
          </div>
          {running && (
            <p className="text-xs text-[#6B7BA8] mt-3">
              Cycle {cyclesCompleted + 1} of {targetCycles}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[#6B7BA8] font-medium">
            <span>Cycle Progress</span>
            <span className="text-[#1E2A5E]">
              {Math.min(targetCycles, cyclesCompleted)}/{targetCycles} cycles
            </span>
          </div>
          <Progress value={(Math.min(targetCycles, cyclesCompleted) / targetCycles) * 100} className="h-2 bg-[#C7D2FE] [&>[role=progressbar]]:bg-[#4F6BF6]" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={running ? "outline" : "default"}
            onClick={() => setRunning(!running)}
            className={`gap-2 font-bold ${
              running
                ? "border-[#C7D2FE] text-[#4F6BF6] hover:border-[#4F6BF6]"
                : "bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE]"
            }`}
          >
            {running ? <Pause size={16} /> : <Play size={16} />}
            {running ? "Pause" : elapsed > 0 ? "Resume" : "Start Breathing"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleFinish}
            disabled={elapsed < 10}
            className="gap-2 bg-[#DDE8FC] text-[#4F6BF6] hover:bg-[#C7D2FE] font-bold"
          >
            <CheckCircle2 size={16} />
            Complete Session
          </Button>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAbandon}
            className="text-xs text-[#6B7BA8] hover:text-[#4F6BF6] underline underline-offset-4"
          >
            Cancel / Stop early
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
