import { useMemo, useState } from "react";
import { CHALLENGE_CATEGORIES, MODULES_REGISTRY } from "@/data/modulesRegistry";
import { getQuestionsForChallenges } from "@/utils/questionEngine";
import { selectModulesForUser } from "@/utils/moduleSelector";
import Questionnaire from "@/components/Questionnaire";
import { Brain } from "lucide-react";

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(1);
  const [selectedChallenges, setSelectedChallenges] = useState(new Set());
  const [answers, setAnswers] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);

  const challengeList = [...selectedChallenges];
  const questions = useMemo(() => getQuestionsForChallenges(challengeList), [challengeList]);
  const unanswered = questions.filter((q) => !answers[q.id]).length;

  const recommendationPreview = useMemo(
    () => selectModulesForUser({ selectedChallenges: challengeList, answersByQuestionId: answers }).selectedModules,
    [challengeList, answers],
  );

  function toggleChallenge(id) {
    setSelectedChallenges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAnswer(questionId, optionText) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionText }));
  }

  // ── DEMO ONLY: skip questionnaire and enable every module ──────────────────────────
  async function handleDemoSkip() {
    if (isProcessing) return;
    setIsProcessing(true);
    setStep(4);
    const allChallengeIds = CHALLENGE_CATEGORIES.map((c) => c.id);
    const allModules = Object.values(MODULES_REGISTRY).filter(Boolean);
    const allModuleIds = allModules.map((m) => m.id);
    await onComplete({
      selectedChallenges: allChallengeIds,
      answersByQuestionId: {},
      tagProfile: {},
      enabledModules: allModuleIds,
      selectedModules: allModules,
    });
    setStep(5);
    setIsProcessing(false);
  }
  // ── END DEMO ONLY ──────────────────────────────────────────────────────────

  async function handleFinish() {
    if (unanswered > 0 || isProcessing) return;
    setIsProcessing(true);
    setStep(4);
    const selection = selectModulesForUser({ selectedChallenges: challengeList, answersByQuestionId: answers });
    await onComplete({
      selectedChallenges: challengeList,
      answersByQuestionId: answers,
      tagProfile: selection.userTags,
      enabledModules: selection.enabledModules,
      selectedModules: selection.selectedModules,
    });
    setStep(5);
    setIsProcessing(false);
  }

  /* ── STEP 1: Welcome ── */
  if (step === 1) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-green-100 bg-white p-10 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-lg">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Welcome to NeuroBridge</h1>
          <p className="text-slate-500 mb-8 text-sm max-w-md mx-auto">
            We'll ask a few quick questions to build a personalised toolkit of support tools — just for you. No labels, no judgement.
          </p>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-xl bg-gradient-to-r from-green-500 to-teal-500 px-8 py-3 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-green-600 hover:to-teal-600 transition-all"
          >
            Get Started →
          </button>

          {/* DEMO ONLY — remove before production */}
          <p className="mt-5 text-xs text-slate-400">
            Demoing?{" "}
            <button
              type="button"
              onClick={handleDemoSkip}
              className="underline underline-offset-2 hover:text-slate-600 transition-colors"
            >
              ⚡ Skip questionnaire
            </button>
          </p>
          {/* END DEMO ONLY */}
        </div>
      </div>
    );
  }

  /* ── STEP 2: Select challenges ── */
  if (step === 2) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-green-100 bg-white p-8 shadow-sm">
          <div className="mb-1 text-xs font-semibold text-green-600 uppercase tracking-wider">Step 1 of 2</div>
          <h2 className="text-xl font-black text-slate-900 mb-1">Where do you want support?</h2>
          <p className="text-sm text-slate-500 mb-6">Select one or more areas. You can always update this later.</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CHALLENGE_CATEGORIES.map((challenge) => {
              const active = selectedChallenges.has(challenge.id);
              return (
                <button
                  key={challenge.id}
                  type="button"
                  onClick={() => toggleChallenge(challenge.id)}
                  className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all text-left ${
                    active
                      ? "border-green-400 bg-gradient-to-br from-green-50 to-teal-50 text-green-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-green-200 hover:bg-green-50/50"
                  }`}
                >
                  <span className="mr-1.5">{challenge.emoji}</span>
                  {challenge.label}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={challengeList.length === 0}
              className="rounded-xl bg-gradient-to-r from-green-500 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-green-600 hover:to-teal-600 transition-all disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── STEP 4: Processing ── */
  if (step === 4) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-green-100 bg-white p-12 text-center shadow-sm">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center animate-spin">
            <div className="w-6 h-6 rounded-full border-2 border-green-500 border-t-transparent" />
          </div>
          <p className="text-slate-600 font-medium">Personalising your dashboard…</p>
        </div>
      </div>
    );
  }

  /* ── STEP 5: Done ── */
  if (step === 5) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-3xl border border-green-100 bg-white p-12 text-center shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center shadow-lg">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Your tools are ready</h2>
          <p className="text-sm text-slate-500">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  /* ── STEP 3: Questionnaire ── */
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-green-100 bg-white p-8 shadow-sm">
        <div className="mb-1 text-xs font-semibold text-green-600 uppercase tracking-wider">Step 2 of 2</div>
        <h2 className="text-xl font-black text-slate-900 mb-1">Quick questionnaire</h2>
        <p className="text-sm text-slate-500 mb-6">Your answers shape which tools we recommend — the more honest, the better the fit.</p>

        <Questionnaire questions={questions} answers={answers} onAnswer={handleAnswer} />

        {/* Live preview */}
        {Object.keys(answers).length > 0 && (
          <div className="mt-6 rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-teal-50/30 p-4">
            <p className="text-xs font-semibold text-green-700 mb-2">Recommended tools so far</p>
            <div className="flex flex-wrap gap-2">
              {recommendationPreview.slice(0, 8).map((m) => (
                <span key={m.id} className="rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-medium text-green-800 shadow-sm">
                  {m.title}
                </span>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400">
          {unanswered === 0 ? "✓ All questions answered" : `${unanswered} question${unanswered > 1 ? "s" : ""} remaining`}
        </p>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={() => setStep(2)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Back
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={unanswered > 0 || isProcessing}
            className="rounded-xl bg-gradient-to-r from-green-500 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-green-600 hover:to-teal-600 transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            Build My Dashboard →
          </button>
        </div>

        {/* DEMO ONLY — remove before production */}
        <p className="mt-3 text-xs text-slate-400 text-center">
          Demoing?{" "}
          <button
            type="button"
            onClick={handleDemoSkip}
            className="underline underline-offset-2 hover:text-slate-600 transition-colors"
          >
            ⚡ Skip questionnaire
          </button>
        </p>
        {/* END DEMO ONLY */}
      </div>
    </div>
  );
}

