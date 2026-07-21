import { useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, Siren } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

const PANIC_COPING_ACTIONS = [
  "Pause and plant both feet on the floor.",
  "Do 3 rounds of slow breathing (inhale 4s, exhale 6-8s).",
  "Name 5 things you can see, 4 you can touch, 3 you can hear.",
  "Sip water and relax your shoulders + jaw.",
  "Send a quick message to a trusted person if distress remains high.",
];

export default function PanicModePanel({ onActivate }) {
  const [active, setActive] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);

  const completion = useMemo(() => {
    if (!PANIC_COPING_ACTIONS.length) return 0;
    return (completedSteps.length / PANIC_COPING_ACTIONS.length) * 100;
  }, [completedSteps]);

  const handleActivate = () => {
    onActivate?.();
    setActive(true);
    setCompletedSteps([]);
  };

  const toggleStep = (index) => {
    setCompletedSteps((prev) =>
      prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index],
    );
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive"><AlertOctagon size={18} /> Panic Mode</CardTitle>
        <CardDescription>One-click emergency grounding flow with calming prompts and breathing shortcut.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertDescription className="space-y-2 text-sm">
            <p className="font-medium">If anxiety spikes suddenly:</p>
            <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
              <li>Name 5 things you can see right now.</li>
              <li>Place both feet on the floor and slow your breath.</li>
              <li>Exhale longer than inhale for 60 seconds.</li>
              <li>Message a trusted person if symptoms continue.</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="destructive" onClick={handleActivate} className="gap-2"><Siren size={16} /> Activate Panic Flow</Button>
          <Button variant="outline" onClick={() => window.open("tel:112", "_self")}>Emergency Call Shortcut</Button>
        </div>

        {active && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Immediate Coping Actions</CardTitle>
              <CardDescription>Follow these steps now. Mark each one as you complete it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{completedSteps.length}/{PANIC_COPING_ACTIONS.length} done</span>
                </div>
                <Progress value={completion} />
              </div>

              <div className="space-y-2">
                {PANIC_COPING_ACTIONS.map((action, index) => {
                  const done = completedSteps.includes(index);
                  return (
                    <Button
                      key={action}
                      type="button"
                      variant={done ? "secondary" : "outline"}
                      className="w-full justify-start min-h-12"
                      onClick={() => toggleStep(index)}
                    >
                      <CheckCircle2 size={15} className={`mr-2 ${done ? "text-primary" : "text-muted-foreground"}`} />
                      {action}
                    </Button>
                  );
                })}
              </div>

              {completedSteps.length === PANIC_COPING_ACTIONS.length && (
                <Alert>
                  <AlertDescription>
                    Great job completing the sequence. If panic stays intense, use the emergency call shortcut or contact your guardian now.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">Emergency call behavior depends on browser/device permissions.</p>
      </CardContent>
    </Card>
  );
}
