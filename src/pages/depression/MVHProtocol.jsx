'use client';

import React, { useRef, useState } from "react";
import { useAuth } from '@/context/AuthContext';
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

export default function MVHProtocol() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [energyBefore, setEnergyBefore] = useState(null);
  const [energyAfter, setEnergyAfter] = useState(null);
  const startedAtRef = useRef(null);
  const completedRef = useRef(false);
  const lifecycle = useInterventionLifecycle({ userId: user?.id ?? null, moduleId: GENTLE_ACTIVITY_MODULE_ID, planId: null, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: { pacing: 'gentle', totalSteps: steps.length } });
  const isComplete = step === steps.length - 1;
  const completedSteps = Math.min(step + 1, steps.length);

  const next = async () => {
    if (!lifecycle.hasStarted && user?.id) {
      const started = await lifecycle.start();
      if (!started.ok) return;
      startedAtRef.current = Date.now();
    }
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'gentle_activity_step', completedUnits: completedSteps, totalUnits: steps.length, progressRatio: completedSteps / steps.length });
    if (completedSteps === steps.length) {
      if (user?.id && !completedRef.current) {
        completedRef.current = true;
        await lifecycle.complete(buildGentleActivityOutcome({ configuration: { pacing: 'gentle', totalSteps: steps.length }, completedSteps, energyBefore, energyAfter, startedAt: startedAtRef.current }));
      }
      setStep(0);
      lifecycle.reset();
      completedRef.current = false;
      return;
    }
    setStep(completedSteps);
  };

  const reset = async () => {
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.abandon('user_reset', {}, buildGentleActivityOutcome({ configuration: { pacing: 'gentle', totalSteps: steps.length }, completedSteps: step, energyBefore, energyAfter, startedAt: startedAtRef.current }));
    setStep(0);
    lifecycle.reset();
  };

  return (
    <SupportToolThemeProvider theme="depression_gentle">
      <SupportToolLayout>
        <div className="space-y-6 rounded-2xl border border-[#c9ddcd] bg-white p-5 text-[#26372c] shadow-sm sm:p-7">
          <header>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#5f7865]">Gentle Activity</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">One small thing at a time.</h1>
            <p className="mt-2 text-sm leading-6 text-[#526556]">There is no need to rush or finish every step.</p>
          </header>

          <div aria-label={`Step ${step + 1} of ${steps.length}`}>
            <div className="mb-2 flex justify-between text-xs text-[#716959]"><span>Step {step + 1} of {steps.length}</span><span>{isComplete ? "Finished" : "Take your time"}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#e1f0e4]"><div className="h-full rounded-full bg-[#3f7654]" style={{ width: `${Math.round((step / (steps.length - 1)) * 100)}%` }} /></div>
          </div>

          <section className="rounded-xl bg-[#edf7ef] p-5" aria-live="polite">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#5f7865]">{isComplete ? "Finished" : "Your next small action"}</p>
            <h2 className="mt-2 text-xl font-semibold text-[#26372c]">{isComplete ? "You have done enough for now." : steps[step].action}</h2>
            <p className="mt-3 text-sm leading-6 text-[#526556]">{steps[step].why}</p>
            <p className="mt-3 border-l-2 border-[#a9cdb0] pl-3 text-sm leading-6 text-[#526556]">{steps[step].hint}</p>
          </section>

          <fieldset className="grid gap-3 border-0 p-0 sm:grid-cols-2">
            <legend className="mb-2 text-xs text-[#716959]">Optional energy check-in</legend>
            <label className="text-xs text-[#5e574a]">Before
              <select className="mt-1 block w-full rounded-md border border-[#c9ddcd] bg-white px-2 py-2 text-sm text-[#26372c]" value={energyBefore ?? ''} onChange={(event) => setEnergyBefore(event.target.value ? Number(event.target.value) : null)}>
                <option value="">Skip</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-xs text-[#5e574a]">After
              <select className="mt-1 block w-full rounded-md border border-[#c9ddcd] bg-white px-2 py-2 text-sm text-[#26372c]" value={energyAfter ?? ''} onChange={(event) => setEnergyAfter(event.target.value ? Number(event.target.value) : null)}>
                <option value="">Skip</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </fieldset>

          <div className="space-y-3">
            <button className="primaryButton w-full rounded-lg bg-[#6d5c3d] px-4 py-3 text-sm font-semibold text-white" onClick={next}>{isComplete ? "Start again" : "I did this. Next"}</button>
            {step > 0 && <button onClick={reset} className="block w-full text-xs text-[#6a6254] underline underline-offset-4">Reset activity</button>}
            {!user?.id && <p role="alert" className="text-xs leading-5 text-[#7a5a28]">Sign in to save activity progress and outcomes. You can still use this locally.</p>}
          </div>

          <details className="border-t border-[#d5e8d8] pt-4 text-xs leading-5 text-[#526556]">
            <summary className="cursor-pointer font-medium text-[#5d513c]">Need urgent support?</summary>
            <p className="mt-2">If you may act on thoughts of harming yourself or are in immediate danger, contact your local emergency number or a local crisis service now. If you can, tell someone nearby that you need support.</p>
          </details>
        </div>
      </SupportToolLayout>
    </SupportToolThemeProvider>
  );
}
