import { CheckCircle2, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFeedback } from "../services/feedbackGenerator";

function scoreColor(score) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-violet-500";
  return "bg-amber-500";
}

export default function FeedbackView({ engine }) {
  const session = engine.session;
  const evaluation = session?.evaluation;
  if (!evaluation) return null;

  const feedback = buildFeedback(evaluation);

  return (
    <div className="w-full space-y-5">
      <div className="rounded-2xl bg-white border border-violet-100 shadow-sm p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Overall</p>
        <p className={`font-black text-violet-600 ${engine.a11y.largeText ? "text-5xl" : "text-4xl"}`}>
          {evaluation.overallScore}
          <span className="text-lg text-slate-400 font-semibold">/100</span>
        </p>
        <p className="text-sm text-slate-600 mt-2">{feedback.summary}</p>
        <p className="text-[11px] text-slate-400 mt-2">
          {session?.turnCount} exchanges · {evaluation.stats?.voiceTurns ?? 0} spoken ·{" "}
          {evaluation.stats?.textTurns ?? 0} typed
        </p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-4">
        <h3 className={`font-bold text-slate-800 ${engine.a11y.largeText ? "text-xl" : ""}`}>How it went</h3>
        {evaluation.dimensions.map((dimension) => (
          <div key={dimension.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-700">{dimension.label}</span>
              <span className="text-sm font-semibold text-slate-500">{dimension.score}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${scoreColor(dimension.score)}`}
                style={{ width: `${dimension.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {feedback.sections.map((section) => (
        <div key={section.id} className="rounded-2xl bg-white border border-slate-200 p-6">
          <h3 className={`font-bold text-slate-800 mb-3 flex items-center gap-2 ${engine.a11y.largeText ? "text-xl" : ""}`}>
            {section.id === "what_worked" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : section.id === "alternatives" ? (
              <Target className="w-5 h-5 text-violet-500" />
            ) : (
              <Sparkles className="w-5 h-5 text-amber-500" />
            )}
            {section.title}
          </h3>
          <ul className="space-y-2">
            {section.items.map((item, index) => (
              <li key={`${section.id}-${index}`} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="mt-1.5 block h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="flex-1" size="lg" onClick={engine.finishActivity}>
          See your summary
        </Button>
        <Button variant="outline" size="lg" onClick={engine.startNew}>
          Practice again
        </Button>
      </div>
    </div>
  );
}
