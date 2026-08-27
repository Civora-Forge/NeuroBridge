import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { RefreshCcw, Clock, ArrowRight } from "lucide-react";

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
    if (!running) return;
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
    if (!originalActivity.trim()) return;
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
    <Card className="overflow-hidden border-[#B2DFDB] shadow-[4px_4px_0_#D5F5EC]">
      <div className="h-2 bg-gradient-to-r from-[#0D9488] to-[#5EEAD4]" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl text-[#134E4A]">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D5F5EC] text-[#0D9488]">
            <RefreshCcw size={18} />
          </div>
          Structured Schedule Change
        </CardTitle>
        <CardDescription className="text-[#5F8A87]">
          Gentle flexibility practice with a 5-minute visual pre-change countdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-3">
          <p className="font-semibold text-[#134E4A] text-lg">Flexibility Practice Mode</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#134E4A]">Change type</p>
              <select
                value={changeType}
                onChange={(event) => setChangeType(event.target.value)}
                disabled={!canConfigure}
                className="w-full h-11 rounded-xl border border-[#B2DFDB] bg-white px-3 text-base text-[#134E4A] focus:border-[#0D9488] focus:ring-[#D5F5EC] disabled:opacity-60"
              >
                {changeTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#134E4A]">Intensity (1-10)</p>
              <Input
                type="number"
                min={1}
                max={10}
                value={intensityLevel}
                disabled={!canConfigure}
                onChange={(event) => setIntensityLevel(Math.max(1, Math.min(10, Number(event.target.value) || 3)))}
                className="text-base border-[#B2DFDB] focus:border-[#0D9488]"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#134E4A]">Original activity</p>
              <Input
                value={originalActivity}
                disabled={!canConfigure}
                onChange={(event) => setOriginalActivity(event.target.value)}
                className="text-base border-[#B2DFDB] focus:border-[#0D9488]"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#134E4A]">New activity</p>
              <Input
                value={newActivity}
                disabled={!canConfigure}
                onChange={(event) => setNewActivity(event.target.value)}
                className="text-base border-[#B2DFDB] focus:border-[#0D9488]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-[#B2DFDB] bg-white px-4 py-3">
            <Switch checked={animationOn} onCheckedChange={setAnimationOn} />
            <span className="text-sm font-medium text-[#134E4A]">Calming animation</span>
          </div>

          {canConfigure && (
            <Button
              className="w-full bg-[#0D9488] text-white hover:bg-[#0F766E] shadow-[2px_2px_0_#B2DFDB] font-bold"
              onClick={startPractice}
            >
              <Clock size={16} className="mr-1.5" /> Start 5-minute Change Practice
            </Button>
          )}
        </div>

        {/* Countdown Display */}
        <motion.div
          animate={animationOn && running ? { opacity: [0.85, 1, 0.85] } : { opacity: 1 }}
          transition={{ repeat: animationOn && running ? Infinity : 0, duration: 2.8 }}
          className="rounded-2xl border-2 border-[#0D9488] bg-[#E0F5EE] p-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#B2DFDB] bg-white/60 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5F8A87]">Old Plan</p>
              <p className="text-base line-through opacity-60 text-[#134E4A]">{originalActivity || "No original activity"}</p>
            </div>
            <div className="rounded-xl border border-[#0D9488] bg-white p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#0D9488]">New Plan</p>
              <p className="text-base font-bold text-[#134E4A]">{newActivity || "No replacement"}</p>
            </div>
          </div>

          <p className="text-lg font-bold text-[#0D9488]">{topMessage}</p>

          <div className="flex items-center justify-between">
            <Badge variant={running ? "default" : "outline"} className={running ? "bg-[#0D9488] text-white" : "border-[#B2DFDB] text-[#5F8A87]"}>
              {running ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}` : "Idle"}
            </Badge>
            <span className="text-sm text-[#5F8A87]">5-minute countdown</span>
          </div>
          <Progress value={running ? progress : 0} className="h-3 bg-[#B2DFDB] [&>[role=progressbar]]:bg-[#0D9488]" />
        </motion.div>

        {canConfigure && (
          <div className="rounded-2xl border border-[#B2DFDB] bg-[#F0FAF7] p-4 space-y-2">
            <p className="font-semibold text-[#134E4A]">Guardian reaction logging</p>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={1}
                max={10}
                value={reactionDraft}
                onChange={(event) => setReactionDraft(Math.max(1, Math.min(10, Number(event.target.value) || 5)))}
                className="w-24 border-[#B2DFDB] focus:border-[#0D9488]"
              />
              <Button
                variant="outline"
                className="border-[#B2DFDB] text-[#5F8A87] hover:text-[#0D9488] hover:border-[#0D9488]"
                onClick={() => {
                  const latest = scheduleChanges[0];
                  if (!latest) return;
                  onSaveReaction?.(latest.id, reactionDraft);
                }}
              >
                Save Reaction
              </Button>
            </div>
          </div>
        )}

        {/* Schedule Change History */}
        <div className="space-y-2">
          <p className="font-semibold text-[#134E4A]">Recent schedule change logs</p>
          <div className="max-h-64 overflow-auto space-y-2 pr-1">
            {scheduleChanges.length === 0 && <p className="text-sm text-[#5F8A87]">No schedule change logs yet.</p>}
            {scheduleChanges.slice(0, 8).map((item) => (
              <article key={item.id} className="rounded-xl border border-[#B2DFDB] bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#134E4A]">{item.change_type}</p>
                  <p className="text-xs text-[#5F8A87]">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[#5F8A87]">
                  <span className="line-through opacity-60">{item.original_activity}</span>
                  <ArrowRight size={12} className="text-[#0D9488]" />
                  <span className="font-medium text-[#134E4A]">{item.new_activity}</span>
                </div>
                <p className="text-xs text-[#5F8A87] mt-1">
                  Intensity {item.intensity_level}/10{item.reaction_level ? ` · Reaction ${item.reaction_level}/10` : ""}
                </p>
              </article>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
