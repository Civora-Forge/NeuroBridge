import { useState } from "react";
import { BarChart3, History, Mic, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMMUNICATION_DOMAINS,
  DIFFICULTY_LEVELS,
  DIFFICULTY_IDS,
  DEFAULT_DIFFICULTY,
  getDomainById,
} from "../types/communicationTypes";
import { useVoiceInput } from "../hooks/useVoiceInput";

export default function ActivitySetup({ engine }) {
  const [domain, setDomain] = useState("small_talk");
  const [difficulty, setDifficulty] = useState(engine.difficulty ?? DEFAULT_DIFFICULTY);
  const voice = useVoiceInput();
  const { historyStats } = engine;

  const domainLabel = (id) => getDomainById(id)?.label ?? id;
  const hasActive = Boolean(engine.baseSession);

  return (
    <div className="w-full">
      <section className="mb-6">
        <h2 className={`font-bold text-slate-800 mb-2 ${engine.a11y.largeText ? "text-2xl" : "text-lg"}`}>
          What would you like to practice?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COMMUNICATION_DOMAINS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDomain(item.id)}
              aria-pressed={domain === item.id}
              className={`text-left rounded-xl border p-4 transition-colors ${
                domain === item.id
                  ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                  : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40"
              }`}
            >
              <span className={`font-semibold text-slate-900 ${engine.a11y.largeText ? "text-lg" : ""}`}>
                {item.label}
              </span>
              <p className="text-sm text-slate-500 mt-1">{item.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className={`font-bold text-slate-800 ${engine.a11y.largeText ? "text-xl" : "text-lg"}`}>
            Challenge level
          </h2>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Suggested: {DIFFICULTY_LEVELS[engine.difficulty]?.label ?? "Moderate"}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {DIFFICULTY_IDS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDifficulty(level)}
              aria-pressed={difficulty === level}
              className={`rounded-xl border px-2 py-3 text-center transition-colors ${
                difficulty === level
                  ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                  : "border-slate-200 bg-white hover:border-violet-200"
              }`}
            >
              <span className={`block font-bold text-violet-600 ${engine.a11y.largeText ? "text-lg" : ""}`}>{level}</span>
              <span className="block text-[11px] text-slate-500 leading-tight mt-1">
                {DIFFICULTY_LEVELS[level].label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {hasActive && (
        <Button
          variant="outline"
          className="w-full mb-4 border-violet-300 text-violet-700"
          onClick={() => engine.begin()}
        >
          Resume your in-progress practice
        </Button>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          className="flex-1"
          size="lg"
          disabled={engine.busy}
          onClick={() => engine.startActivity({ domain, difficultyOverride: difficulty })}
        >
          <Sparkles className="w-4 h-4 mr-2" /> {engine.busy ? "Preparing…" : "Start practicing"}
        </Button>
        <Button variant="outline" size="lg" onClick={() => engine.openHistory()}>
          <History className="w-4 h-4 mr-2" /> History
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <BarChart3 className="w-5 h-5 text-violet-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-slate-800">{historyStats?.completedSessions ?? 0}</p>
          <p className="text-xs text-slate-500">Sessions completed</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <Sparkles className="w-5 h-5 text-violet-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-slate-800">{historyStats?.averageScore ?? "—"}</p>
          <p className="text-xs text-slate-500">Average score</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4">
          <Mic className="w-5 h-5 text-violet-500 mx-auto mb-1" />
          <p className="text-2xl font-black text-slate-800">{voice.supported ? "Yes" : "Type"}</p>
          <p className="text-xs text-slate-500">Voice input available</p>
        </div>
      </div>
    </div>
  );
}
