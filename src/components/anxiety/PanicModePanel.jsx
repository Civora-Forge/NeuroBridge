import { useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, Siren, Phone, Shield } from "lucide-react";
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
    <Card className="overflow-hidden border-[#F87171]/30 shadow-[4px_4px_0_#FEE2E2]">
      <div className="h-2 bg-gradient-to-r from-[#F87171] to-[#FBBF24]" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-[#991B1B]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#F87171]">
            <AlertOctagon size={18} />
          </div>
          Panic Mode
        </CardTitle>
        <CardDescription className="text-[#6B7BA8]">
          One-click emergency grounding flow with calming prompts and breathing shortcut.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert className="border-[#F87171]/20 bg-[#FEF2F2]">
          <Shield className="h-4 w-4 text-[#F87171]" />
          <AlertDescription className="space-y-2 text-sm">
            <p className="font-semibold text-[#991B1B]">If anxiety spikes suddenly:</p>
            <ul className="list-disc pl-4 space-y-1 text-[#6B7BA8]">
              <li>Name 5 things you can see right now.</li>
              <li>Place both feet on the floor and slow your breath.</li>
              <li>Exhale longer than inhale for 60 seconds.</li>
              <li>Message a trusted person if symptoms continue.</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            className="gap-2 bg-[#F87171] text-white hover:bg-[#DC2626] shadow-[2px_2px_0_#FEE2E2] font-bold"
            onClick={handleActivate}
          >
            <Siren size={16} /> Activate Panic Flow
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-[#F87171]/30 text-[#991B1B] hover:bg-[#FEF2F2] hover:border-[#F87171]"
            onClick={() => window.open("tel:112", "_self")}
          >
            <Phone size={16} /> Emergency Call
          </Button>
        </div>

        {active && (
          <Card className="border-[#F87171]/20 bg-[#FEF2F2] shadow-[3px_3px_0_#FEE2E2]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#991B1B]">Immediate Coping Actions</CardTitle>
              <CardDescription className="text-[#6B7BA8]">Follow these steps now. Mark each one as you complete it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-[#6B7BA8]">
                  <span>Progress</span>
                  <span className="font-medium text-[#991B1B]">{completedSteps.length}/{PANIC_COPING_ACTIONS.length} done</span>
                </div>
                <Progress value={completion} className="h-2 bg-[#FECACA] [&>[role=progressbar]]:bg-[#F87171]" />
              </div>

              <div className="space-y-2">
                {PANIC_COPING_ACTIONS.map((action, index) => {
                  const done = completedSteps.includes(index);
                  return (
                    <Button
                      key={action}
                      type="button"
                      variant={done ? "secondary" : "outline"}
                      className={`w-full justify-start min-h-12 font-medium ${
                        done
                          ? "bg-[#D1FAE5] border-[#34D399] text-[#065F46]"
                          : "border-[#FECACA] bg-white text-[#991B1B] hover:border-[#F87171] hover:bg-[#FEF2F2]"
                      }`}
                      onClick={() => toggleStep(index)}
                    >
                      <CheckCircle2 size={15} className={`mr-2 ${done ? "text-[#34D399]" : "text-[#FCA5A5]"}`} />
                      {action}
                    </Button>
                  );
                })}
              </div>

              {completedSteps.length === PANIC_COPING_ACTIONS.length && (
                <Alert className="bg-[#D1FAE5] border-[#34D399]">
                  <CheckCircle2 className="h-4 w-4 text-[#065F46]" />
                  <AlertDescription className="text-[#065F46] font-medium">
                    Great job completing the sequence. If panic stays intense, use the emergency call shortcut or contact your guardian now.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-[#6B7BA8]">Emergency call behavior depends on browser/device permissions.</p>
      </CardContent>
    </Card>
  );
}
