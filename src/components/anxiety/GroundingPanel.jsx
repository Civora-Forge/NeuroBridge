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
      <p className="font-medium">{title}</p>
      <div className="rounded-xl border bg-background/50 p-4 grid place-items-center">
        <div className="h-32 w-32 rounded-full border-4 border-primary/40 grid place-items-center transition-all duration-1000" style={{ transform: `scale(${scale})` }}>
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{phase}</p>
            <p className="text-2xl font-bold">{remaining}s</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Cycle time</span>
        <span className="font-medium">{formatClock(elapsed)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Start"}</Button>
        <Button variant="outline" onClick={() => { setRunning(false); setElapsed(0); }}>Reset</Button>
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
      <p className="font-medium">Box Breathing</p>
      <div className="relative mx-auto h-44 w-44 rounded-2xl border-2 border-primary/40 bg-background/60">
        <div className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary transition-all duration-1000" style={position} />
      </div>
      <p className="text-center text-sm"><span className="font-semibold">{phase}</span><span className="text-muted-foreground"> · Follow the dot around the square</span></p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setRunning((value) => !value)}>{running ? "Pause" : "Start"}</Button>
        <Button variant="outline" onClick={() => { setRunning(false); setElapsed(0); }}>Reset</Button>
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
        <p className="text-sm text-muted-foreground">Completed {completed}/{GROUNDING_STEPS.length}</p>
        <Badge variant="secondary">{Math.round((completed / GROUNDING_STEPS.length) * 100)}%</Badge>
      </div>
      <Progress value={(completed / GROUNDING_STEPS.length) * 100} />
      <div className="space-y-2">
        {GROUNDING_STEPS.map((step, index) => (
          <Button key={step} variant="outline" className={`w-full justify-start min-h-12 ${checked[index] ? "bg-primary/10 border-primary" : ""}`} onClick={() => setChecked((prev) => prev.map((v, i) => (i === index ? !v : v)))}>
            {step}
          </Button>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={() => setChecked(GROUNDING_STEPS.map(() => false))}>Reset Checklist</Button>
    </div>
  );
}

function ProgressiveMuscleRelaxation() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState([]);
  const completion = (done.length / PMR_STEPS.length) * 100;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-background/50 p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Current step {currentIndex + 1}/{PMR_STEPS.length}</span>
          <Badge variant="secondary">{Math.round(completion)}%</Badge>
        </div>
        <Progress value={completion} />
        <p className="font-medium">{PMR_STEPS[currentIndex]}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => { setDone((prev) => (prev.includes(currentIndex) ? prev : [...prev, currentIndex])); setCurrentIndex((v) => Math.min(PMR_STEPS.length - 1, v + 1)); }}>
          Mark and Next
        </Button>
        <Button variant="outline" onClick={() => { setCurrentIndex(0); setDone([]); }}>Restart</Button>
      </div>
      <div className="space-y-1 text-sm">
        {PMR_STEPS.map((step, index) => (
          <p key={step} className={done.includes(index) ? "text-primary font-medium" : "text-muted-foreground"}>{index + 1}. {step}</p>
        ))}
      </div>
    </div>
  );
}

export default function GroundingPanel({ autoBreathingToken }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Wind size={18} /> Guided Grounding System</CardTitle>
        <CardDescription>4-7-8 breathing, box breathing, 5-4-3-2-1 checklist, and PMR in dedicated modules.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-lg">4-7-8 Breathing Animation</CardTitle></CardHeader><CardContent><Breathing478Exercise autoStartToken={autoBreathingToken} /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Box Breathing Guide</CardTitle></CardHeader><CardContent><BoxBreathingGuide /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><ListChecks size={16} /> 5-4-3-2-1 Grounding</CardTitle></CardHeader><CardContent><GroundingChecklist54321 /></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Waves size={16} /> Progressive Muscle Relaxation</CardTitle></CardHeader><CardContent><ProgressiveMuscleRelaxation /></CardContent></Card>
      </CardContent>
    </Card>
  );
}
