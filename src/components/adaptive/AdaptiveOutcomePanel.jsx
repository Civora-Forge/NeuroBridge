import { useEffect, useMemo, useState } from "react";
import { Brain, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { buildAdaptiveOutcomeModel } from "@/lib/adaptiveOutcomeEngine";

function riskVariant(level) {
  if (level === "High") return "destructive";
  if (level === "Moderate") return "secondary";
  return "outline";
}

export default function AdaptiveOutcomePanel({ targetId, title = "Adaptive Outcome Engine", compact = false }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onStorage = () => setTick((value) => value + 1);
    const timer = setInterval(() => setTick((value) => value + 1), 30000);
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const model = useMemo(() => buildAdaptiveOutcomeModel({ targetId }), [targetId, tick]);

  if (!targetId) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain size={18} /> {title}
        </CardTitle>
        <CardDescription>
          Learns from historical records to adapt interventions and predict likely outcomes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!model.hasData ? (
          <Alert>
            <AlertDescription>{model.message}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Predicted Risk Level</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={riskVariant(model.riskLevel)}>{model.riskLevel}</Badge>
                    <span className="text-sm font-medium">{model.score}/100</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Model Confidence</p>
                  <p className="text-sm font-medium mt-2">{model.confidence}%</p>
                  <Progress className="mt-2" value={model.confidence} />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Records Used</p>
                  <p className="text-sm font-medium mt-2">{model.recordsUsed} recent signals</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><TrendingUp size={16} /> Predicted Outcomes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {model.outcomes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Prediction confidence is still warming up.</p>
                )}
                {model.outcomes.map((outcome, index) => (
                  <div key={`${outcome.title}-${index}`} className="rounded-lg border p-3 bg-background/60">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="font-medium text-sm">{outcome.title}</p>
                      <Badge variant="secondary">{outcome.probability} · {outcome.horizon}</Badge>
                    </div>
                    {!compact && <p className="text-xs text-muted-foreground mt-1">{outcome.rationale}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Sparkles size={16} /> Adaptive Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {model.adaptiveActions.map((action, index) => (
                  <p key={`${action}-${index}`} className="text-sm rounded-lg border px-3 py-2 bg-background/60">• {action}</p>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </CardContent>
    </Card>
  );
}
