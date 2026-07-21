import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Settings2, Sun, Volume2, Users, Zap, Wind, EyeOff, Moon } from "lucide-react";

const SENSORY_CARDS = [
  {
    key: "sound",
    label: "Sound",
    icon: Volume2,
    emoji: "🔊",
    color: "bg-violet-100 dark:bg-violet-950/50 border-violet-300 dark:border-violet-700",
    barColor: "bg-violet-500",
    textColor: "text-violet-700 dark:text-violet-300",
  },
  {
    key: "light",
    label: "Light",
    icon: Sun,
    emoji: "☀️",
    color: "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700",
    barColor: "bg-amber-500",
    textColor: "text-amber-700 dark:text-amber-300",
  },
  {
    key: "crowd",
    label: "Crowd",
    icon: Users,
    emoji: "👥",
    color: "bg-pink-100 dark:bg-pink-950/50 border-pink-300 dark:border-pink-700",
    barColor: "bg-pink-500",
    textColor: "text-pink-700 dark:text-pink-300",
  },
];

const CALMING_TOOLS = [
  { label: "Deep Breathing", icon: Wind,  emoji: "🫁", feedback: "Breathe in… breathe out. You are safe. 🌿" },
  { label: "Noise Break",    icon: EyeOff, emoji: "🔇", feedback: "Find a quiet corner and be still for a moment. 🤫" },
  { label: "Dim Screen",     icon: Moon,  emoji: "🌙", feedback: "Dimming the light. Your eyes can rest now. 😌" },
];

function StatusPill({ level, score }) {
  const cfg = {
    safe:    { bg: "bg-emerald-100 dark:bg-emerald-950/50 border-emerald-400", text: "text-emerald-700 dark:text-emerald-300", label: "Safe Zone ✅" },
    caution: { bg: "bg-amber-100 dark:bg-amber-950/50 border-amber-400",    text: "text-amber-700 dark:text-amber-300",    label: "Caution Zone ⚠️" },
    high:    { bg: "bg-red-100 dark:bg-red-950/50 border-red-400",          text: "text-red-700 dark:text-red-300",          label: "High Load Zone 🆘" },
  }[level];
  return (
    <div className={`rounded-xl border-2 px-4 py-3 flex items-center justify-between ${cfg.bg}`}>
      <span className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</span>
      <span className={`font-mono font-bold text-lg ${cfg.text}`}>{score}/100</span>
    </div>
  );
}

function BreathingCircle() {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <motion.div
        className="rounded-full bg-blue-400/30 flex items-center justify-center"
        animate={{ width: [80, 140, 80], height: [80, 140, 80] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="rounded-full bg-blue-400/60 flex items-center justify-center"
          animate={{ width: [50, 100, 50], height: [50, 100, 50] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold"
            animate={{ width: [28, 64, 28], height: [28, 64, 28] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Wind size={18} />
          </motion.div>
        </motion.div>
      </motion.div>
      <p className="text-sm text-muted-foreground font-medium">Breathe with the circle</p>
    </div>
  );
}

export default function SensoryMonitor({ role, profile, loading, onSaveThresholds }) {
  const canEditThresholds = role === "guardian" || role === "admin";

  const [sound, setSound] = useState(profile?.sound_threshold ?? 60);
  const [light, setLight] = useState(profile?.light_threshold ?? 60);
  const [crowd, setCrowd] = useState(profile?.crowd_threshold ?? 50);
  const [feedback, setFeedback] = useState(null);
  const [activeTool, setActiveTool] = useState(null);

  const values = { sound, light, crowd };
  const setters = { sound: setSound, light: setLight, crowd: setCrowd };

  const sensoryScore = useMemo(() => {
    return Math.max(0, Math.min(100, Math.round((sound + light + crowd) / 3)));
  }, [sound, light, crowd]);

  const status = sensoryScore < 40 ? "safe" : sensoryScore < 70 ? "caution" : "high";

  const handleCalmingTool = (tool) => {
    setActiveTool(tool.label === activeTool ? null : tool.label);
    setFeedback(tool.feedback);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Settings2 size={20} /> Sensory Regulation Tools
        </CardTitle>
        <CardDescription>
          Tune sensory thresholds and use calming supports. Threshold editing is guardian-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading && <p className="text-sm text-muted-foreground">Loading sensory profile...</p>}

        <StatusPill level={status} score={sensoryScore} />

        {/* Sensory threshold cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SENSORY_CARDS.map(({ key, label, icon: Icon, emoji, color, barColor, textColor }) => {
            const value = values[key];
            return (
              <motion.div
                key={key}
                whileHover={{ scale: 1.02 }}
                className={`rounded-2xl border-2 p-4 space-y-3 ${color}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl" aria-hidden="true">{emoji}</span>
                  <p className={`font-semibold text-sm ${textColor}`}>{label} Sensitivity</p>
                </div>
                {/* Visual bar */}
                <div className="h-3 rounded-full bg-background/60 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${barColor}`}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <Slider
                  value={[value]}
                  max={100}
                  step={1}
                  onValueChange={(v) => setters[key](v[0])}
                  disabled={!canEditThresholds}
                />
                <p className={`text-xs font-bold text-right ${textColor}`}>{value}%</p>
              </motion.div>
            );
          })}
        </div>

        {/* Feedback toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 px-4 py-3 text-emerald-700 dark:text-emerald-300 font-medium text-sm"
            >
              {feedback}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calming tools */}
        <div className="rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-3">
          <p className="font-semibold text-blue-700 dark:text-blue-300">Calming Tools</p>
          <div className="flex flex-wrap gap-2">
            {CALMING_TOOLS.map((tool) => (
              <motion.button
                key={tool.label}
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => handleCalmingTool(tool)}
                className={`flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTool === tool.label
                    ? "bg-blue-200 dark:bg-blue-800 border-blue-400 text-blue-800 dark:text-blue-200"
                    : "bg-background/70 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                }`}
              >
                <span className="text-lg" aria-hidden="true">{tool.emoji}</span>
                {tool.label}
              </motion.button>
            ))}
          </div>

          {/* Breathing animation */}
          <AnimatePresence>
            {activeTool === "Deep Breathing" && <BreathingCircle />}
          </AnimatePresence>
        </div>

        {canEditThresholds && (
          <Button
            className="w-full gap-2"
            onClick={() => onSaveThresholds({ sound_threshold: sound, light_threshold: light, crowd_threshold: crowd })}
          >
            Save Sensory Thresholds
          </Button>
        )}

        {!canEditThresholds && (
          <Badge variant="outline">Viewer mode: threshold edits are restricted</Badge>
        )}
      </CardContent>
    </Card>
  );
}
