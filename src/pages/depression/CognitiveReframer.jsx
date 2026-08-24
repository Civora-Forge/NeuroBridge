'use client';

import React, { useRef, useState } from "react";
import { useAuth } from '@/context/AuthContext';
import { useInterventionLifecycle } from '@/support/execution';
import { assessSupportInput } from '@/support/safety';
import { COGNITIVE_REFRAMING_CONFIGURATION, COGNITIVE_REFRAMING_MODULE_ID } from '@/support/modules/cognitiveReframing/cognitiveReframingTypes';
import { buildCognitiveReframingOutcome, buildReframingClipboardPayload, canProcessReframingInput } from '@/support/modules/cognitiveReframing/cognitiveReframingService';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

const cognitiveDistortions = {
  "all or nothing": {
    original: "All-or-nothing thinking",
    explanation: "Seeing things in black-and-white categories. If your performance falls short of perfect, you see yourself as a total failure.",
    questions: [
      "Is there middle ground between success/failure?",
      "What evidence supports a balanced view?",
      "Have I ever succeeded without being perfect?"
    ],
    reframe: "I'm making progress, even if imperfect"
  },
  "overgeneralizing": {
    original: "Overgeneralizing", 
    explanation: "Seeing a single negative event as a never-ending pattern.",
    questions: [
      "Is this always true, or just this once?",
      "What are counterexamples from my life?",
      "Does one setback define my entire ability?"
    ],
    reframe: "This is one instance, not my whole story"
  },
  "mental filter": {
    original: "Mental filter",
    explanation: "Picking out a single negative detail and dwelling on it exclusively.",
    questions: [
      "What positive aspects am I ignoring?",
      "Is this detail the whole picture?",
      "How would I view this if it happened to a friend?"
    ],
    reframe: "I'm focusing on the full picture now"
  },
  "disqualifying positive": {
    original: "Disqualifying the positive",
    explanation: "Rejecting positive experiences by insisting they 'don't count'.",
    questions: [
      "Why don't these positives count?",
      "What evidence supports accepting them?",
      "Am I holding myself to impossible standards?"
    ],
    reframe: "My achievements are real and valid"
  },
  "jumping conclusions": {
    original: "Jumping to conclusions",
    explanation: "Making negative interpretations without evidence (mind reading/fortune telling).",
    questions: [
      "What actual evidence do I have?",
      "Am I assuming others' thoughts?",
      "What's the most likely reality?"
    ],
    reframe: "I'll stick to what I actually know"
  },
  "magnification": {
    original: "Magnification & minimization",
    explanation: "Making problems bigger and successes smaller than they are.",
    questions: [
      "Am I blowing this out of proportion?",
      "How would I rate this on a 1-10 scale realistically?",
      "What's a balanced perspective?"
    ],
    reframe: "This challenge is manageable"
  },
  "emotional reasoning": {
    original: "Emotional reasoning",
    explanation: "Believing feelings are evidence of truth.",
    questions: [
      "Are my feelings facts?",
      "What evidence contradicts my emotions?",
      "Can I feel this way AND be wrong?"
    ],
    reframe: "Feelings aren't always reality"
  },
  "should statements": {
    original: "Should statements",
    explanation: "Motivating with 'shoulds', creating guilt and frustration.",
    questions: [
      "What would 'want to' sound like instead?",
      "Is this expectation realistic?",
      "How can I be kinder to myself?"
    ],
    reframe: "I'll aim for progress, not perfection"
  },
  "labeling": {
    original: "Labeling & mislabeling",
    explanation: "Identifying with a behavior instead of the specific action.",
    questions: [
      "Am I human with flaws, or defined by one mistake?",
      "What specific behavior occurred?",
      "How would I describe a friend in this situation?"
    ],
    reframe: "I made a mistake, I'm not a mistake"
  },
  "personalization": {
    original: "Personalization",
    explanation: "Holding yourself responsible for events outside your control.",
    questions: [
      "What was actually in my control?",
      "Am I taking more responsibility than needed?",
      "What factors contributed besides me?"
    ],
    reframe: "I control my response, not everything"
  }
};

