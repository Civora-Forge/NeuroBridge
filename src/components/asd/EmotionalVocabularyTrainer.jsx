import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain } from "lucide-react";

const emotions = [
  { key: "happy", emoji: "🙂" },
  { key: "sad", emoji: "😔" },
  { key: "angry", emoji: "😠" },
  { key: "overwhelmed", emoji: "😵" },
  { key: "anxious", emoji: "😟" },
  { key: "calm", emoji: "😌" },
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl"><Brain size={20} /> Emotional Vocabulary Trainer</CardTitle>
        <CardDescription className="text-base">
          Build emotional labeling through daily check-ins and scenario prompts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border p-4 bg-background/50 space-y-3">
          <p className="font-medium text-lg">Daily check-in: How do you feel now?</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {emotions.map((emotion) => (
              <Button
                key={`daily-${emotion.key}`}
                variant="outline"
                className="h-14 text-base justify-start"
                onClick={() => saveSelection(emotion.key, "daily-checkin")}
              >
                <span className="text-xl mr-2" aria-hidden="true">{emotion.emoji}</span>
                {emotion.key}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border p-4 bg-background/50 space-y-3">
          <p className="font-medium text-lg">Scenario practice: How would you feel?</p>
          <p className="text-base">{activeScenario}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {emotions.map((emotion) => (
              <Button
                key={`scenario-${emotion.key}`}
                variant="outline"
                className="h-14 text-base justify-start"
                onClick={() => saveSelection(emotion.key, `scenario:${activeScenario}`)}
              >
                <span className="text-xl mr-2" aria-hidden="true">{emotion.emoji}</span>
                {emotion.key}
              </Button>
            ))}
          </div>
          <Button variant="secondary" onClick={() => setScenarioIndex((value) => value + 1)}>Next Scenario</Button>
        </div>

        <Alert>
          <AlertDescription>
            This week: <span className="font-medium">{weeklyLogs.length}</span> emotion check-ins logged.
          </AlertDescription>
        </Alert>

        {canViewTrends && (
          <div className="rounded-xl border p-4 bg-background/40 space-y-2">
            <p className="font-medium">Guardian emotion trends</p>
            <p className="text-sm text-muted-foreground">Top emotion: {trends.topEmotion} ({trends.topCount})</p>
            <p className="text-sm text-muted-foreground">Emotion variety this week: {trends.diversity} unique labels</p>
            <p className="text-sm text-muted-foreground">Calm trend: {trends.calmDelta >= 0 ? "+" : ""}{trends.calmDelta} vs previous week</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-medium">Recent emotion logs</p>
          <div className="max-h-64 overflow-auto space-y-2 pr-1">
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No emotion logs yet.</p>}
            {logs.slice(0, 8).map((log) => (
              <article key={log.id} className="rounded-xl border p-3 bg-background/40 text-sm">
                <p className="font-medium">{log.emotion_selected}</p>
                <p className="text-muted-foreground line-clamp-2">{log.context}</p>
                <Badge variant="outline" className="mt-1">{new Date(log.timestamp).toLocaleDateString()}</Badge>
              </article>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
