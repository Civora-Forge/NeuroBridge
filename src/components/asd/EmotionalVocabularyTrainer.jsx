import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Sparkles } from "lucide-react";

const emotions = [
  { key: "happy", emoji: "😊", color: "border-amber-300 hover:bg-amber-50 hover:border-amber-500" },
  { key: "sad", emoji: "😢", color: "border-blue-300 hover:bg-blue-50 hover:border-blue-500" },
  { key: "angry", emoji: "😠", color: "border-red-300 hover:bg-red-50 hover:border-red-500" },
  { key: "overwhelmed", emoji: "😵", color: "border-purple-300 hover:bg-purple-50 hover:border-purple-500" },
  { key: "anxious", emoji: "😟", color: "border-orange-300 hover:bg-orange-50 hover:border-orange-500" },
  { key: "calm", emoji: "😌", color: "border-emerald-300 hover:bg-emerald-50 hover:border-emerald-500" },
];

const scenarios = [
  "The classroom is louder than expected.",
  "A favorite plan changed suddenly.",
  "Someone new wants to talk during break.",
  "You finished a hard task successfully.",
  "The waiting line is longer than expected.",
];

export default function EmotionalVocabularyTrainer({ role, logs, onLogEmotion }) {
  const canViewTrends = role === "guardian" || role === "admin";
  const [scenarioIndex, setScenarioIndex] = useState(0);

  const weeklyLogs = useMemo(
    () => logs.filter((item) => Date.now() - new Date(item.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000),
    [logs],
  );

  const previousWeeklyLogs = useMemo(
    () =>
      logs.filter((item) => {
        const age = Date.now() - new Date(item.timestamp).getTime();
        return age > 7 * 24 * 60 * 60 * 1000 && age <= 14 * 24 * 60 * 60 * 1000;
      }),
    [logs],
  );

  const trends = useMemo(() => {
    const byEmotion = weeklyLogs.reduce((acc, item) => {
      acc[item.emotion_selected] = (acc[item.emotion_selected] || 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(byEmotion).sort((left, right) => right[1] - left[1])[0];
    const diversity = Object.keys(byEmotion).length;
    const calmNow = weeklyLogs.filter((item) => item.emotion_selected === "calm").length;
    const calmBefore = previousWeeklyLogs.filter((item) => item.emotion_selected === "calm").length;
    return {
      topEmotion: top?.[0] || "n/a",
      topCount: top?.[1] || 0,
      diversity,
      calmDelta: calmNow - calmBefore,
    };
  }, [weeklyLogs, previousWeeklyLogs]);

  const activeScenario = scenarios[scenarioIndex % scenarios.length];

  const saveSelection = (emotion, context) => {
    onLogEmotion?.({
      emotion_selected: emotion,
      context,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <Card className="overflow-hidden border-[#B2DFDB] shadow-[4px_4px_0_#D5F5EC]">
      <div className="h-2 bg-gradient-to-r from-[#0D9488] to-[#5EEAD4]" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-[#134E4A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D5F5EC] text-[#0D9488]">
            <Brain size={18} />
          </div>
          Emotional Vocabulary Trainer
        </CardTitle>
        <CardDescription className="text-[#5F8A87]">
          Build emotional labeling through daily check-ins and scenario prompts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Daily Check-in */}
        <div className="rounded-2xl border border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-3">
          <p className="font-semibold text-[#134E4A] text-lg">Daily check-in: How do you feel now?</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {emotions.map((emotion) => (
              <Button
                key={`daily-${emotion.key}`}
                variant="outline"
                className={`h-16 text-base justify-start font-medium border-2 ${emotion.color} text-[#134E4A] shadow-[2px_2px_0_#D5F5EC] transition-all hover:shadow-[3px_3px_0_#B2DFDB] hover:-translate-y-0.5`}
                onClick={() => saveSelection(emotion.key, "daily-checkin")}
              >
                <span className="text-2xl mr-2" aria-hidden="true">{emotion.emoji}</span>
                {emotion.key}
              </Button>
            ))}
          </div>
        </div>

        {/* Scenario Practice */}
        <div className="rounded-2xl border border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[#134E4A] text-lg">Scenario practice</p>
            <Badge variant="secondary" className="bg-[#E0F5EE] text-[#0D9488] border-[#B2DFDB]">Practice</Badge>
          </div>
          <div className="rounded-xl border border-[#B2DFDB] bg-white p-3">
            <p className="text-base text-[#134E4A] font-medium">{activeScenario}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {emotions.map((emotion) => (
              <Button
                key={`scenario-${emotion.key}`}
                variant="outline"
                className={`h-16 text-base justify-start font-medium border-2 ${emotion.color} text-[#134E4A] shadow-[2px_2px_0_#D5F5EC] transition-all hover:shadow-[3px_3px_0_#B2DFDB] hover:-translate-y-0.5`}
                onClick={() => saveSelection(emotion.key, `scenario:${activeScenario}`)}
              >
                <span className="text-2xl mr-2" aria-hidden="true">{emotion.emoji}</span>
                {emotion.key}
              </Button>
            ))}
          </div>
          <Button
            variant="secondary"
            className="bg-[#E0F5EE] text-[#0D9488] hover:bg-[#D5F5EC] border border-[#B2DFDB] font-semibold"
            onClick={() => setScenarioIndex((value) => value + 1)}
          >
            Next Scenario
          </Button>
        </div>

        {/* Weekly Summary */}
        <Alert className="border-[#B2DFDB] bg-[#E0F5EE]/50">
          <Sparkles className="h-4 w-4 text-[#0D9488]" />
          <AlertDescription className="text-[#134E4A]">
            This week: <span className="font-bold">{weeklyLogs.length}</span> emotion check-ins logged.
          </AlertDescription>
        </Alert>

        {canViewTrends && (
          <div className="rounded-2xl border border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-2">
            <p className="font-semibold text-[#134E4A]">Guardian emotion trends</p>
            <p className="text-sm text-[#5F8A87]">Top emotion: <span className="font-medium text-[#134E4A]">{trends.topEmotion}</span> ({trends.topCount})</p>
            <p className="text-sm text-[#5F8A87]">Emotion variety this week: <span className="font-medium text-[#134E4A]">{trends.diversity}</span> unique labels</p>
            <p className="text-sm text-[#5F8A87]">Calm trend: <span className={`font-medium ${trends.calmDelta >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>{trends.calmDelta >= 0 ? "+" : ""}{trends.calmDelta}</span> vs previous week</p>
          </div>
        )}

        {/* Recent Logs */}
        <div className="space-y-2">
          <p className="font-semibold text-[#134E4A]">Recent emotion logs</p>
          <div className="max-h-64 overflow-auto space-y-2 pr-1">
            {logs.length === 0 && <p className="text-sm text-[#5F8A87]">No emotion logs yet.</p>}
            {logs.slice(0, 8).map((log) => (
              <article key={log.id} className="rounded-xl border border-[#B2DFDB] bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#134E4A]">{log.emotion_selected}</p>
                  <Badge variant="outline" className="text-[10px] border-[#B2DFDB] text-[#5F8A87]">
                    {new Date(log.timestamp).toLocaleDateString()}
                  </Badge>
                </div>
                <p className="text-[#5F8A87] line-clamp-2 mt-1">{log.context}</p>
              </article>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
