import { ArrowLeft, MessageCircle, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDomainById, DIFFICULTY_LEVELS } from "../types/communicationTypes";
import { AsdCharacter } from "@/components/asd/ui";

export default function ScenarioBrief({ engine }) {
  const session = engine.session;
  const scenario = session?.scenario;
  if (!scenario) return null;

  const domain = getDomainById(scenario.domain);
  const difficultyLabel = DIFFICULTY_LEVELS[scenario.difficulty]?.label ?? "Moderate";

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={engine.startNew}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Change topic
      </button>

      <div className="rounded-2xl bg-white border-2 border-[#B2DFDB] shadow-[4px_4px_0_#D5F5EC] overflow-hidden">
        <div className="bg-gradient-to-r from-[#0D9488] to-[#06B6D4] px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-black text-lg">{scenario.title}</h2>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              {domain?.label ?? scenario.domain}
            </span>
          </div>
          <p className="text-sm text-violet-50 mt-1">Level: {difficultyLabel}</p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Setting</h3>
            <p className="text-slate-800">{scenario.setting}</p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Your goal</h3>
            <p className="text-slate-800">{scenario.goal}</p>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-[#F0FAF7] border border-[#B2DFDB] p-4">
            <AsdCharacter size={40} ariaHidden tone="cyan" accessory="spark" className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">{scenario.npc?.name}</p>
              <p className="text-sm text-slate-500">{scenario.npc?.role} — {scenario.npc?.personality}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">They start by saying</h3>
            <p className="text-slate-800 italic">“{scenario.openingLine}”</p>
          </div>

          <div className="rounded-xl bg-[#F0FAF7] border border-[#A7F3D0] p-4 text-sm text-[#0F766E] flex items-start gap-2">
            <MessageCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              You can reply by voice or by typing. There is no right or wrong answer — the goal
              is to practice, and you can stop whenever you like.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" size="lg" disabled={engine.busy} onClick={engine.begin}>
            <Sparkles className="w-4 h-4 mr-2" /> Start conversation
          </Button>
          <Button variant="outline" size="lg" disabled={engine.busy} onClick={engine.reshuffle}>
            <RefreshCw className="w-4 h-4 mr-2" /> Try another scenario
          </Button>
        </div>
      </div>
    </div>
  );
}
