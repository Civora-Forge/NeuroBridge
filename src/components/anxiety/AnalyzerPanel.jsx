import { Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import AdaptiveOutcomePanel from "@/components/adaptive/AdaptiveOutcomePanel";

function TimeWindowBars({ averages }) {
  const maxAverage = Math.max(...averages.map((item) => item.average), 1);
  return (
    <div className="space-y-2">
      {averages.map((item) => (
        <div key={item.key} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span>{item.key}</span>
            <span className="text-muted-foreground">{item.average}/10 ({item.count})</span>
          </div>
          <Progress value={(item.average / maxAverage) * 100} />
        </div>
      ))}
    </div>
  );
}

function Last7DaysMiniTrend({ points }) {
  if (!points.length) return <p className="text-sm text-muted-foreground">Need logs across days to display weekly trend.</p>;
  return (
    <div className="space-y-1">
      {points.map((point) => (
        <div key={point.date} className="flex items-center justify-between text-sm rounded-lg border px-2 py-1 bg-background/60">
          <span>{point.date}</span>
          <Badge variant="secondary">{point.average}/10</Badge>
        </div>
      ))}
    </div>
  );
}

export default function AnalyzerPanel({ analytics, targetId }) {
  return (
    <div className="space-y-4">
      {targetId && <AdaptiveOutcomePanel targetId={targetId} title="Adaptive Anxiety Forecast" compact />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain size={18} /> Trigger Pattern Analyzer</CardTitle>
          <CardDescription>Rule-based analytics with reduce/filter/map. No external ML libraries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Most Frequent Trigger</p><p className="font-medium mt-1 break-words">{analytics.mostFrequentTrigger}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Highest Anxiety Window</p><p className="font-medium mt-1">{analytics.highestAnxietyWindow}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Weekly Average</p><p className="font-medium mt-1">{analytics.weeklyAverage}/10</p></CardContent></Card>
          </div>

          <Card><CardHeader><CardTitle className="text-lg">Average by Time of Day</CardTitle></CardHeader><CardContent><TimeWindowBars averages={analytics.averageByTimeOfDay} /></CardContent></Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Top Trigger Keywords</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {analytics.topKeywords.length === 0 && <p className="text-sm text-muted-foreground">Not enough data.</p>}
              {analytics.topKeywords.map((item) => <Badge key={item.keyword} variant="secondary">{item.keyword} ({item.count})</Badge>)}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle className="text-lg">Predicted High-Risk Period</CardTitle></CardHeader><CardContent><Alert><AlertDescription>{analytics.predictedRisk}</AlertDescription></Alert></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-lg">Last 7 Day Anxiety Average</CardTitle></CardHeader><CardContent><Last7DaysMiniTrend points={analytics.last7Days} /></CardContent></Card>
        </CardContent>
      </Card>
    </div>
  );
}
