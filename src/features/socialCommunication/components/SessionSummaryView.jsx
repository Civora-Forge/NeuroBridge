import { History, RotateCcw, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDomainById, DIFFICULTY_LEVELS } from "../types/communicationTypes";

export default function SessionSummaryView({ engine }) {
  const session = engine.session;
  const evaluation = session?.evaluation;
  if (!session) return null;

  const domain = getDomainById(session.scenario?.domain);

  return (
    <div className="w-full max-w-xl mx-auto space-y-5">
      <div className="rounded-2xl bg-white border-2 border-[#B2DFDB] shadow-[3px_3px_0_#D5F5EC] p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#0D9488] to-[#06B6D4] flex items-center justify-center">
          <TrendingUp className="w-7 h-7 text-white" />
        </div>
        <h2 className="font-black text-slate-900">Practice complete</h2>
        <p className="text-sm text-slate-500 mt-1">
          {domain?.label ?? session.scenario?.domain} ·{" "}
          {DIFFICULTY_LEVELS[session.difficulty]?.label ?? "Moderate"} ·{" "}
          {session.turnCount} exchanges
        </p>
        {evaluation && (
          <p className="mt-3 text-3xl font-black text-[#0D9488]">{evaluation.overallScore}<span className="text-base text-slate-400 font-semibold">/100</span></p>
        )}
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <h3 className="font-bold text-slate-800 mb-2">Next suggested level</h3>
        <p className="text-sm text-slate-600">
          Based on your recent sessions, your next practice level is{" "}
          <span className="font-semibold text-slate-900">
            {DIFFICULTY_LEVELS[engine.difficulty]?.label ?? "Moderate"}
          </span>{" "}
          ({engine.difficulty}/5). You can change it anytime before you start.
        </p>
        {engine.adaptation.signals.recommendEasier && (
          <p className="mt-2 text-sm text-teal-700">
            A gentler level was suggested for your next session.
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button className="flex-1" size="lg" onClick={engine.startNew}>
          <RotateCcw className="w-4 h-4 mr-2" /> Practice again
        </Button>
        <Button variant="outline" size="lg" onClick={engine.openHistory}>
          <History className="w-4 h-4 mr-2" /> View history
        </Button>
      </div>

      <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
        <Sparkles className="w-3 h-3" /> Consistent practice helps — short sessions count.
      </p>
    </div>
  );
}
