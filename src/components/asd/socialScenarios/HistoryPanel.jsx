import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Flame, Star, Trophy } from "lucide-react";
import { DIFFICULTY_TONE } from "./tones";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function HistoryPanel({ sessions = [], onBack }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Practice history</h2>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-emerald-100">
          <CardContent className="pt-6 text-center text-sm text-slate-500">
            No sessions yet. Complete a scenario to see your history here.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[420px]">
          <div className="space-y-3 pr-2">
            {sessions.map((session) => (
              <Card key={session.id} className="border-emerald-100">
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base text-slate-900">{session.title}</CardTitle>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(session.completedAt)} · {session.turnCount} replies
                      </p>
                    </div>
                    {session.abandoned ? (
                      <Badge className="border-transparent bg-slate-100 text-slate-500">exited early</Badge>
                    ) : (
                      <span className="flex items-center gap-1 font-bold text-emerald-600">
                        <Star className="h-4 w-4 fill-current" />
                        {session.score ?? "—"}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge className={DIFFICULTY_TONE[session.difficulty] ?? "bg-slate-100 text-slate-600"}>
                      {session.difficulty}
                    </Badge>
                    {session.strengths?.slice(0, 1).map((strength) => (
                      <span key={strength} className="text-slate-500 italic">
                        {strength}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

export function StatsRow({ completedCount, averageScore, streak }) {
  const stats = [
    { label: "Completed", value: completedCount, icon: Trophy, tone: "text-green-600" },
    { label: "Average score", value: averageScore ?? "—", icon: Star, tone: "text-amber-500" },
    { label: "Day streak", value: streak?.current ?? 0, icon: Flame, tone: "text-orange-500" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="border-emerald-100 bg-white">
          <CardContent className="flex flex-col items-center gap-1 p-4">
            <Icon className={`h-5 w-5 ${tone}`} />
            <span className="text-2xl font-black text-slate-900">{value}</span>
            <span className="text-xs text-slate-500">{label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
