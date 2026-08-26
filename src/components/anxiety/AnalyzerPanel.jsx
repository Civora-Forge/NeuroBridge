import { Brain, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
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
            <span className="text-[#1E2A5E] font-medium">{item.key}</span>
            <span className="text-[#6B7BA8]">{item.average}/10 ({item.count})</span>
          </div>
          <Progress value={(item.average / maxAverage) * 100} className="h-2 bg-[#C7D2FE] [&>[role=progressbar]]:bg-[#4F6BF6]" />
        </div>
      ))}
    </div>
  );
}

function Last7DaysMiniTrend({ points }) {
  if (!points.length) return <p className="text-sm text-[#6B7BA8]">Need logs across days to display weekly trend.</p>;
  return (
    <div className="space-y-1">
      {points.map((point) => (
        <div key={point.date} className="flex items-center justify-between text-sm rounded-xl border border-[#C7D2FE] px-3 py-1.5 bg-white">
          <span className="text-[#1E2A5E] font-medium">{point.date}</span>
          <Badge variant="secondary" className="bg-[#DDE8FC] text-[#4F6BF6] border-[#C7D2FE]">{point.average}/10</Badge>
        </div>
      ))}
    </div>
  );
}

export default function AnalyzerPanel({ analytics, targetId }) {
  return (
    <div className="space-y-4">
      {targetId && <AdaptiveOutcomePanel targetId={targetId} title="Adaptive Anxiety Forecast" compact />}

      <Card className="overflow-hidden border-[#C7D2FE] shadow-[4px_4px_0_#DDE8FC]">
        <div className="h-2 bg-gradient-to-r from-[#4F6BF6] to-[#A5B4FC]" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-xl text-[#1E2A5E]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#DDE8FC] text-[#4F6BF6]">
              <Brain size={18} />
            </div>
            Trigger Pattern Analyzer
          </CardTitle>
          <CardDescription className="text-[#6B7BA8]">
            Rule-based analytics with reduce/filter/map. No external ML libraries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
              <CardContent className="pt-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6B7BA8]">Most Frequent Trigger</p>
                <p className="font-bold mt-1 break-words text-[#1E2A5E]">{analytics.mostFrequentTrigger}</p>
              </CardContent>
            </Card>
            <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
              <CardContent className="pt-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6B7BA8]">Highest Anxiety Window</p>
                <p className="font-bold mt-1 text-[#1E2A5E]">{analytics.highestAnxietyWindow}</p>
              </CardContent>
            </Card>
            <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
              <CardContent className="pt-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6B7BA8]">Weekly Average</p>
                <p className="font-bold mt-1 text-[#1E2A5E]">{analytics.weeklyAverage}/10</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[#1E2A5E] flex items-center gap-2">
                <BarChart3 size={16} className="text-[#4F6BF6]" /> Average by Time of Day
              </CardTitle>
            </CardHeader>
            <CardContent><TimeWindowBars averages={analytics.averageByTimeOfDay} /></CardContent>
          </Card>

          <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[#1E2A5E]">Top Trigger Keywords</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {analytics.topKeywords.length === 0 && <p className="text-sm text-[#6B7BA8]">Not enough data.</p>}
              {analytics.topKeywords.map((item) => (
                <Badge key={item.keyword} variant="secondary" className="bg-[#DDE8FC] text-[#4F6BF6] border-[#C7D2FE]">
                  {item.keyword} ({item.count})
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#FBBF24]/30 shadow-[2px_2px_0_#FEF3C7]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[#1E2A5E] flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#FBBF24]" /> Predicted High-Risk Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-[#FBBF24]/20 bg-[#FEFCE8]">
                <AlertDescription className="text-[#1E2A5E] font-medium">{analytics.predictedRisk}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <Card className="border-[#C7D2FE] shadow-[2px_2px_0_#DDE8FC]">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-[#1E2A5E] flex items-center gap-2">
                <TrendingUp size={16} className="text-[#4F6BF6]" /> Last 7 Day Anxiety Average
              </CardTitle>
            </CardHeader>
            <CardContent><Last7DaysMiniTrend points={analytics.last7Days} /></CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
