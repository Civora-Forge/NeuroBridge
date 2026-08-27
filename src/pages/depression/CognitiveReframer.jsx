'use client';

import React, { useRef, useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronRight, Copy, Leaf, Lightbulb, MessageCircle, Quote, RefreshCw, ShieldCheck, Sparkles, Sprout } from "lucide-react";
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

function ThoughtIllustration({ active = false }) {
  return (
    <div aria-hidden="true" className="relative mx-auto h-[220px] w-full max-w-[340px] select-none">
      <div className="absolute left-1/2 top-1/2 h-[190px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-[45%] bg-emerald-50/60 blur-xl" />
      <div className="absolute left-1/2 top-1/2 h-[155px] w-[260px] -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] rounded-[50%] border border-dashed border-emerald-200/80" />
      
      {/* Left bubble (Original Thought) */}
      <div className={`absolute left-[8px] top-[55px] w-[112px] rounded-[22px] border p-3.5 shadow-md backdrop-blur-sm transition-all duration-700 ${
        active ? "translate-y-1 border-amber-200/80 bg-amber-50/70" : "border-emerald-100 bg-white/90"
      }`}>
        <div className="mb-2 flex gap-1">
          <span className="h-1.5 w-8 rounded-full bg-amber-200" />
          <span className="h-1.5 w-3 rounded-full bg-amber-100" />
        </div>
        <div className="space-y-1.5">
          <span className="block h-1.5 w-full rounded-full bg-slate-200" />
          <span className="block h-1.5 w-[78%] rounded-full bg-slate-200/70" />
          <span className="block h-1.5 w-[52%] rounded-full bg-slate-200/50" />
        </div>
      </div>

      {/* Transition Arrow */}
      <div className="absolute left-[130px] top-[105px] flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse delay-75" />
        <ArrowRight size={18} className="text-emerald-600" />
      </div>

      {/* Central Sprout Icon */}
      <div className={`absolute left-1/2 top-[74px] grid h-[74px] w-[74px] -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-emerald-100/80 text-emerald-700 shadow-lg shadow-emerald-950/5 backdrop-blur-md transition-transform duration-700 ${
        active ? "scale-110 ring-4 ring-emerald-500/20" : ""
      }`}>
        <Sprout size={30} strokeWidth={1.8} className="text-emerald-700" />
      </div>

      {/* Right bubble (Reframed Perspective) */}
      <div className="absolute right-[3px] top-[112px] w-[122px] rounded-[22px] border border-emerald-200/80 bg-white/90 p-3.5 shadow-lg backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-emerald-600 animate-spin-slow" />
          <span className="text-[9px] font-black uppercase tracking-[.12em] text-emerald-800">Perspective</span>
        </div>
        <div className="space-y-1.5">
          <span className="block h-1.5 w-full rounded-full bg-emerald-300" />
          <span className="block h-1.5 w-[82%] rounded-full bg-emerald-200" />
          <span className="block h-1.5 w-[58%] rounded-full bg-emerald-100" />
        </div>
      </div>

      <Leaf size={20} className="absolute right-[54px] top-[36px] rotate-[28deg] text-emerald-400" />
      <Sparkles size={15} className="absolute right-[94px] top-[11px] text-amber-400" />
    </div>
  );
}

