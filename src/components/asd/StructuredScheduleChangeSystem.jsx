import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { RefreshCcw } from "lucide-react";

const changeTypes = [
  "Small delay (5–10 mins)",
  "Task order swap",
  "Activity replacement",
  "Activity cancellation",
];

const reassuringMessages = [
  "It is okay. We can do changes safely.",
  "One step at a time. You are doing great.",
  "Plan changed, but support stays with you.",
];

export default function StructuredScheduleChangeSystem({
  role,
  routines,
  scheduleChanges,
  onCreateScheduleChange,
  onSaveReaction,
}) {
  const canConfigure = role === "guardian" || role === "admin";

  const [changeType, setChangeType] = useState(changeTypes[0]);
  const [originalActivity, setOriginalActivity] = useState(routines[0]?.title || "");
  const [newActivity, setNewActivity] = useState(routines[1]?.title || "");
  const [intensityLevel, setIntensityLevel] = useState(3);
  const [countdown, setCountdown] = useState(300);
  const [running, setRunning] = useState(false);
  const [animationOn, setAnimationOn] = useState(true);
  const [reactionDraft, setReactionDraft] = useState(5);

  useEffect(() => {
    if (!running) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          setRunning(false);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [running]);

  const startPractice = async () => {
    if (!originalActivity.trim()) {
      return;
    }
    setCountdown(300);
    setRunning(true);

    await onCreateScheduleChange?.({
      change_type: changeType,
      original_activity: originalActivity.trim(),
      new_activity: newActivity.trim() || "No replacement",
      intensity_level: intensityLevel,
      reaction_level: null,
      timestamp: new Date().toISOString(),
    });
  };

  const topMessage = useMemo(() => reassuringMessages[intensityLevel % reassuringMessages.length], [intensityLevel]);
  const progress = Math.round(((300 - countdown) / 300) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl"><RefreshCcw size={20} /> Structured Schedule Change</CardTitle>
        <CardDescription className="text-base">
          Gentle flexibility practice with a 5-minute visual pre-change countdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border p-4 bg-background/50 space-y-3">
          <p className="font-medium text-lg">Flexibility Practice Mode</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Change type</p>
              <select
                value={changeType}
                onChange={(event) => setChangeType(event.target.value)}
                disabled={!canConfigure}
                className="w-full h-11 rounded-md border bg-background px-3 text-base"
              >
                {changeTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Intensity (1-10)</p>
              <Input
                type="number"
                min={1}
                max={10}
                value={intensityLevel}
                disabled={!canConfigure}
                onChange={(event) => setIntensityLevel(Math.max(1, Math.min(10, Number(event.target.value) || 3)))}
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Original activity</p>
              <Input
                value={originalActivity}
                disabled={!canConfigure}
                onChange={(event) => setOriginalActivity(event.target.value)}
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">New activity</p>
              <Input
                value={newActivity}
                disabled={!canConfigure}
                onChange={(event) => setNewActivity(event.target.value)}
                className="text-base"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border p-3 bg-background/40">
            <Switch checked={animationOn} onCheckedChange={setAnimationOn} />
            <span className="text-sm">Calming animation</span>
          </div>

          {canConfigure && <Button className="text-base" onClick={startPractice}>Start 5-minute Change Practice</Button>}
        </div>

        <motion.div
          animate={animationOn && running ? { opacity: [0.85, 1, 0.85] } : { opacity: 1 }}
          transition={{ repeat: animationOn && running ? Infinity : 0, duration: 2.8 }}
          className="rounded-xl border p-4 bg-background/40 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 bg-muted/30 text-muted-foreground">
              <p className="text-xs">Old Plan</p>
              <p className="text-base line-through opacity-70">{originalActivity || "No original activity"}</p>
            </div>
            <div className="rounded-lg border p-3 bg-background">
              <p className="text-xs">New Plan</p>
              <p className="text-base font-semibold">{newActivity || "No replacement"}</p>
            </div>
          </div>

          <p className="text-lg font-medium">{topMessage}</p>

          <div className="flex items-center justify-between">
            <Badge variant={running ? "secondary" : "outline"}>{running ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}` : "Idle"}</Badge>
            <span className="text-sm text-muted-foreground">5-minute countdown</span>
          </div>
          <Progress value={running ? progress : 0} className="h-5" />
        </motion.div>

        {(role === "guardian" || role === "admin") && (
          <div className="rounded-xl border p-4 bg-background/50 space-y-2">
            <p className="font-medium">Guardian reaction logging</p>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={1}
                max={10}
                value={reactionDraft}
                onChange={(event) => setReactionDraft(Math.max(1, Math.min(10, Number(event.target.value) || 5)))}
                className="w-24"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const latest = scheduleChanges[0];
                  if (!latest) {
                    return;
                  }
                  onSaveReaction?.(latest.id, reactionDraft);
                }}
              >
                Save Reaction
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-medium">Recent schedule change logs</p>
          <div className="max-h-64 overflow-auto space-y-2 pr-1">
            {scheduleChanges.length === 0 && <p className="text-sm text-muted-foreground">No schedule change logs yet.</p>}
            {scheduleChanges.slice(0, 8).map((item) => (
              <article key={item.id} className="rounded-xl border p-3 bg-background/40 text-sm">
                <p className="font-medium">{item.change_type}</p>
                <p className="text-muted-foreground">{item.original_activity} → {item.new_activity}</p>
                <p className="text-muted-foreground">Intensity {item.intensity_level}/10{item.reaction_level ? ` · Reaction ${item.reaction_level}/10` : ""}</p>
                <p className="text-xs text-muted-foreground mt-1">{new Date(item.timestamp).toLocaleString()}</p>
              </article>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
