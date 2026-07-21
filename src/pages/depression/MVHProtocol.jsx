'use client';

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const steps = [
  {
    action: "Touch something cold",
    icon: "â„ï¸",
    why: "Cold sensation snaps your nervous system out of mental spirals and back into the present moment.",
    hint: "Fridge handle, metal spoon, water bottle, tile floor."
  },
  {
    action: "Take 1 sip of water",
    icon: "ðŸ’§",
    why: "Even a tiny sip tells your body 'I am taking care of you', which gently shifts you out of shutdown.",
    hint: "No perfect bottle needed. One small sip is enough."
  },
  {
    action: "Put on one sock",
    icon: "ðŸ§¦",
    why: "Micro-movement breaks the 'statue' effect of depression without demanding full dressing or showering.",
    hint: "If socks are too far, adjust: move one foot, flex toes."
  },
  {
    action: "Stand up for 3 seconds",
    icon: "ðŸš¶",
    why: "Changing posture sends powerful signals to your brain that 'we are not completely stuck'.",
    hint: "Stand beside bed, hold onto wall or chair if needed."
  },
  {
    action: "Protocol complete",
    icon: "âœ…",
    why: "You just completed a full tiny protocol. Thatâ€™s behavioral activation in action.",
    hint: "Youâ€™re allowed to stop here. Anything more is bonus."
  }
];

export default function MVHProtocol() {
  const [step, setStep] = useState(0);

  const percentage = Math.round((step / (steps.length - 1)) * 100);

  const next = () => {
    setStep(prev => (prev < steps.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="max-w-md mx-auto p-6 md:p-8 bg-white/80 rounded-3xl shadow-2xl border border-[hsl(142_72%_36%)]/15 backdrop-blur-sm space-y-6 text-center">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-4 py-2 rounded-2xl text-xs font-semibold shadow-lg">
          Lowâ€‘Energy Mode
        </div>
        <h1 className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
          MVH Protocol
        </h1>
        <p className="text-xs text-gray-600">
          Minimum Viable Human: 4 microâ€‘actions to prove you are still here.
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

      {/* Completion badge */}
      {step === steps.length - 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800"
        >
          You just completed the minimum viable protocol. You did something.
          That always counts, even if your brain says it doesnâ€™t.
        </motion.div>
      )}

      {/* Next button */}
      <motion.button
        className="primaryButton w-full bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white rounded-2xl py-3 text-sm font-bold shadow-xl"
        onClick={next}
        whileHover={{ y: -2, scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
      >
        {step === steps.length - 1 ? "Restart protocol" : "I did this â†’ Next"}
      </motion.button>

      {/* Tiny footer reassurance */}
      <p className="text-[11px] text-gray-500 text-left">
        If you only manage step 1 today, the protocol still worked.
      </p>
    </div>
  );
}
