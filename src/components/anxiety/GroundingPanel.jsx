import { useEffect, useState } from "react";
import { ListChecks, Waves, Wind } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatClock, GROUNDING_STEPS, PMR_STEPS } from "./anxietyUtils";

function Breathing478Exercise({ autoStartToken = 0, title = "4-7-8 Breathing" }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!autoStartToken) return;
    setElapsed(0);
    setRunning(true);
  }, [autoStartToken]);

  const step = elapsed % 19;
  const phase = step < 4 ? "Inhale" : step < 11 ? "Hold" : "Exhale";
  const remaining = step < 4 ? 4 - step : step < 11 ? 11 - step : 19 - step;
  const scale = phase === "Exhale" ? 0.88 : 1.14;

  return (
    <div className="space-y-3">
      <p className="font-semibold text-[#1E2A5E]">{title}</p>
      <div className="rounded-xl border border-[#C7D2FE] bg-[#F0F4FF]/60 p-4 grid place-items-center">
        <div
          className="h-32 w-32 rounded-full border-4 border-[#4F6BF6]/40 bg-[#4F6BF6]/5 grid place-items-center transition-all duration-1000 shadow-inner"
          style={{ transform: `scale(${scale})` }}
        >
          <div className="text-center">
            <p className="text-sm text-[#6B7BA8]">{phase}</p>
            <p className="text-2xl font-bold text-[#4F6BF6]">{remaining}s</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#6B7BA8]">Cycle time</span>
        <span className="font-medium text-[#1E2A5E]">{formatClock(elapsed)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => setRunning((value) => !value)}
          className="bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE]"
        >
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          variant="outline"
          className="border-[#C7D2FE] text-[#6B7BA8] hover:text-[#4F6BF6] hover:border-[#4F6BF6]"
          onClick={() => { setRunning(false); setElapsed(0); }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function BoxBreathingGuide() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const step = elapsed % 16;
  const phase = step < 4 ? "Inhale" : step < 8 ? "Hold" : step < 12 ? "Exhale" : "Hold";
  const edge = step < 4 ? "top" : step < 8 ? "right" : step < 12 ? "bottom" : "left";
  const progress = (step % 4) / 4;

  const position =
    edge === "top"
      ? { left: `${8 + progress * 84}%`, top: "8%" }
      : edge === "right"
      ? { left: "92%", top: `${8 + progress * 84}%` }
      : edge === "bottom"
      ? { left: `${92 - progress * 84}%`, top: "92%" }
      : { left: "8%", top: `${92 - progress * 84}%` };

  return (
    <div className="space-y-3">
      <p className="font-semibold text-[#1E2A5E]">Box Breathing</p>
      <div className="relative mx-auto h-44 w-44 rounded-2xl border-2 border-[#4F6BF6]/30 bg-[#F0F4FF]/60">
        <div
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4F6BF6] transition-all duration-1000 shadow-md"
          style={position}
        />
      </div>
      <p className="text-center text-sm">
        <span className="font-semibold text-[#1E2A5E]">{phase}</span>
        <span className="text-[#6B7BA8]"> · Follow the dot around the square</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => setRunning((value) => !value)}
          className="bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE]"
        >
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          variant="outline"
          className="border-[#C7D2FE] text-[#6B7BA8] hover:text-[#4F6BF6] hover:border-[#4F6BF6]"
          onClick={() => { setRunning(false); setElapsed(0); }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function GroundingChecklist54321() {
  const [checked, setChecked] = useState(() => GROUNDING_STEPS.map(() => false));
  const completed = checked.filter(Boolean).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#6B7BA8]">Completed {completed}/{GROUNDING_STEPS.length}</p>
        <Badge variant="secondary" className="bg-[#DDE8FC] text-[#4F6BF6] border-[#C7D2FE]">{Math.round((completed / GROUNDING_STEPS.length) * 100)}%</Badge>
      </div>
      <Progress value={(completed / GROUNDING_STEPS.length) * 100} className="h-2 bg-[#C7D2FE] [&>[role=progressbar]]:bg-[#4F6BF6]" />
      <div className="space-y-2">
        {GROUNDING_STEPS.map((step, index) => (
          <Button
            key={step}
            variant="outline"
            className={`w-full justify-start min-h-12 font-medium border-2 transition-all ${
              checked[index]
                ? "bg-[#DDE8FC] border-[#4F6BF6] text-[#1E2A5E]"
                : "border-[#C7D2FE] bg-white text-[#1E2A5E] hover:border-[#4F6BF6] hover:bg-[#F0F4FF]"
            }`}
            onClick={() => setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)))}
          >
            {step}
          </Button>
        ))}
      </div>
      <Button
        variant="outline"
        className="w-full border-[#C7D2FE] text-[#6B7BA8] hover:text-[#4F6BF6] hover:border-[#4F6BF6]"
        onClick={() => setChecked(GROUNDING_STEPS.map(() => false))}
      >
        Reset Checklist
      </Button>
    </div>
  );
}

