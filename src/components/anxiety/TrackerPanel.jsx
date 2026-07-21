import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { clampLevel, getTimeWindow } from "./anxietyUtils";

function TrendGraph({ logs }) {
  const sorted = useMemo(
    () => [...logs].sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()).slice(-16),
    [logs],
  );

  if (!sorted.length) {
    return <p className="text-sm text-muted-foreground">Add anxiety logs to see trend progression.</p>;
  }

  const width = 620;
  const height = 230;
  const padding = 30;
  const step = sorted.length > 1 ? (width - padding * 2) / (sorted.length - 1) : 0;

  const points = sorted
    .map((entry, index) => {
      const x = padding + index * step;
      const y = height - padding - (entry.level / 10) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-xl border bg-background/60 p-2">
        {[0, 2, 4, 6, 8, 10].map((level) => {
          const y = height - padding - (level / 10) * (height - padding * 2);
          return (
            <g key={level}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="hsl(var(--border))" strokeDasharray="4 4" />
              <text x={10} y={y + 4} fontSize="10" fill="hsl(var(--muted-foreground))">{level}</text>
            </g>
          );
        })}
        <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="3" points={points} />
      </svg>
      <p className="text-xs text-muted-foreground">Showing recent {sorted.length} anxiety entries</p>
    </div>
  );
}

export default function TrackerPanel({
  level,
  setLevel,
  trigger,
  setTrigger,
  location,
  setLocation,
  loggedAt,
  setLoggedAt,
  logs,
  onAddLog,
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 size={18} /> Real-Time Anxiety Tracker</CardTitle>
        <CardDescription>Log anxiety level, triggers, location, and timestamp with local persistence.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Anxiety Level</label>
            <Badge variant="outline">{level}/10</Badge>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            value={level}
            onChange={(event) => setLevel(clampLevel(event.target.value))}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input value={trigger} onChange={(event) => setTrigger(event.target.value)} placeholder="Trigger (required)" />
          <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location (optional)" />
          <Input type="datetime-local" value={loggedAt} onChange={(event) => setLoggedAt(event.target.value)} className="md:col-span-2" />
        </div>

        <Button onClick={onAddLog}>Add Anxiety Log</Button>
        <TrendGraph logs={logs} />

        <div className="max-h-72 overflow-auto space-y-2 pr-1">
          {logs.length === 0 && <p className="text-sm text-muted-foreground">No logs yet.</p>}
          {logs.map((entry) => (
            <article key={entry.id} className="rounded-xl border p-3 bg-background/40 text-sm">
              <p className="font-medium">Level {entry.level}/10 · {getTimeWindow(entry.loggedAt)}</p>
              <p className="text-muted-foreground mt-1">Trigger: {entry.trigger}</p>
              <p className="text-muted-foreground">Location: {entry.location}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(entry.loggedAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
