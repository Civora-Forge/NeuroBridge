'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
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
          setDurationReached(true); setIsRunning(false);
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
  const restart = async () => { stopTimer(); if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.abandon('user_restart', {}, buildGroundingOutcome({ configuration, completedSteps: completedCount, suggestedDurationsReached: reachedCount, techniquesCompletedEarly: earlyCount, currentTechniqueId: configuration.techniqueOrder[activeStep], startedAt: startedAtRef.current })); lifecycle.reset(); setActiveStep(0); setTimer(0); setCompleted(false); setCompletedCount(0); setReachedCount(0); setEarlyCount(0); setDurationReached(false); };

  useEffect(() => () => clearInterval(intervalRef.current), []);
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
  const technique = techniques[activeStep];

  return (
    <SupportToolThemeProvider theme="depression_gentle">
      <SupportToolLayout>
        <main className="mx-auto w-full max-w-xl space-y-5 px-1 py-3 text-stone-800">
          <header className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">A short grounding practice</p>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Come back to the present</h1>
            <p className="max-w-lg text-sm leading-6 text-stone-600">There is no right way to do this. Try one small practice at your own pace.</p>
          </header>

          <section className="rounded-2xl border border-stone-200 bg-[#fffdf8] p-5 shadow-sm" aria-labelledby="practice-title">
            <div className="flex items-baseline justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <p className="text-xs font-medium text-stone-500">Practice {activeStep + 1} of {techniques.length}</p>
                <h2 id="practice-title" className="mt-1 text-lg font-semibold text-stone-900">{technique.title}</h2>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-semibold tabular-nums text-stone-800">{formatTime(timer)}</p>
                <p className="text-xs text-stone-500">{technique.duration} minutes suggested</p>
              </div>
            </div>

            <ol className="mt-4 space-y-3">
              {technique.steps.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm leading-6 text-stone-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eee6d8] text-xs font-semibold text-stone-700">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          {!completed && (
            <section className="space-y-3" aria-label="Practice controls">
              <button onClick={isRunning ? stopTimer : startTimer} className="w-full rounded-xl bg-stone-800 px-4 py-3 text-sm font-semibold text-[#fffdf8] transition-colors hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2">
                {isRunning ? "Pause practice" : durationReached ? `Begin ${technique.title} again` : `Begin ${technique.duration}-minute practice`}
              </button>
              <button onClick={nextTechnique} className="w-full rounded-xl border border-stone-300 bg-[#fffdf8] px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2">
                {activeStep === techniques.length - 1 ? "Finish this practice" : "I am ready for the next practice"}
              </button>
              {durationReached && <p className="text-center text-xs leading-5 text-stone-600">You have reached the suggested time. Continue if it helps, or move on when you are ready.</p>}
            </section>
          )}

          {completed && <p className="rounded-xl border border-[#d8dfd0] bg-[#f4f7f0] px-4 py-3 text-sm leading-6 text-stone-700">You have finished this grounding practice. Take a moment to notice what feels different, if anything.</p>}

          <div className="flex items-center justify-between border-t border-stone-200 pt-4 text-xs text-stone-500">
            <span>{completedCount} of {techniques.length} practices marked complete</span>
            <button onClick={restart} className="underline underline-offset-2 hover:text-stone-800">Start over</button>
          </div>

          <footer className="border-t border-stone-200 pt-4">
            <details className="text-xs leading-5 text-stone-600">
              <summary className="cursor-pointer font-medium text-stone-700">Need urgent support?</summary>
              <p className="mt-2">If you may be in immediate danger or unable to stay safe, contact local emergency services or a local crisis support service now. If possible, reach out to someone you trust and stay with them.</p>
            </details>
          </footer>
        </main>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
