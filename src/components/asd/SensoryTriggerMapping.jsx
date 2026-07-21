import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Ear, Lightbulb, TrendingUp } from "lucide-react";

const triggerOptions = ["noise", "light", "crowd", "touch", "smell", "temperature"];
const environmentOptions = ["home", "school", "public", "hospital", "transport"];

export default function SensoryTriggerMapping({ role, logs, onLogTrigger }) {
  const canViewGuardianSummary = role === "guardian" || role === "admin";

  const [triggerType, setTriggerType] = useState("noise");
  const [environment, setEnvironment] = useState("home");
  const [intensity, setIntensity] = useState(5);
  const [stressLevel, setStressLevel] = useState(5);

  const weeklyLogs = useMemo(
    () => logs.filter((log) => Date.now() - new Date(log.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000),
    [logs],
  );

  const repeatedHighTriggers = useMemo(() => {
    const high = weeklyLogs.filter((log) => Number(log.intensity) >= 8);
    const grouped = high.reduce((acc, item) => {
      acc[item.trigger_type] = (acc[item.trigger_type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1]);
  }, [weeklyLogs]);

  const trendInsights = useMemo(() => {
    if (weeklyLogs.length === 0) {
      return [];
    }

    const byTrigger = weeklyLogs.reduce((acc, row) => {
      const key = row.trigger_type;
      if (!acc[key]) {
        acc[key] = { totalIntensity: 0, totalStress: 0, count: 0 };
      }
      acc[key].totalIntensity += Number(row.intensity) || 0;
      acc[key].totalStress += Number(row.stress_level) || 0;
      acc[key].count += 1;
      return acc;
    }, {});

    return Object.entries(byTrigger)
      .map(([name, value]) => ({
        name,
        avgIntensity: (value.totalIntensity / value.count).toFixed(1),
        avgStress: (value.totalStress / value.count).toFixed(1),
        count: value.count,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 4);
  }, [weeklyLogs]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl"><Ear size={20} /> Sensory Trigger Mapping</CardTitle>
        <CardDescription className="text-base">
          Log triggers and track weekly sensory patterns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Trigger Type</p>
            <select value={triggerType} onChange={(event) => setTriggerType(event.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-base">
              {triggerOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Environment</p>
            <select value={environment} onChange={(event) => setEnvironment(event.target.value)} className="w-full h-10 rounded-md border bg-background px-3 text-base">
              {environmentOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Intensity (1–10)</p>
            <Slider value={[intensity]} max={10} min={1} step={1} onValueChange={(value) => setIntensity(value[0])} />
            <p className="text-xs text-muted-foreground">{intensity}</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Mood Impact (1–10)</p>
            <Slider value={[stressLevel]} max={10} min={1} step={1} onValueChange={(value) => setStressLevel(value[0])} />
            <p className="text-xs text-muted-foreground">{stressLevel}</p>
          </div>
        </div>

        <Button
          className="text-base"
          onClick={() =>
            onLogTrigger?.({
              trigger_type: triggerType,
              intensity,
              environment,
              stress_level: stressLevel,
              timestamp: new Date().toISOString(),
            })
          }
        >
          Log Trigger
        </Button>

        <Alert>
          <AlertDescription>
            Weekly logs: <span className="font-medium">{weeklyLogs.length}</span>
          </AlertDescription>
        </Alert>

        {repeatedHighTriggers.length > 0 && (
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              Repeated high-intensity triggers: {repeatedHighTriggers.map(([type, count]) => `${type} (${count})`).join(", ")}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <p className="font-medium flex items-center gap-2"><TrendingUp size={16} /> Trend Insights</p>
          {trendInsights.length === 0 && <p className="text-sm text-muted-foreground">Not enough data yet for trend insights.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {trendInsights.map((insight) => (
              <article key={insight.name} className="rounded-xl border p-3 bg-background/40 text-sm">
                <p className="font-medium capitalize">{insight.name}</p>
                <p className="text-muted-foreground">Avg intensity: {insight.avgIntensity}</p>
                <p className="text-muted-foreground">Avg mood impact: {insight.avgStress}</p>
                <Badge variant="outline" className="mt-1">{insight.count} logs</Badge>
              </article>
            ))}
          </div>
        </div>

        {canViewGuardianSummary && (
          <div className="rounded-xl border p-3 bg-background/40 space-y-2">
            <p className="font-medium">Guardian summary</p>
            <p className="text-sm text-muted-foreground">Top stress context this week: {trendInsights[0]?.name || "N/A"}</p>
            <p className="text-sm text-muted-foreground">High-intensity repeats: {repeatedHighTriggers.length}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-medium">Recent sensory logs</p>
          <div className="max-h-64 overflow-auto space-y-2 pr-1">
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No sensory logs yet.</p>}
            {logs.slice(0, 8).map((log) => (
              <article key={log.id} className="rounded-xl border p-3 bg-background/40 text-sm">
                <p className="font-medium capitalize">{log.trigger_type} · {log.environment}</p>
                <p className="text-muted-foreground">Intensity {log.intensity}/10 · Mood impact {log.stress_level}/10</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
