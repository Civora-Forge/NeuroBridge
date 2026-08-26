import { useMemo } from "react";
import { BarChart3, Clock, MapPin } from "lucide-react";
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
    return <p className="text-sm text-[#6B7BA8]">Add anxiety logs to see trend progression.</p>;
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
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-xl border border-[#C7D2FE] bg-white p-2">
        {[0, 2, 4, 6, 8, 10].map((level) => {
          const y = height - padding - (level / 10) * (height - padding * 2);
          return (
            <g key={level}>
              <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#C7D2FE" strokeDasharray="4 4" />
              <text x={10} y={y + 4} fontSize="10" fill="#6B7BA8">{level}</text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#4F6BF6" strokeWidth="3" points={points} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className="text-xs text-[#6B7BA8]">Showing recent {sorted.length} anxiety entries</p>
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
    <Card className="overflow-hidden border-[#C7D2FE] shadow-[4px_4px_0_#DDE8FC]">
      <div className="h-2 bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC]" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-[#1E2A5E]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDE8FC] text-[#4F6BF6]">
            <BarChart3 size={18} />
          </div>
          Real-Time Anxiety Tracker
        </CardTitle>
        <CardDescription className="text-[#6B7BA8]">
          Log anxiety level, triggers, location, and timestamp with local persistence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[#1E2A5E]">Anxiety Level</label>
            <Badge variant="outline" className="border-[#C7D2FE] text-[#4F6BF6] font-bold">{level}/10</Badge>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            value={level}
            onChange={(event) => setLevel(clampLevel(event.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-[#C7D2FE] accent-[#4F6BF6]"
          />
          <div className="flex justify-between text-[10px] text-[#6B7BA8]">
            <span>Calm</span>
            <span>Intense</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="relative">
            <Input
              value={trigger}
              onChange={(event) => setTrigger(event.target.value)}
              placeholder="What triggered this?"
              className="border-[#C7D2FE] text-[#1E2A5E] placeholder:text-[#6B7BA8]/60 focus:border-[#4F6BF6]"
            />
          </div>
          <div className="relative">
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Where are you?"
              className="border-[#C7D2FE] text-[#1E2A5E] placeholder:text-[#6B7BA8]/60 focus:border-[#4F6BF6]"
            />
          </div>
          <Input
            type="datetime-local"
            value={loggedAt}
            onChange={(event) => setLoggedAt(event.target.value)}
            className="md:col-span-2 border-[#C7D2FE] text-[#1E2A5E] focus:border-[#4F6BF6]"
          />
        </div>

        <Button
          onClick={onAddLog}
          className="w-full bg-[#4F6BF6] text-white hover:bg-[#3B51D4] shadow-[2px_2px_0_#C7D2FE] font-bold"
        >
          Add Anxiety Log
        </Button>

        <TrendGraph logs={logs} />

        <div className="max-h-72 overflow-auto space-y-2 pr-1">
          {logs.length === 0 && <p className="text-sm text-[#6B7BA8]">No logs yet.</p>}
          {logs.map((entry) => (
            <article key={entry.id} className="rounded-xl border border-[#C7D2FE] bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-[#1E2A5E]">Level {entry.level}/10</p>
                <Badge variant="outline" className="text-[10px] border-[#C7D2FE] text-[#6B7BA8]">
                  {getTimeWindow(entry.loggedAt)}
                </Badge>
              </div>
              <p className="text-[#6B7BA8] mt-1 flex items-center gap-1">
                <MapPin size={12} className="text-[#4F6BF6]" /> {entry.trigger}
              </p>
              {entry.location && (
                <p className="text-[#6B7BA8] text-xs">📍 {entry.location}</p>
              )}
              <p className="text-[10px] text-[#6B7BA8]/70 mt-1">{new Date(entry.loggedAt).toLocaleString()}</p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
