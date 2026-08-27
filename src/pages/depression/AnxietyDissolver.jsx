'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Clock3, Heart, Leaf, MessageSquareHeart, Pause, Play, RotateCcw, ShieldCheck, Sparkles, Wind } from "lucide-react";
import { useAuth } from '@/context/AuthContext';
import { useInterventionLifecycle } from '@/support/execution';
import { buildGroundingOutcome } from '@/support/modules/grounding/groundingService';
import { GROUNDING_MODULE_ID } from '@/support/modules/grounding/groundingTypes';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

const techniques = [
  { title: "4-7-8 breathing", duration: 4, steps: ["Inhale quietly through your nose for 4 seconds", "Hold your breath for 7 seconds", "Exhale completely through your mouth for 8 seconds", "Repeat for 4 cycles"] },
  { title: "5-4-3-2-1 grounding", duration: 2, steps: ["Name 5 things you can see", "Name 4 things you can touch", "Name 3 things you can hear", "Name 2 things you can smell", "Name 1 thing you can taste"] },
  { title: "Muscle relaxation", duration: 3, steps: ["Tense your shoulders for 5 seconds", "Release slowly for 10 seconds", "Move to your arms, then your legs", "Keep breathing as you go"] },
  { title: "Box breathing", duration: 5, steps: ["Inhale for 4 seconds", "Hold for 4 seconds", "Exhale for 4 seconds", "Hold for 4 seconds", "Repeat the cycle"] }
];

function WindowIllustration() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute right-2 top-4 hidden h-[210px] w-[270px] select-none lg:block">
      <div className="absolute right-2 top-0 h-[190px] w-[210px] rounded-bl-[80px] bg-amber-100/40 blur-md" />
      <div className="absolute right-[50px] top-2 h-[155px] w-[125px] overflow-hidden rounded-b-[50px] border-x-4 border-b-4 border-amber-200/60 bg-emerald-50/50 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-100/40 via-emerald-100/30 to-teal-100/20 opacity-80" />
        <span className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 bg-amber-200/50" />
        <span className="absolute left-0 top-[60px] h-[3px] w-full bg-amber-200/50" />
        <span className="absolute left-0 top-[108px] h-[3px] w-full bg-amber-200/50" />
      </div>
      <div className="absolute bottom-[22px] right-[16px] h-[6px] w-[200px] rounded-full bg-amber-200/80 shadow-sm" />
      
      {/* Potted Plant */}
      <div className="absolute bottom-[28px] right-[148px]">
        <span className="absolute bottom-[25px] left-[18px] h-[52px] w-[3px] rotate-[5deg] bg-emerald-700/80" />
        <span className="absolute bottom-[48px] left-[-2px] h-[26px] w-[34px] rotate-[-38deg] rounded-[100%_0] bg-emerald-600/90 shadow-sm" />
        <span className="absolute bottom-[54px] left-[20px] h-[29px] w-[38px] rotate-[35deg] rounded-[100%_0] bg-emerald-500/90 shadow-sm" />
        <span className="block h-[50px] w-[44px] rounded-b-[18px] rounded-t-[8px] border border-amber-300/80 bg-amber-200/90 shadow-md" />
      </div>

      {/* Mug & Candle */}
      <div className="absolute bottom-[26px] right-[42px] h-[50px] w-[46px] rounded-b-[16px] rounded-t-[6px] border border-stone-300 bg-white shadow-md">
        <span className="absolute -right-[12px] top-[10px] h-[22px] w-[15px] rounded-r-full border-[3px] border-stone-300" />
        <span className="absolute inset-x-[4px] top-[3px] h-[6px] rounded-full bg-amber-800/60" />
      </div>
      <span className="absolute bottom-[26px] right-[96px] h-[40px] w-[32px] rounded-b-[8px] border border-amber-300 bg-amber-400/90 shadow-lg shadow-amber-300/50" />
      <span className="absolute bottom-[66px] right-[110px] h-[14px] w-[4px] rounded-full bg-amber-200 shadow-[0_-6px_10px_#f59e0b]" />
    </div>
  );
}