function ProgressiveMuscleRelaxation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState([]);
  const completion = (done.length / PMR_STEPS.length) * 100;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#C7D2FE] bg-[#F0F4FF]/60 p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#6B7BA8]">Current step {currentIndex + 1}/{PMR_STEPS.length}</span>
          <Badge variant="secondary" className="bg-[#DDE8FC] text-[#4F6BF6] border-[#C7D2FE]">{Math.round(completion)}%</Badge>
        </div>
        <Progress value={completion} className="h-2 bg-[#C7D2FE] [&>[role=progressbar]]:bg-[#4F6BF6]" />
        <p className="font-semibold text-[#1E2A5E]">{PMR_STEPS[currentIndex]}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE]"
          onClick={() => {
            setDone((prev) => (prev.includes(currentIndex) ? prev : [...prev, currentIndex]));
            setCurrentIndex((v) => Math.min(PMR_STEPS.length - 1, v + 1));
          }}
        >
          Mark and Next
        </Button>
        <Button
          variant="outline"
          className="border-[#C7D2FE] text-[#6B7BA8] hover:text-[#4F6BF6] hover:border-[#4F6BF6]"
          onClick={() => { setCurrentIndex(0); setDone([]); }}
        >
          Restart
        </Button>
      </div>
      <div className="space-y-1 text-sm">
        {PMR_STEPS.map((step, index) => (
          <p key={step} className={done.includes(index) ? "text-[#4F6BF6] font-semibold" : "text-[#6B7BA8]"}>
            {index + 1}. {step}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function GroundingPanel({ autoBreathingToken }) {
  return (
    <Card className="overflow-hidden border-[#C7D2FE] shadow-[4px_4px_0_#DDE8FC]">
      <div className="h-2 bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC]" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-[#1E2A5E]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDE8FC] text-[#4F6BF6]">
            <Wind size={18} />
          </div>
          Guided Grounding System
        </CardTitle>
        <CardDescription className="text-[#6B7BA8]">
          4-7-8 breathing, box breathing, 5-4-3-2-1 checklist, and PMR in dedicated modules.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
          <CardHeader><CardTitle className="text-lg text-[#1E2A5E]">4-7-8 Breathing Animation</CardTitle></CardHeader>
          <CardContent><Breathing478Exercise autoStartToken={autoBreathingToken} /></CardContent>
        </Card>
        <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
          <CardHeader><CardTitle className="text-lg text-[#1E2A5E]">Box Breathing Guide</CardTitle></CardHeader>
          <CardContent><BoxBreathingGuide /></CardContent>
        </Card>
        <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
          <CardHeader><CardTitle className="text-lg text-[#1E2A5E] flex items-center gap-2"><ListChecks size={16} className="text-[#4F6BF6]" /> 5-4-3-2-1 Grounding</CardTitle></CardHeader>
          <CardContent><GroundingChecklist54321 /></CardContent>
        </Card>
        <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
          <CardHeader><CardTitle className="text-lg text-[#1E2A5E] flex items-center gap-2"><Waves size={16} className="text-[#4F6BF6]" /> Progressive Muscle Relaxation</CardTitle></CardHeader>
          <CardContent><ProgressiveMuscleRelaxation /></CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
