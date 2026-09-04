'use client';

import React, { useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronRight, Info, Leaf, RotateCcw, ShieldCheck, Sparkles, Sprout } from "lucide-react";
import { useAuth } from '@/context/AuthContext';
import { useFeatureAdaptation } from '@/hooks/useFeatureAdaptation';
import { useContextStateOptional } from '@/context/ContextProvider';
import { useInterventionLifecycle } from '@/support/execution';
import { buildGentleActivityOutcome } from '@/support/modules/gentleActivity/gentleActivityService';
import { GENTLE_ACTIVITY_MODULE_ID } from '@/support/modules/gentleActivity/gentleActivityTypes';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

const steps = [
  { action: "Touch something cold", why: "A cold sensation can help you pause and notice the present moment.", hint: "A fridge handle, metal spoon, water bottle, or tile floor can work." },
  { action: "Take 1 sip of water", why: "A small sip can be one manageable act of care.", hint: "No perfect bottle is needed. One small sip is enough." },
  { action: "Put on one sock", why: "A small movement can make the next action feel more manageable.", hint: "If a sock is too far away, move one foot or flex your toes instead." },
  { action: "Stand up for 3 seconds", why: "Changing posture can create a brief reset.", hint: "Hold a wall or chair if that helps. Staying seated is also okay." },
  { action: "Protocol complete", why: "You completed the activity sequence.", hint: "You can stop here. Anything else is optional." },
];

const energyLevels = [
  { value: 1, label: "Very low", color: "bg-rose-100 text-rose-800 border-rose-200", emoji: "😞" },
  { value: 2, label: "Low", color: "bg-amber-100 text-amber-800 border-amber-200", emoji: "😕" },
  { value: 3, label: "Meh", color: "bg-yellow-100 text-yellow-800 border-yellow-200", emoji: "😐" },
  { value: 4, label: "Okay", color: "bg-emerald-100 text-emerald-800 border-emerald-200", emoji: "🙂" },
  { value: 5, label: "Good", color: "bg-teal-100 text-teal-800 border-teal-200", emoji: "😄" },
];