function PracticeProgress({ activeStep, totalSteps, completed }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isDone = index < activeStep || completed;
        const isCurrent = index === activeStep && !completed;
        return (
          <React.Fragment key={index}>
            <div className="flex items-center gap-2">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black transition-all duration-300 ${
                isDone 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : isCurrent 
                  ? "border-2 border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/10" 
                  : "border border-slate-200 bg-white text-slate-400"
              }`}>
                {isDone ? <CheckCircle2 size={15} /> : index + 1}
              </span>
            </div>
            {index < totalSteps - 1 && (
              <span className={`h-0.5 min-w-[16px] flex-1 rounded-full transition-colors duration-300 ${
                index < activeStep || completed ? "bg-emerald-500" : "bg-slate-200"
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function AnxietyDissolver() {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [durationReached, setDurationReached] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [reachedCount, setReachedCount] = useState(0);
  const [earlyCount, setEarlyCount] = useState(0);
  const intervalRef = useRef(null);
  const startedAtRef = useRef(null);
  const configuration = { exerciseType: 'timed_grounding', pacing: 'timed', totalSteps: 4, techniqueOrder: ['4-7-8', '5-4-3-2-1', 'muscle_relaxation', 'box_breathing'], suggestedDurations: [4, 2, 3, 5] };
  const lifecycle = useInterventionLifecycle({ userId: user?.id ?? null, moduleId: GROUNDING_MODULE_ID, planId: null, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration });

  const startTimer = useCallback(async () => {
    if (!lifecycle.hasStarted && user?.id) { const started = await lifecycle.start(); if (!started.ok) return; startedAtRef.current = Date.now(); }
    if (durationReached) { setTimer(0); setDurationReached(false); }
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev >= techniques[activeStep].duration * 60) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setDurationReached(true);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  }, [activeStep, lifecycle, user?.id, durationReached]);

  const stopTimer = () => { setIsRunning(false); clearInterval(intervalRef.current); };

  const nextTechnique = async () => {
    if (!lifecycle.hasStarted || completed) return;
    const completedSteps = completedCount + 1;
    const reached = reachedCount + (durationReached ? 1 : 0);
    const early = earlyCount + (durationReached ? 0 : 1);
    if (!lifecycle.hasStarted && user?.id) { const started = await lifecycle.start(); if (!started.ok) return; startedAtRef.current = Date.now(); }
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'grounding_technique', completedUnits: completedSteps, totalUnits: techniques.length, progressRatio: completedSteps / techniques.length, suggestedDurationReached: durationReached, completedBeforeSuggestedDuration: !durationReached });
    setCompletedCount(completedSteps); setReachedCount(reached); setEarlyCount(early);
    if (completedSteps === techniques.length) {
      if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.complete(buildGroundingOutcome({ configuration, completedSteps, suggestedDurationsReached: reached, techniquesCompletedEarly: early, currentTechniqueId: configuration.techniqueOrder[activeStep], startedAt: startedAtRef.current }));
      stopTimer(); setCompleted(true); return;
    }
    stopTimer(); setActiveStep((prev) => prev + 1); setTimer(0); setDurationReached(false);
  };

  const restart = async () => { 
    stopTimer(); 
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.abandon('user_restart', {}, buildGroundingOutcome({ configuration, completedSteps: completedCount, suggestedDurationsReached: reachedCount, techniquesCompletedEarly: earlyCount, currentTechniqueId: configuration.techniqueOrder[activeStep], startedAt: startedAtRef.current })); 
    lifecycle.reset(); 
    setActiveStep(0); 
    setTimer(0); 
    setCompleted(false); 
    setCompletedCount(0); 
    setReachedCount(0); 
    setEarlyCount(0); 
    setDurationReached(false); 
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  const technique = techniques[activeStep];

  return (
    <SupportToolThemeProvider theme="depression_gentle">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="relative min-h-screen w-full overflow-hidden bg-[#faf8f5] text-[#2c3242] antialiased selection:bg-rose-200">
          
          {/* Subtle Ambient Background Gradients */}
          <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full bg-amber-300/20 blur-3xl" />

          <div className="relative mx-auto w-full max-w-[1200px] space-y-8 px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
            
            {/* Outer Container Card */}
            <div className="rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-900/[0.03] backdrop-blur-md sm:p-10 lg:p-12">
              <div className="mx-auto max-w-[960px] space-y-8">
                
                {/* Header Banner */}
                <header className="relative -mx-6 -mt-6 overflow-hidden rounded-t-[28px] border-b border-slate-200/70 bg-gradient-to-br from-white via-slate-50/60 to-emerald-50/30 sm:-mx-10 sm:-mt-10 lg:-mx-12 lg:-mt-12">
                  <div className="relative flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
                    <p className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[.18em] text-emerald-900">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-amber-800 shadow-sm">
                        <Sparkles size={16} />
                      </span>
                      Grounding & Calm
                    </p>
                    
                    <h1 className="mt-4 text-[36px] font-black leading-tight tracking-[-.04em] text-slate-900 sm:text-[46px]">
                      Come back to <span className="block text-emerald-700">the present moment.</span>
                    </h1>
                    
                    <p className="mt-3 max-w-[540px] text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
                      There is no right or wrong way to do this. Try one small practice at your own steady pace.
                    </p>

                    <div className="mt-6 max-w-[360px]">
                      <PracticeProgress activeStep={activeStep} totalSteps={techniques.length} completed={completed} />
                    </div>

                    <WindowIllustration />
                  </div>
                </header>

                {/* Main Practice Section */}
                <section className="overflow-hidden rounded-[24px] border border-emerald-200/80 bg-emerald-50/30 shadow-md shadow-slate-900/[0.02] transition-all duration-300 hover:-translate-y-1 hover:shadow-md" aria-labelledby="practice-title">
                  <div className="p-5 sm:p-6 lg:p-6">
                    
                    {/* Header Row: Technique Title & Timer */}
                    <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[.16em] text-emerald-800">
                          Practice {activeStep + 1} of {techniques.length}
                        </p>
                        <h2 id="practice-title" className="mt-1 text-[28px] font-black tracking-[-.03em] text-slate-900 sm:text-[32px]">
                          {technique.title}
                        </h2>
                      </div>

                      {/* Timer Display */}
                      <div className="inline-flex items-center gap-3 self-start rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 shadow-inner sm:self-auto">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
                          <Clock3 size={20} />
                        </span>
                        <div>
                          <p className="font-mono text-[22px] font-bold leading-none tabular-nums text-slate-900">
                            {formatTime(timer)}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-slate-500">
                            {technique.duration} min suggested
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Step-by-Step Instructions */}
                    <ol className="mt-6 divide-y divide-slate-100">
                      {technique.steps.map((step, index) => {
                        const match = step.match(/(\d+ seconds|\d+ cycles)/);
                        const cleanText = step.replace(/(\d+ seconds|\d+ cycles)/, "");
                        return (
                          <li key={step} className="flex items-center gap-4 py-4 text-[15px] leading-relaxed text-slate-700">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-[12px] font-black text-emerald-900">
                              {index + 1}
                            </span>
                            <span className="flex-1">
                              {cleanText}
                              {match && <strong className="ml-1 font-extrabold text-emerald-800">{match[0]}</strong>}
                            </span>
                            {index === 0 ? (
                              <Wind size={18} className="shrink-0 text-teal-500" />
                            ) : index === 1 ? (
                              <Heart size={18} className="shrink-0 text-emerald-500" />
                            ) : index === 2 ? (
                              <Wind size={18} className="shrink-0 text-amber-500" />
                            ) : (
                              <RotateCcw size={18} className="shrink-0 text-teal-600" />
                            )}
                          </li>
                        );
                      })}
                    </ol>

                    {/* Control Buttons */}
                    {!completed ? (
                      <div className="mt-8 space-y-3 border-t border-slate-100 pt-6">
                        <button
                          type="button"
                          onClick={isRunning ? stopTimer : startTimer}
                          className="inline-flex min-h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 text-[15px] font-black text-white shadow-lg shadow-emerald-950/10 transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
                        >
                          {isRunning ? <Pause size={18} /> : <Play size={18} />}
                          <span>
                            {isRunning 
                              ? "Pause practice" 
                              : durationReached 
                              ? `Begin ${technique.title} again` 
                              : `Begin ${technique.duration}-minute practice`}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={nextTechnique}
                          className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-6 text-[14px] font-extrabold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99]"
                        >
                          <Sparkles size={16} className="text-amber-500" />
                          <span>
                            {activeStep === techniques.length - 1 
                              ? "Finish this practice" 
                              : "I am ready for the next practice"}
                          </span>
                          <ArrowRight size={16} />
                        </button>

                        {durationReached && (
                          <p className="mt-3 text-center text-[13px] font-medium text-slate-500">
                            You have reached the suggested time. Continue if it helps, or move on when you are ready.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-[14px] leading-relaxed text-emerald-900 backdrop-blur-sm">
                        <p className="flex items-center gap-2 font-bold">
                          <CheckCircle2 size={18} className="text-emerald-600" />
                          Practice completed
                        </p>
                        <p className="mt-1 text-slate-600">
                          You have finished this grounding practice. Take a quiet moment to notice what feels different, if anything.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Counter & Restart Row */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dashed border-slate-200 pb-4 text-[13px] font-medium text-slate-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-amber-800">
                      <Sparkles size={13} />
                    </span>
                    {completedCount} of {techniques.length} practices marked complete
                  </span>

                  <button
                    type="button"
                    onClick={restart}
                    className="inline-flex items-center gap-1.5 font-extrabold text-emerald-800 hover:underline underline-offset-4"
                  >
                    <RotateCcw size={14} />
                    <span>Start over</span>
                  </button>
                </div>

                {/* Urgent Support Accordion Footer */}
                <details className="group rounded-2xl border border-slate-200/80 bg-white/80 px-6 text-[14px] leading-relaxed text-slate-600 shadow-sm backdrop-blur-md transition-all">
                  <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between font-extrabold text-slate-800 select-none">
                    <span className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-600">
                        <MessageSquareHeart size={18} />
                      </span>
                      Need urgent support? You&apos;re not alone.
                    </span>
                    <span className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-extrabold text-rose-700">
                      Get help now ↗
                    </span>
                  </summary>
                  <div className="border-t border-slate-100 pb-5 pt-4 text-[13px] leading-relaxed text-slate-600">
                    If you may be in immediate danger or unable to stay safe, contact local emergency services or a local crisis support service now. If possible, reach out to someone you trust and stay with them.
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
