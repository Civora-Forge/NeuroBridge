'use client';

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from '@/context/AuthContext';
import { useInterventionLifecycle } from '@/support/execution';
import { buildGentleActivityOutcome } from '@/support/modules/gentleActivity/gentleActivityService';
import { GENTLE_ACTIVITY_MODULE_ID } from '@/support/modules/gentleActivity/gentleActivityTypes';

const steps = [
  {
    action: "Touch something cold",
    icon: "Cold",
    why: "A cold sensation can help you pause and notice the present moment.",
    hint: "Fridge handle, metal spoon, water bottle, tile floor."
  },
  {
    action: "Take 1 sip of water",
    icon: "Water",
    why: "A small sip can be one manageable act of care.",
    hint: "No perfect bottle needed. One small sip is enough."
  },
  {
    action: "Put on one sock",
    icon: "Move",
    why: "A small movement can make the next action feel more manageable.",
    hint: "If socks are too far, adjust: move one foot, flex toes."
  },
  {
    action: "Stand up for 3 seconds",
    icon: "Stand",
    why: "Changing posture can create a brief reset.",
    hint: "Stand beside bed, hold onto wall or chair if needed."
  },
  {
    action: "Protocol complete",
    icon: "Done",
    why: "You completed the activity sequence.",
    hint: "You can stop here. Any additional action is optional."
  }
];

export default function MVHProtocol() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [energyBefore, setEnergyBefore] = useState(null);
  const [energyAfter, setEnergyAfter] = useState(null);
  const startedAtRef = useRef(null);
  const completedRef = useRef(false);
  const lifecycle = useInterventionLifecycle({ userId: user?.id ?? null, moduleId: GENTLE_ACTIVITY_MODULE_ID, planId: null, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: { pacing: 'gentle', totalSteps: steps.length } });

  const percentage = Math.round((step / (steps.length - 1)) * 100);

  const next = async () => {
    const completedSteps = Math.min(step + 1, steps.length);
    if (!lifecycle.hasStarted && user?.id) {
      const started = await lifecycle.start();
      if (!started.ok) return;
      startedAtRef.current = Date.now();
    }
    if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.progress({ progressType: 'gentle_activity_step', completedUnits: completedSteps, totalUnits: steps.length, progressRatio: completedSteps / steps.length });
    if (completedSteps === steps.length) {
      if (user?.id && !completedRef.current) { completedRef.current = true; await lifecycle.complete(buildGentleActivityOutcome({ configuration: { pacing: 'gentle', totalSteps: steps.length }, completedSteps, energyBefore, energyAfter, startedAt: startedAtRef.current })); }
      setStep(0); lifecycle.reset(); completedRef.current = false; return;
    }
    setStep(completedSteps);
  };
  const reset = async () => { if (user?.id && lifecycle.hasStarted && !lifecycle.isTerminal) await lifecycle.abandon('user_reset', {}, buildGentleActivityOutcome({ configuration: { pacing: 'gentle', totalSteps: steps.length }, completedSteps: step, energyBefore, energyAfter, startedAt: startedAtRef.current })); setStep(0); lifecycle.reset(); };

  return (
    <div className="max-w-md mx-auto p-6 md:p-8 bg-white/80 rounded-3xl shadow-2xl border border-[hsl(142_72%_36%)]/15 backdrop-blur-sm space-y-6 text-center">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-4 py-2 rounded-2xl text-xs font-semibold shadow-lg">
           Low-Energy Mode
        </div>
        <h1 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
           Gentle Activity
        </h1>
        <p className="text-xs text-gray-600">
           Choose one small action at a time.
        </p>
      </motion.div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Step {step + 1} of {steps.length}</span>
          <span>{percentage}% complete</span>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
          <motion.div
            className="h-2 rounded-full bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)]"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {/* Current step */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="flex flex-col items-center gap-3">
            <motion.div
              className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[hsl(142_72%_36%)]/15 to-[hsl(142_66%_42%)]/10 flex items-center justify-center shadow-lg"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <span className="text-3xl">{steps[step].icon}</span>
            </motion.div>
            <p className="text-lg font-semibold text-gray-900">
              {steps[step].action}
            </p>
          </div>

          <div className="space-y-3 text-left text-sm">
            <div className="bg-[hsl(142_72%_36%)]/5 border border-[hsl(142_72%_36%)]/20 rounded-2xl p-3">
              <p className="text-[11px] font-semibold text-[hsl(142_72%_36%)] mb-1 uppercase tracking-wide">
                Why this helps
              </p>
              <p className="text-gray-800 leading-relaxed">
                {steps[step].why}
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3">
              <p className="text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                If this feels impossible
              </p>
              <p className="text-gray-700 leading-relaxed">
                {steps[step].hint}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-center gap-3 text-xs text-gray-600"><label>Energy before <select value={energyBefore ?? ''} onChange={(event) => setEnergyBefore(event.target.value ? Number(event.target.value) : null)}><option value="">Optional</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Energy after <select value={energyAfter ?? ''} onChange={(event) => setEnergyAfter(event.target.value ? Number(event.target.value) : null)}><option value="">Optional</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>

      {/* Completion badge */}
      {step === steps.length - 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800"
        >
          You just completed the minimum viable protocol. You did something.
           Small actions can still matter.
        </motion.div>
      )}

      {/* Next button */}
      <motion.button
        className="primaryButton w-full bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white rounded-2xl py-3 text-sm font-bold shadow-xl"
        onClick={next}
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
      >
         {step === steps.length - 1 ? "Restart activity" : "I did this. Next"}
      </motion.button>
       {step > 0 && <button onClick={reset} className="text-xs text-gray-500">Reset activity</button>}
       {!user?.id && <p role="alert" className="text-xs text-amber-700">Sign in to save activity progress and outcomes. You can still use this locally.</p>}

      {/* Tiny footer reassurance */}
      <p className="text-[11px] text-gray-500 text-left">
         If you only complete one step today, that is still progress.
      </p>
    </div>
  );
}
