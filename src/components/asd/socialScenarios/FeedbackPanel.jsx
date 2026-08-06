import { motion } from "framer-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Info, RefreshCcw, Sparkles, Undo2 } from "lucide-react";
import {
  FEEDBACK_SUBSCOE_LABELS,
  FEEDBACK_SUBSCOE_KEYS,
} from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";
import { cn } from "@/lib/utils";
import { toneFor } from "./tones";

function SubscoreBar({ label, value, tone }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{value}/100</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", tone.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
        />
      </div>
    </div>
  );
}

export default function FeedbackPanel({ report, scenario, onRestart, onBack }) {
  if (!report) return null;

  const tone = scenario ? toneFor(scenario) : null;
  const hasScore = Number.isFinite(report.communicationScore);
  const scoreBar = tone ? tone.bar : "bg-emerald-500";

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={cn("rounded-2xl border-2 p-5 text-center", tone ? cn(tone.bg, tone.border) : "border-emerald-200 bg-emerald-50/60")}
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.1 }}
          className={cn("mx-auto w-14 h-14 rounded-full flex items-center justify-center", tone ? tone.button : "bg-emerald-500")}
        >
          <CheckCircle2 className="h-8 w-8 text-white" />
        </motion.div>
        <h2 className="mt-3 text-xl font-black text-slate-900">Practice complete</h2>
        <p className={cn("mt-1 text-sm font-medium", tone ? tone.text : "text-emerald-700")}>{report.encouragement}</p>
      </motion.div>

      {hasScore ? (
        <Card className={cn("border-2", tone ? tone.border : "border-emerald-100")}>
          <CardHeader>
            <CardTitle className="text-slate-900">Your communication snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <motion.span
                className={cn("text-5xl font-black", tone ? tone.text : "text-emerald-600")}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                {report.communicationScore}
              </motion.span>
              <span className="text-sm text-slate-500 mb-1">/100 overall</span>
            </div>
            {FEEDBACK_SUBSCOE_KEYS.map((key) => (
              <SubscoreBar key={key} label={FEEDBACK_SUBSCOE_LABELS[key]} value={report.subscores?.[key] ?? 0} tone={{ bar: scoreBar }} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Alert variant="default" className="border-emerald-100">
          <Info className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-slate-800">No replies recorded</AlertTitle>
          <AlertDescription className="text-slate-600">{report.summary}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {report.strengths?.length > 0 && (
          <Card className={cn("border-2", tone ? tone.border : "border-emerald-100")}>
            <CardContent className="pt-5">
              <h4 className={cn("flex items-center gap-2 text-sm font-semibold mb-2", tone ? tone.text : "text-emerald-700")}>
                <CheckCircle2 className="h-4 w-4" /> Things that went well
              </h4>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {report.strengths.map((strength) => (
                  <li key={strength} className="flex gap-2">
                    <span className={tone ? tone.text : "text-emerald-500"}>•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {report.alternatives?.length > 0 && (
          <Card className={cn("border-2", tone ? tone.border : "border-emerald-100")}>
            <CardContent className="pt-5">
              <h4 className={cn("flex items-center gap-2 text-sm font-semibold mb-2", tone ? tone.text : "text-emerald-700")}>
                <Sparkles className="h-4 w-4" /> Try this next time
              </h4>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {report.alternatives.map((alternative) => (
                  <li key={alternative} className="flex gap-2">
                    <span className={tone ? tone.text : "text-emerald-500"}>•</span>
                    {alternative}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" onClick={onRestart}>
          <RefreshCcw className="h-4 w-4 mr-2" /> Practise again
        </Button>
        <Button variant="ghost" onClick={onBack}>
          <Undo2 className="h-4 w-4 mr-2" /> Back to scenarios
        </Button>
      </div>
    </div>
  );
}
