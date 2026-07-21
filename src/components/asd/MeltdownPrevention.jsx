import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Heart, ShieldCheck, Siren, Waves } from "lucide-react";

const COPING_STEPS = [
  { id: 1, emoji: "🌿", title: "Find a Quiet Space",  text: "Move to a quieter area for 3–5 minutes. You are safe here.",        color: "bg-teal-100 dark:bg-teal-950/50 border-teal-300 dark:border-teal-700",   accent: "bg-teal-500",   text2: "text-teal-700 dark:text-teal-300"   },
  { id: 2, emoji: "🫁", title: "Deep Breathing",      text: "Breathe in slowly for 4 counts, hold for 2, out for 6.",             color: "bg-blue-100 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700",   accent: "bg-blue-500",   text2: "text-blue-700 dark:text-blue-300"   },
  { id: 3, emoji: "💧", title: "Hydrate",             text: "Have a sip of water. Your body feels calmer when hydrated.",         color: "bg-cyan-100 dark:bg-cyan-950/50 border-cyan-300 dark:border-cyan-700",   accent: "bg-cyan-500",   text2: "text-cyan-700 dark:text-cyan-300"   },
  { id: 4, emoji: "🙌", title: "Low-Demand Task",     text: "Try one small, easy task. Just one step at a time.",               color: "bg-violet-100 dark:bg-violet-950/50 border-violet-300 dark:border-violet-700", accent: "bg-violet-500", text2: "text-violet-700 dark:text-violet-300" },
];

const REASSURING_MESSAGES = [
  "You are doing so well! 💙",
  "Great job taking care of yourself. 🌸",
  "One step at a time — you've got this! ⭐",
  "You are safe. You are strong. 💚",
];

