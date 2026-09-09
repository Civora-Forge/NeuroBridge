import { ArrowLeft, BarChart3, CalendarDays, Flame, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDomainById, DIFFICULTY_LEVELS } from "../types/communicationTypes";

function formatDate(iso) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function HistoryView({ engine }) {
  const { history, historyStats, a11y } = engine;
  const completed = history.filter((outcome) => outcome?.metrics?.communicationScore != null);

  return (
    <div className="w-full space-y-5">
      <button
        type="button"
        onClick={engine.startNew}
        className="inline-flex items-center gap-1.5 text-sm text-[#3D6A66] hover:text-[#134E4A]"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-white border border-[#B2DFDB] p-4">
          <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-[#134E4A]">{historyStats?.streak?.current ?? 0}</p>
          <p className="text-xs text-[#3D6A66]">Day streak</p>
        </div>
        <div className="rounded-xl bg-white border border-[#B2DFDB] p-4">
          <BarChart3 className="w-5 h-5 text-[#14B8A6] mx-auto mb-1" />
          <p className="text-2xl font-black text-[#134E4A]">{historyStats?.averageScore ?? "—"}</p>
          <p className="text-xs text-[#3D6A66]">Average score</p>
        </div>
        <div className="rounded-xl bg-white border border-[#B2DFDB] p-4">
          <CalendarDays className="w-5 h-5 text-cyan-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-[#134E4A]">{historyStats?.completedSessions ?? 0}</p>
          <p className="text-xs text-[#3D6A66]">Sessions</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#B2DFDB] overflow-hidden">
        <h3 className="font-bold text-[#134E4A] px-5 py-4 border-b border-[#E6F7F2]">Past sessions</h3>
        {completed.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#3D6A66]">
            <Sparkles className="w-6 h-6 text-[#B2DFDB] mx-auto mb-2" />
            No sessions yet. Start a practice conversation to build your history.
          </div>
        ) : (
          <ul className="divide-y divide-[#E6F7F2]">
            {completed.map((outcome) => {
              const domain = getDomainById(outcome?.metrics?.domain);
              return (
                <li key={outcome.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-semibold text-[#134E4A] truncate ${a11y.largeText ? "text-base" : "text-sm"}`}>
                      {domain?.label ?? outcome?.metrics?.domain ?? "Conversation"}
                    </p>
                    <p className="text-xs text-[#3D6A66]">
                      {DIFFICULTY_LEVELS[outcome?.metrics?.difficulty]?.label ?? "Moderate"} ·{" "}
                      {formatDate(outcome?.createdAt)} · {outcome?.metrics?.turnCount ?? 0} exchanges
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#F0FAF7] text-[#0F766E] font-bold px-3 py-1.5 text-sm border border-[#B2DFDB]">
                    {outcome?.metrics?.communicationScore ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={engine.startNew}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to practice
      </Button>
    </div>
  );
}
