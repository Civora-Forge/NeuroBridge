import { Card } from "@/components/ui/card";
import { Activity, Brain, Leaf } from "lucide-react";

const trend = [
  { day: "Mon", mood: 68 },
  { day: "Tue", mood: 64 },
  { day: "Wed", mood: 59 },
  { day: "Thu", mood: 62 },
  { day: "Fri", mood: 57 },
  { day: "Sat", mood: 61 },
  { day: "Sun", mood: 65 },
];

export default function SupportDashboard() {
  const dropAlert = trend.some((item) => item.mood < 58);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Support Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Emotional trends, check-in summaries, and risk alerts.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-green-600"><Activity className="h-4 w-4" /> Emotional Trend</div>
          <p className="mt-3 text-2xl font-bold">Stable</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-green-600"><Brain className="h-4 w-4" /> Weekly Check-ins</div>
          <p className="mt-3 text-2xl font-bold">12</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-green-600"><Leaf className="h-4 w-4" /> Active Alerts</div>
          <p className="mt-3 text-2xl font-bold">{dropAlert ? 1 : 0}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Emotional Trend Graph</h2>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {trend.map((item) => (
            <div key={item.day} className="flex flex-col items-center gap-2">
              <div className="h-28 w-8 rounded bg-green-100">
                <div className="w-full rounded bg-green-500" style={{ height: `${item.mood}%` }} />
              </div>
              <span className="text-xs text-slate-500">{item.day}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Check-in Summaries</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>• Morning stress reduced after breathing session.</li>
          <li>• Afternoon focus improved with timed task blocks.</li>
          <li>• Evening reflection logged consistently for 4 days.</li>
        </ul>
      </Card>

      {dropAlert && (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Alert: mood trend dropped below threshold. Please review recent check-ins.
        </Card>
      )}
    </div>
  );
}