function ReframingProgress({ hasAnalysis, complete }) {
  const active = complete ? 3 : hasAnalysis ? 2 : 1;
  return (
    <div className="flex items-center gap-2">
      {["Thought", "Explore", "Perspective"].map((label, index) => {
        const stage = index + 1;
        const done = stage < active || complete;
        const current = stage === active && !complete;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black transition-all duration-300 ${
                done 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : current 
                  ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10" 
                  : "border border-slate-200 bg-white text-slate-400"
              }`}>
                {done ? <Check size={14} strokeWidth={3} /> : stage}
              </span>
              <span className={`hidden text-[11px] font-black uppercase tracking-wider sm:inline ${
                current || done ? "text-emerald-900" : "text-slate-400"
              }`}>
                {label}
              </span>
            </div>
            {stage < 3 && (
              <span className={`h-0.5 min-w-[20px] flex-1 rounded-full transition-colors duration-300 ${
                stage < active ? "bg-emerald-500" : "bg-slate-200"
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function CognitiveReframer() {
  const { user } = useAuth();
  const [thought, setThought] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [showReframe, setShowReframe] = useState(false);
  const textareaRef = React.useRef(null);
  const startedAtRef = useRef(null);
  const [safetyBlocked, setSafetyBlocked] = useState(false);
  const [complete, setComplete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [includeOriginalThought, setIncludeOriginalThought] = useState(false);
  const lifecycle = useInterventionLifecycle({ 
    userId: user?.id ?? null, 
    moduleId: COGNITIVE_REFRAMING_MODULE_ID, 
    planId: null, 
    contextSnapshotId: null, 
    triggerSource: 'manual', 
    selectionMode: 'explicit_request', 
    configuration: COGNITIVE_REFRAMING_CONFIGURATION 
  });

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
    setComplete(false);
    setCopied(false);
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'reframing_analysis', completedUnits: 2, totalUnits: 3, progressRatio: 2 / 3 });
    textareaRef.current?.blur();
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setShowReframe(false);
    setThought("");
    setComplete(false); setSafetyBlocked(false);
    setCopied(false);
    setIncludeOriginalThought(false);
    textareaRef.current?.focus();
  };

  return (
    <SupportToolThemeProvider theme="depression_reflection">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="relative min-h-screen w-full overflow-hidden bg-[#faf8f5] text-[#2c3242] antialiased selection:bg-rose-200">
          
          {/* Subtle Ambient Background Gradients */}
          <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-300/20 blur-3xl" />

          <div className="relative mx-auto w-full max-w-[1200px] space-y-8 px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
            
            {/* Outer Container Card */}
            <div className="rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-900/[0.03] backdrop-blur-md sm:p-10 lg:p-12">
              <div className="mx-auto max-w-[960px] space-y-8">
                
                {/* Header Banner */}
                <header className="relative -mx-6 -mt-6 overflow-hidden rounded-t-[28px] border-b border-slate-200/70 bg-gradient-to-br from-white via-slate-50/60 to-emerald-50/30 sm:-mx-10 sm:-mt-10 lg:-mx-12 lg:-mt-12">
                  <div className="relative grid min-h-[260px] lg:grid-cols-[1.2fr_.8fr]">
                    <div className="flex flex-col justify-center px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
                      <p className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[.18em] text-emerald-900">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-800 shadow-sm">
                          <Leaf size={16} />
                        </span>
                        Cognitive Reframing
                      </p>
                    <h1 className="mt-4 text-[36px] font-black leading-tight tracking-[-.04em] text-slate-900 sm:text-[46px]">
                        Make a little room <span className="block text-emerald-700">around one thought.</span>
                      </h1>
                      <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
                        Look at one thought from a few different angles and make space for a more balanced perspective.
                      </p>
                      <div className="mt-6 max-w-[460px]">
                        <ReframingProgress hasAnalysis={showReframe} complete={complete} />
                      </div>
                    </div>

                    <div className="relative hidden items-center justify-center border-l border-slate-200/60 bg-emerald-50/20 px-6 lg:flex">
                      <ThoughtIllustration active={showReframe} />
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-emerald-200/60 bg-white/90 px-3.5 py-1.5 text-[11px] font-extrabold text-emerald-900 shadow-sm backdrop-blur-sm">
                        Thought → Pause → Perspective
                      </div>
                    </div>
                  </div>
                </header>

                {/* Safety Alert */}
                {safetyBlocked && (
                  <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-[14px] leading-relaxed text-rose-900 shadow-sm backdrop-blur-sm">
                    This entry cannot be processed here. If you are in immediate danger, contact local emergency services or a trusted support person.
                  </div>
                )}

                {/* Main Input Section */}
                <section className="rounded-[24px] border border-indigo-200/80 bg-indigo-50/30 p-5 shadow-md shadow-slate-900/[0.02] transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-6">
                  <label htmlFor="thought" className="flex items-start gap-3.5 text-[16px] font-black text-slate-900">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 shadow-sm">
                      <MessageCircle size={18} />
                    </span>
                    <span>
                      What thought would you like to review?
                      <small className="mt-1 block text-[13px] font-medium text-slate-500">
                        Write down one thought that&apos;s been on your mind.
                      </small>
                    </span>
                  </label>

                  <textarea
                    id="thought"
                    ref={textareaRef}
                    className="mt-5 min-h-[140px] w-full resize-none rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 text-[15px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                    value={thought}
                    onChange={(e) => {
                      setThought(e.target.value);
                      setShowReframe(false);
                      setComplete(false);
                      setCopied(false);
                    }}
                    placeholder="Example: I'm such a failure... I'll never succeed... Everyone hates me..."
                    rows={3}
                  />

                  <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={analyzeThought}
                      disabled={!thought.trim()}
                      className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 text-[15px] font-black text-white shadow-lg shadow-emerald-950/10 transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                      <MessageCircle size={18} />
                      <span>Review thought</span>
                      <ArrowRight size={18} />
                    </button>

                    <p className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-500">
                      <ShieldCheck size={18} className="text-emerald-600" />
                      This is a safe space. Take your time.
                    </p>
                  </div>
                </section>

                {/* Analysis Output & Reframe Section */}
                {showReframe && analysis ? (
                <section className="space-y-6 rounded-[24px] border border-indigo-200/80 bg-indigo-50/30 p-5 shadow-lg shadow-slate-900/[0.03] transition-all duration-300 hover:-translate-y-1 hover:shadow-md backdrop-blur-md sm:p-6">
                    
                    {/* Distortion Pattern Card */}
                    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/30 p-5 shadow-sm">
                      <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.16em] text-emerald-800">
                        <Sparkles size={14} className="text-amber-500" />
                        A pattern to consider
                      </p>
                      <h2 className="mt-2 text-[26px] font-black tracking-[-.03em] text-slate-900">
                        {analysis.original}
                      </h2>
                      <p className="mt-2 max-w-[760px] text-[15px] leading-relaxed text-slate-600">
                        {analysis.explanation}
                      </p>
                    </div>

                    {/* Reflection Questions */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100/80 text-amber-800 shadow-sm">
                          <Lightbulb size={18} />
                        </span>
                        <div>
                          <h3 className="text-[15px] font-black text-slate-900">Try these questions</h3>
                          <p className="text-[12px] font-medium text-slate-500">There is no need to answer perfectly.</p>
                        </div>
                      </div>

                      <ol className="grid gap-3 text-[14px] leading-relaxed text-slate-700 sm:grid-cols-3">
                        {analysis.questions.map((question, idx) => (
                          <li key={idx} className="flex flex-col rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-sm transition-all hover:bg-white hover:border-emerald-200">
                            <span className="mb-3 grid h-6 w-6 place-items-center rounded-lg bg-emerald-100 text-[11px] font-black text-emerald-900">
                              {idx + 1}
                            </span>
                            <span>{question}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Reframe Perspective Box */}
                    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/80 p-6 shadow-inner">
                      <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.14em] text-emerald-800">
                        <Quote size={15} />
                        A more balanced perspective
                      </p>
                      <p className="mt-2 text-[19px] font-bold leading-relaxed tracking-tight text-emerald-950">
                        &ldquo;{analysis.reframe}&rdquo;
                      </p>
                    </div>

                    {/* Completion & Actions */}
                    <div className="border-t border-slate-100 pt-6 space-y-4">
                      <button
                        type="button"
                        onClick={async () => { 
                          if (!showReframe || complete) return; 
                          if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) {
                            await lifecycle.complete(buildCognitiveReframingOutcome({ stagesCompleted: 3, confirmed: true, startedAt: startedAtRef.current })); 
                          }
                          setComplete(true); 
                        }}
                        disabled={complete}
                        className="inline-flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-[15px] font-black text-white shadow-lg shadow-emerald-950/10 transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-default disabled:opacity-60 disabled:shadow-none"
                      >
                        {complete ? <CheckCircle2 size={18} /> : <Sparkles size={18} />}
                        <span>{complete ? "Exercise complete" : "This perspective feels helpful"}</span>
                        {!complete && <ChevronRight size={18} />}
                      </button>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={clearAnalysis}
                            className="inline-flex items-center gap-2 text-[13px] font-extrabold text-emerald-800 hover:underline underline-offset-4"
                          >
                            <RefreshCw size={14} />
                            <span>New thought</span>
                          </button>

                          <button
                            type="button"
                            onClick={async () => { 
                              const content = buildReframingClipboardPayload({ 
                                label: analysis.original, 
                                reframe: analysis.reframe, 
                                originalThought: thought, 
                                includeOriginalThought, 
                                safety: assessSupportInput({ userId: user?.id, moduleId: COGNITIVE_REFRAMING_MODULE_ID, action: 'copy', inputType: 'free_text', text: thought }) 
                              }); 
                              if (!content) return; 
                              try { 
                                await navigator.clipboard.writeText(content); 
                                setCopied(true); 
                              } catch { 
                                return; 
                              } 
                            }}
                            className="inline-flex items-center gap-2 text-[13px] font-extrabold text-emerald-800 hover:underline underline-offset-4"
                          >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copied ? "Copied" : "Copy perspective"}</span>
                          </button>
                        </div>

                        <label className="flex items-center gap-2 text-[13px] font-medium text-slate-600 select-none cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeOriginalThought}
                            onChange={(event) => setIncludeOriginalThought(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Include original thought</span>
                        </label>
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 text-[14px] leading-relaxed text-slate-600 backdrop-blur-sm">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100/80 text-emerald-800 shadow-sm">
                      <Sprout size={20} />
                    </span>
                    <p>
                      Write a thought above when you are ready.<br />
                      <strong className="font-extrabold text-slate-900">You only need to work with one thought at a time.</strong>
                    </p>
                  </section>
                )}

                {/* Urgent Support Accordion Footer */}
                <details className="group rounded-2xl border border-slate-200/80 bg-white/80 px-6 text-[14px] leading-relaxed text-slate-600 shadow-sm backdrop-blur-md transition-all">
                  <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between font-extrabold text-slate-800 select-none">
                    <span className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-600">
                        <ShieldCheck size={18} />
                      </span>
                      Need urgent support? You&apos;re not alone.
                    </span>
                    <span className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-extrabold text-rose-700">
                      Get help now ↗
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 pb-5 pt-4 text-[13px] leading-relaxed text-slate-600">
                    If you may act on thoughts of harming yourself or someone else, contact local emergency services now. If possible, also reach out to someone you trust and stay with them.
                  </div>
                </details>

              </div>
            </div>

          </div>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