function EnergyPicker({ label, value, onChange }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-black uppercase tracking-wider text-slate-800">{label}</p>
        <span className="text-[11px] font-medium text-slate-500">How do you feel?</span>
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-1.5" role="radiogroup" aria-label={`${label} energy`}>
        {energyLevels.map((level) => {
          const isSelected = value === level.value;
          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(isSelected ? null : level.value)}
              className={`group flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl p-1.5 transition-all focus:outline-none ${
                isSelected ? "bg-slate-100/80 ring-2 ring-emerald-600/30" : "hover:bg-slate-50"
              }`}
            >
              <span 
                aria-hidden="true" 
                className={`grid h-9 w-9 place-items-center rounded-full border text-[18px] transition-transform duration-200 group-hover:scale-105 ${level.color} ${
                  isSelected ? "scale-110 shadow-sm ring-2 ring-emerald-600 ring-offset-2" : ""
                }`}
              >
                {level.emoji}
              </span>
              <span className={`text-[10px] font-bold tracking-tight transition-colors ${
                isSelected ? "text-slate-900 font-extrabold" : "text-slate-500"
              }`}>
                {level.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function MVHProtocol() {
  const { user } = useAuth();
  const context = useContextStateOptional()?.context ?? null;
  const adaptation = useFeatureAdaptation("support.gentle_activity", {
    getAppSnapshot: () => context,
    userId: user?.id ?? null,
  });
  const adaptiveConfig = adaptation.configuration;
  const [step, setStep] = useState(0);
  const [energyBefore, setEnergyBefore] = useState(null);
  const [energyAfter, setEnergyAfter] = useState(null);
  const startedAtRef = useRef(null);
  const completedRef = useRef(false);

  // When the engine decision is live and suggests a gentler session, show
  // fewer steps so the user only needs a smaller activation. The actions
  // themselves remain unchanged.
  const effectiveTotalSteps =
    adaptiveConfig?.active && adaptiveConfig.visibleSteps
      ? Math.min(adaptiveConfig.visibleSteps, steps.length)
      : steps.length;

  const lifecycle = useInterventionLifecycle({ userId: user?.id ?? null, moduleId: GENTLE_ACTIVITY_MODULE_ID, planId: null, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: { pacing: adaptiveConfig?.active ? (adaptiveConfig.pacingHint ?? 'gentle') : 'gentle', totalSteps: effectiveTotalSteps } });
  const isComplete = step === effectiveTotalSteps - 1;
  const completedSteps = Math.min(step + 1, effectiveTotalSteps);

  const next = async () => {
    if (!lifecycle.hasStarted && user?.id) {
      const started = await lifecycle.start();
      if (!started.ok) return;
      startedAtRef.current = Date.now();
    }
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'gentle_activity_step', completedUnits: completedSteps, totalUnits: effectiveTotalSteps, progressRatio: completedSteps / effectiveTotalSteps });
    if (completedSteps === effectiveTotalSteps) {
      if (user?.id && !completedRef.current) {
        completedRef.current = true;
        await lifecycle.complete(buildGentleActivityOutcome({ configuration: { pacing: adaptiveConfig?.active ? (adaptiveConfig.pacingHint ?? 'gentle') : 'gentle', totalSteps: effectiveTotalSteps }, completedSteps, energyBefore, energyAfter, startedAt: startedAtRef.current }));
      }
      setStep(0);
      lifecycle.reset();
      completedRef.current = false;
      return;
    }
    setStep(completedSteps);
  };

  const reset = async () => {
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.abandon('user_reset', {}, buildGentleActivityOutcome({ configuration: { pacing: adaptiveConfig?.active ? (adaptiveConfig.pacingHint ?? 'gentle') : 'gentle', totalSteps: effectiveTotalSteps }, completedSteps: step, energyBefore, energyAfter, startedAt: startedAtRef.current }));
    setStep(0);
    lifecycle.reset();
  };

  return (
    <SupportToolThemeProvider theme="depression_gentle">
      <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
        <main className="relative min-h-screen w-full overflow-hidden bg-[#faf8f5] text-[#2c3242] antialiased selection:bg-rose-200">
          
          {/* Subtle Ambient Background Gradients */}
          <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full bg-teal-300/20 blur-3xl" />

          <div className="relative mx-auto w-full max-w-[1200px] space-y-8 px-5 py-8 sm:px-8 sm:py-12 lg:px-12 lg:py-14">
            
            {/* Outer Container Card */}
            <div className="rounded-[32px] border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-900/[0.03] backdrop-blur-md sm:p-10 lg:p-12">
              <div className="mx-auto max-w-[960px] space-y-8">
                
                {/* Header Banner */}
                <header className="relative -mx-6 -mt-6 overflow-hidden rounded-t-[28px] border-b border-slate-200/70 bg-gradient-to-br from-white via-slate-50/60 to-emerald-50/30 sm:-mx-10 sm:-mt-10 lg:-mx-12 lg:-mt-12">
                  <div className="relative flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
                    <div className="flex items-center justify-between gap-4">
                      <p className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[.18em] text-emerald-900">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-800 shadow-sm">
                          <Leaf size={16} />
                        </span>
                        Gentle Activity
                      </p>

                      <aside className="hidden items-center gap-3 rounded-2xl border border-emerald-100 bg-white/90 px-4 py-2 text-[12px] font-semibold text-slate-600 shadow-sm backdrop-blur-sm sm:flex">
                        <Sprout size={16} className="text-emerald-600" />
                        <span>You&apos;re showing up for yourself. That matters.</span>
                      </aside>
                    </div>

                    <h1 className="mt-4 text-[36px] font-black leading-tight tracking-[-.04em] text-slate-900 sm:text-[46px]">
                      One small thing <span className="block text-emerald-700">at a time.</span>
                    </h1>

                    <p className="mt-3 max-w-[540px] text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
                      There is no need to rush, push hard, or finish every step.
                    </p>

                    {/* Progress Bar with Floating Sprout Badge */}
                    <div className="relative mt-8" aria-label={`Step ${step + 1} of ${effectiveTotalSteps}`}>
                      <div className="mb-2.5 flex items-center justify-between text-[12px] font-bold text-slate-600">
                        <span className="uppercase tracking-wider text-emerald-900">Step {step + 1} of {effectiveTotalSteps}</span>
                        <span>{isComplete ? "Finished" : "Take your time"}</span>
                      </div>
                      
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/60">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" 
                          style={{ width: `${Math.round((step / (effectiveTotalSteps - 1)) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </header>

                {/* Main Step Display Card */}
                {adaptiveConfig?.active && (
                  <p className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-[13px] font-semibold text-emerald-800">
                    {adaptiveConfig.visibleSteps && adaptiveConfig.visibleSteps < steps.length
                      ? "Adapted for you: a shorter, gentler session — fewer steps today."
                      : "Adapted for you: gentle pacing — no need to rush."}
                    {adaptation.reason ? ` ${adaptation.reason}` : ""}
                  </p>
                )}
                <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-md shadow-slate-900/[0.02] transition-all duration-300 hover:-translate-y-1 hover:shadow-md sm:p-6" aria-live="polite">
                  <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.16em] text-emerald-800">
                    <Sparkles size={14} className="text-amber-500" />
                    {isComplete ? "Finished" : "Your next small action"}
                  </p>

                  <h2 className="mt-2 text-[26px] font-black tracking-[-.03em] text-slate-900 sm:text-[32px]">
                    {isComplete ? "You have done enough for now." : steps[step].action}
                  </h2>

                  <p className="mt-2.5 max-w-[720px] text-[15px] leading-relaxed text-slate-600 sm:text-[16px]">
                    {steps[step].why}
                  </p>

                  <div className="mt-6 flex items-start gap-3.5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/30 p-4 shadow-sm">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
                      <Info size={15} />
                    </span>
                    <div className="text-[13px] leading-relaxed text-slate-700">
                      <strong className="mr-2 font-black text-emerald-950">Examples & Hints:</strong>
                      {steps[step].hint}
                    </div>
                  </div>
                </section>

                {/* Optional Energy Check-In Box */}
                <fieldset className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/30 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md backdrop-blur-sm sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[.14em] text-emerald-900">
                      <Leaf size={15} />
                      Optional energy check-in
                    </p>
                    <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
                      Skip anytime
                    </span>
                  </div>

                  <div className="grid items-center gap-4 sm:grid-cols-[1fr_36px_1fr] sm:gap-5">
                    <EnergyPicker label="Before" value={energyBefore} onChange={setEnergyBefore} />
                    
                    <div className="hidden place-items-center text-slate-400 sm:grid">
                      <ChevronRight size={22} className="text-emerald-600" />
                    </div>

                    <EnergyPicker label="After" value={energyAfter} onChange={setEnergyAfter} />
                  </div>
                </fieldset>

                {/* Primary Action & Controls */}
                <div className="space-y-4">
                  <button 
                    type="button"
                    onClick={next}
                    className="inline-flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-[15px] font-black text-white shadow-lg shadow-emerald-950/10 transition-all duration-200 hover:brightness-110 active:scale-[0.99]"
                  >
                    <span>{isComplete ? "Start again" : "I did this. Next step"}</span>
                    {isComplete ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                    {step > 0 ? (
                      <button 
                        type="button"
                        onClick={reset} 
                        className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-slate-600 hover:text-slate-900 hover:underline underline-offset-4"
                      >
                        <RotateCcw size={14} />
                        <span>Reset activity</span>
                      </button>
                    ) : <span />}

                    {!user?.id && (
                      <p role="alert" className="text-[12px] font-medium text-amber-800">
                        Sign in to save activity progress and outcomes. You can still use this locally.
                      </p>
                    )}
                  </div>
                </div>

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
                    If you may act on thoughts of harming yourself or are in immediate danger, contact your local emergency number or a local crisis service now. If you can, tell someone nearby that you need support.
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