export default function CognitiveReframer() {
  const { user } = useAuth();
  const [thought, setThought] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [showReframe, setShowReframe] = useState(false);
  const textareaRef = React.useRef(null);
  const startedAtRef = useRef(null);
  const [safetyBlocked, setSafetyBlocked] = useState(false);
  const [complete, setComplete] = useState(false);
  const [includeOriginalThought, setIncludeOriginalThought] = useState(false);
  const lifecycle = useInterventionLifecycle({ userId: user?.id ?? null, moduleId: COGNITIVE_REFRAMING_MODULE_ID, planId: null, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: COGNITIVE_REFRAMING_CONFIGURATION });

  const analyzeThought = async () => {
    if (!thought.trim()) return;
    const safety = assessSupportInput({ userId: user?.id, moduleId: COGNITIVE_REFRAMING_MODULE_ID, action: 'analyze', inputType: 'free_text', text: thought });
    if (!canProcessReframingInput(safety)) { setSafetyBlocked(true); return; }
    setSafetyBlocked(false);
    if (!lifecycle.hasStarted && user?.id) { const started = await lifecycle.start(); if (!started.ok) return; startedAtRef.current = Date.now(); }
    
    const lowerThought = thought.toLowerCase();
    let bestMatch = null;
    let highestScore = 0;

    Object.entries(cognitiveDistortions).forEach(([key, distortion]) => {
      const score = lowerThought.split(' ').filter(word => 
        key.includes(word) || distortion.original.toLowerCase().includes(word)
      ).length;
      
      if (score > highestScore) {
        highestScore = score;
        bestMatch = distortion;
      }
    });

    setAnalysis(bestMatch || {
      original: "Unidentified Pattern",
      explanation: "Your thought doesn't match classic distortions, but the reframing process still applies.",
      questions: ["What's the evidence for/against this?", "What's a more balanced view?", "How would I advise a friend?"],
      reframe: "I'm practicing clearer thinking"
    });
    setShowReframe(true);
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'reframing_analysis', completedUnits: 2, totalUnits: 3, progressRatio: 2 / 3 });
    textareaRef.current?.blur();
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setShowReframe(false);
    setThought("");
    setComplete(false); setSafetyBlocked(false);
    setIncludeOriginalThought(false);
    textareaRef.current?.focus();
  };

  return (
    <SupportToolThemeProvider theme="depression_reflection">
    <SupportToolLayout>
      <div className="mx-auto max-w-2xl space-y-5 pb-4 text-stone-800">
      <header className="border-b border-stone-300 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Cognitive reframing</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Review one thought</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">Use a few questions to make room for a more balanced view. This tool does not diagnose thoughts.</p>
      </header>
      {safetyBlocked && <p className="rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm leading-5 text-stone-700">This entry cannot be processed here. If you are in immediate danger, contact local emergency services or a trusted support person.</p>}

      <section className="rounded-xl border border-stone-300 bg-[#faf7f0] p-4 shadow-sm">
        <label htmlFor="thought" className="block text-sm font-medium text-stone-800">What thought would you like to review?</label>
        <textarea
          id="thought"
          ref={textareaRef}
          className="mt-2 min-h-[120px] w-full resize-none rounded-lg border border-stone-300 bg-[#fffdf8] p-3 text-base leading-6 text-stone-800 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200"
          value={thought}
          onChange={(e) => {
            setThought(e.target.value);
            setShowReframe(false);
          }}
          placeholder="I'm such a failure... I'll never succeed... Everyone hates me..."
          rows={3}
        />
        <button
          type="button"
          onClick={analyzeThought}
          className="mt-3 w-full rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-semibold text-[#fffdf8] hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2 sm:w-auto"
        >
          Review thought
        </button>
      </section>

      {showReframe && analysis ? (
          <section className="space-y-4 rounded-xl border border-stone-300 bg-[#fffdf8] p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">A pattern to consider</p>
              <h2 className="mt-1 text-lg font-semibold text-stone-900">{analysis.original}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{analysis.explanation}</p>
            </div>
            <div className="border-t border-stone-200 pt-4">
              <h3 className="text-sm font-semibold text-stone-800">Consider these questions</h3>
              <ol className="mt-2 space-y-2 text-sm leading-6 text-stone-700">
                {analysis.questions.map((question, idx) => (
                  <li key={idx} className="flex gap-3"><span className="font-medium text-stone-500">{idx + 1}.</span><span>{question}</span></li>
                ))}
              </ol>
            </div>
            <div className="border-t border-stone-200 pt-4">
              <h3 className="text-sm font-semibold text-stone-800">A balanced perspective</h3>
              <p className="mt-2 rounded-lg border-l-2 border-stone-400 bg-[#f4efe5] px-3 py-3 text-sm leading-6 text-stone-800">{analysis.reframe}</p>
            </div>
            <div className="border-t border-stone-200 pt-4">
              <button type="button" onClick={async () => { if (!showReframe || complete) return; if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.complete(buildCognitiveReframingOutcome({ stagesCompleted: 3, confirmed: true, startedAt: startedAtRef.current })); setComplete(true); }} className="w-full rounded-lg bg-stone-800 px-4 py-2.5 text-sm font-semibold text-[#fffdf8] hover:bg-stone-700 disabled:opacity-50" disabled={complete}> {complete ? 'Exercise complete' : 'Confirm exercise complete'} </button>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" onClick={clearAnalysis} className="text-sm font-medium text-stone-700 underline underline-offset-4 hover:text-stone-900">New thought</button>
                <button
                  type="button"
                onClick={async () => {
                  const content = buildReframingClipboardPayload({ label: analysis.original, reframe: analysis.reframe, originalThought: thought, includeOriginalThought, safety: assessSupportInput({ userId: user?.id, moduleId: COGNITIVE_REFRAMING_MODULE_ID, action: 'copy', inputType: 'free_text', text: thought }) });
                  if (!content) return;
                  try { await navigator.clipboard.writeText(content); } catch { return; }
                }}
                className="text-sm font-medium text-stone-700 underline underline-offset-4 hover:text-stone-900"
              >
                  Copy perspective
                </button>
                <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={includeOriginalThought} onChange={(event) => setIncludeOriginalThought(event.target.checked)} /> Include original thought</label>
              </div>
            </div>
          </section>
      ) : <p className="px-1 text-sm leading-6 text-stone-500">Write a thought above when you are ready. You only need to work with one thought at a time.</p>}
      <details className="border-t border-stone-300 pt-4 text-xs leading-5 text-stone-600"><summary className="cursor-pointer font-medium text-stone-700">Need urgent support?</summary><p className="mt-2">If you may act on thoughts of harming yourself or someone else, contact local emergency services now. If possible, also reach out to someone you trust and stay with them.</p></details>
      </div>
    </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
