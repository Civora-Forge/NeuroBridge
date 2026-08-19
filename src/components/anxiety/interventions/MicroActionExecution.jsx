/**
 * MicroActionExecution.jsx — Avoidance task activation and 2-minute micro-action component
 */

import { useState, useEffect, useRef } from "react";
import { Zap, CheckCircle2, Play, Pause, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function MicroActionExecution({ initialTask = "", onComplete, onCancel }) {
  const [taskName, setTaskName] = useState(initialTask);
  const [microStep, setMicroStep] = useState("");
  const [activated, setActivated] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120); // 2 minutes
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    if (!timerRunning || secondsRemaining <= 0) return;
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, secondsRemaining]);

  const handleStartTimer = () => {
    setActivated(true);
    setTimerRunning(true);
  };

  const handleFinish = () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    onComplete?.({
      durationSeconds,
      completed: true,
      taskData: {
        taskName,
        microStep,
        timerCompleted: secondsRemaining === 0,
      },
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

  const formatTimer = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="border-primary/30 shadow-md">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-2">
          <Zap size={24} />
        </div>
        <CardTitle className="text-xl">Avoidance Micro-Action</CardTitle>
        <CardDescription>
          Overcome task paralysis by committing to just 2 minutes on the smallest physical starting action.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activated ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">What task are you feeling resistant to starting?</label>
              <Input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                placeholder="e.g., Working on the report / Cleaning the room / Sending the email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">What is the single smallest 2-minute starting action?</label>
              <Input
                value={microStep}
                onChange={(e) => setMicroStep(e.target.value)}
                placeholder="e.g., Open the document and write 1 sentence"
              />
            </div>

            <Button
              className="w-full gap-2 mt-2"
              disabled={!taskName.trim() || !microStep.trim()}
              onClick={handleStartTimer}
            >
              Start 2-Minute Focus Activation <ArrowRight size={16} />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center space-y-1">
              <p className="text-xs text-indigo-700 font-semibold uppercase tracking-wider">Current Focus Action</p>
              <p className="text-base font-bold text-foreground">{microStep}</p>
              <p className="text-xs text-muted-foreground">Task: {taskName}</p>
            </div>

            {/* Timer Display */}
            <div className="text-center py-4 rounded-2xl border bg-background/60">
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs uppercase tracking-widest font-medium mb-1">
                <Clock size={14} /> 2-Minute Micro-Window
              </div>
              <span className="text-4xl font-black font-mono text-primary">
                {formatTimer(secondsRemaining)}
              </span>
            </div>

            <Progress value={((120 - secondsRemaining) / 120) * 100} />

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={timerRunning ? "outline" : "default"}
                onClick={() => setTimerRunning(!timerRunning)}
                className="gap-2"
              >
                {timerRunning ? <Pause size={16} /> : <Play size={16} />}
                {timerRunning ? "Pause" : secondsRemaining > 0 ? "Resume" : "Restart"}
              </Button>
              <Button onClick={handleFinish} className="gap-2">
                <CheckCircle2 size={16} /> Done / Momentum Started
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAbandon}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Cancel session
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
