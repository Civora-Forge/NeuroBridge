import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Info, RefreshCcw, Sparkles, Undo2 } from "lucide-react";
import {
  FEEDBACK_SUBSCOE_LABELS,
  FEEDBACK_SUBSCOE_KEYS,
} from "@/support/modules/socialScenarioSimulator/socialScenarioTypes";

function SubscoreBar({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{value}/100</span>
      </div>
      <Progress value={value} className="h-2 [&>div]:bg-green-500" />
    </div>
  );
}

export default function FeedbackPanel({ report, onRestart, onBack }) {
  if (!report) return null;

  const hasScore = Number.isFinite(report.communicationScore);

  return (
    <div className="space-y-4">
      <Alert className="border-green-200 bg-green-50/60">
        <Sparkles className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Practice complete</AlertTitle>
        <AlertDescription className="text-green-700">{report.encouragement}</AlertDescription>
      </Alert>

      {hasScore ? (
        <Card className="border-green-100">
          <CardHeader>
            <CardTitle className="text-slate-900">Your communication snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-green-600">{report.communicationScore}</span>
              <span className="text-sm text-slate-500 mb-1">/100 overall</span>
            </div>
            {FEEDBACK_SUBSCOE_KEYS.map((key) => (
              <SubscoreBar key={key} label={FEEDBACK_SUBSCOE_LABELS[key]} value={report.subscores?.[key] ?? 0} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Alert variant="default" className="border-green-100">
          <Info className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-slate-800">No replies recorded</AlertTitle>
          <AlertDescription className="text-slate-600">{report.summary}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {report.strengths?.length > 0 && (
          <Card className="border-green-100">
            <CardContent className="pt-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-green-700 mb-2">
                <CheckCircle2 className="h-4 w-4" /> Things that went well
              </h4>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {report.strengths.map((strength) => (
                  <li key={strength} className="flex gap-2">
                    <span className="text-green-500">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {report.alternatives?.length > 0 && (
          <Card className="border-green-100">
            <CardContent className="pt-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-green-700 mb-2">
                <Sparkles className="h-4 w-4" /> Try this next time
              </h4>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {report.alternatives.map((alternative) => (
                  <li key={alternative} className="flex gap-2">
                    <span className="text-green-500">•</span>
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