const RISK_CONFIG = {
  low:      { bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400", text: "text-emerald-700 dark:text-emerald-300", label: "Stable 🟢",     icon: ShieldCheck },
  moderate: { bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-400",      text: "text-amber-700 dark:text-amber-300",      label: "Moderate ⚠️",   icon: Waves       },
  high:     { bg: "bg-red-50 dark:bg-red-950/30 border-red-400",            text: "text-red-700 dark:text-red-300",            label: "High Alert 🆘", icon: Siren       },
};

export default function MeltdownPrevention({ role, routines, sensoryProfile, meltdownLogs, onCreateMeltdownLog }) {
  const [isCopingMode, setIsCopingMode] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [feedback, setFeedback] = useState(null);

  const riskData = useMemo(() => {
    const incomplete = routines.filter((t) => !t.is_completed).length;
    const thresholdLoad = [
      sensoryProfile?.sound_threshold ?? 60,
      sensoryProfile?.light_threshold ?? 60,
      sensoryProfile?.crowd_threshold ?? 50,
    ].reduce((sum, v) => sum + v, 0) / 3;
    let risk = 10;
    risk += Math.min(40, incomplete * 5);
    risk += thresholdLoad > 70 ? 25 : thresholdLoad > 60 ? 12 : 0;
    const level = risk < 35 ? "low" : risk < 65 ? "moderate" : "high";
    return { risk: Math.min(100, Math.round(risk)), level };
  }, [routines, sensoryProfile]);

  const riskCfg = RISK_CONFIG[riskData.level];
  const RiskIcon = riskCfg.icon;

  const startCoping = () => {
    setIsCopingMode(true);
    setCompletedSteps([]);
    setCurrentStep(0);
    setFeedback(null);
  };

  const exitCoping = () => {
    setIsCopingMode(false);
    setCompletedSteps([]);
    setCurrentStep(0);
    setFeedback(null);
  };

  const handleCompleteStep = (step) => {
    if (completedSteps.includes(step.id)) return;
    const next = [...completedSteps, step.id];
    setCompletedSteps(next);
    const msg = REASSURING_MESSAGES[next.length % REASSURING_MESSAGES.length];
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
    if (currentStep < COPING_STEPS.length - 1) {
      setCurrentStep((p) => p + 1);
    }
  };

  const allDone = completedSteps.length === COPING_STEPS.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Waves size={20} /> Meltdown Prevention System
        </CardTitle>
        <CardDescription>
          Risk awareness and calming workflow. Guardians can review meltdown logs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Risk indicator */}
        <div className={`rounded-2xl border-2 p-4 flex items-center justify-between ${riskCfg.bg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${riskData.level === "high" ? "bg-red-500" : riskData.level === "moderate" ? "bg-amber-500" : "bg-emerald-500"}`}>
              <RiskIcon size={20} />
            </div>
            <div>
              <p className={`font-bold text-base ${riskCfg.text}`}>{riskCfg.label}</p>
              <p className="text-xs text-muted-foreground">Current risk score</p>
            </div>
          </div>
          <span className={`font-mono font-bold text-2xl ${riskCfg.text}`}>{riskData.risk}/100</span>
        </div>

        {/* Risk bar */}
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${riskData.level === "high" ? "bg-red-500" : riskData.level === "moderate" ? "bg-amber-400" : "bg-emerald-500"}`}
            initial={{ width: 0 }}
            animate={{ width: `${riskData.risk}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            className="gap-2 rounded-xl h-11 px-5"
            variant={isCopingMode ? "secondary" : "default"}
            onClick={isCopingMode ? exitCoping : startCoping}
          >
            <Waves size={16} /> {isCopingMode ? "Exit Coping Plan" : "Start Coping Plan"}
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-xl h-11"
            onClick={() => onCreateMeltdownLog({
              event_type: "early-warning",
              notes: `User triggered coping mode: ${new Date().toLocaleString()}`,
              risk_level: riskData.level,
            })}
          >
            <Siren size={16} /> Log Early Warning
          </Button>
        </div>

        {/* Coping plan */}
        <AnimatePresence>
          {isCopingMode && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 pt-1">
                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Coping Steps</p>

                {/* Feedback message */}
                <AnimatePresence>
                  {feedback && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 px-4 py-3 text-center"
                    >
                      <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-base">{feedback}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {COPING_STEPS.map((step, index) => {
                  const isDone = completedSteps.includes(step.id);
                  const isCurrent = !isDone && index === currentStep;
                  return (
                    <motion.div
                      key={step.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className={`rounded-2xl border-2 p-4 flex items-center gap-4 transition-all ${
                        isDone
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600"
                          : isCurrent
                          ? `${step.color} ring-2 ring-offset-2 ring-blue-400/60`
                          : "bg-muted/30 border-transparent opacity-60"
                      }`}
                    >
                      {/* Step number / check */}
                      <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-lg ${isDone ? "bg-emerald-500" : step.accent}`}>
                        {isDone ? <CheckCircle2 size={22} /> : step.emoji}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-base ${isDone ? "text-emerald-700 dark:text-emerald-300" : step.text2}`}>{step.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{step.text}</p>
                      </div>

                      {!isDone && isCurrent && (
                        <Button
                          size="sm"
                          className="flex-shrink-0 gap-1 rounded-xl h-9 bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => handleCompleteStep(step)}
                        >
                          <CheckCircle2 size={14} /> Done
                        </Button>
                      )}

                      {isDone && (
                        <Badge className="flex-shrink-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-0">
                          ✓ Complete
                        </Badge>
                      )}
                    </motion.div>
                  );
                })}

                {/* All completed */}
                <AnimatePresence>
                  {allDone && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-400 p-5 text-center space-y-1"
                    >
                      <p className="text-4xl">💙</p>
                      <p className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">You completed your coping plan!</p>
                      <p className="text-sm text-muted-foreground">You showed great strength. Take a moment to rest.</p>
                      <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={exitCoping}>
                        <Heart size={14} /> Close
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Guardian logs */}
        {role === "guardian" && (
          <div className="space-y-2 border-t pt-4">
            <p className="font-semibold">Meltdown Logs (guardian view)</p>
            <div className="max-h-64 overflow-auto space-y-2 pr-1">
              {meltdownLogs.length === 0 && <p className="text-sm text-muted-foreground">No logs yet.</p>}
              {meltdownLogs.map((log) => (
                <article key={log.id} className="rounded-xl border p-3 bg-background/40 text-sm">
                  <p className="font-medium">{log.event_type || "event"} · {log.risk_level || "unknown"}</p>
                  <p className="text-muted-foreground mt-1">{log.notes || "No notes"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(log.created_at).toLocaleString()}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
