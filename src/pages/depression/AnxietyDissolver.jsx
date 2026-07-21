'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AnxietyDissolver() {
  const [activeStep, setActiveStep] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const techniques = [
    {
      title: "4-7-8 Breathing",
      duration: 4,
      icon: "ðŸ’¨",
      steps: [
        "Inhale quietly through nose for 4 seconds",
        "Hold breath for 7 seconds", 
        "Exhale completely through mouth for 8 seconds",
        "Repeat 4 cycles"
      ],
      color: "from-blue-400 to-cyan-400"
    },
    {
      title: "5-4-3-2-1 Grounding",
      duration: 2,
      icon: "ðŸŒ",
      steps: [
        "Name 5 things you see",
        "Name 4 things you can touch", 
        "Name 3 things you hear",
        "Name 2 things you smell",
        "Name 1 thing you taste"
      ],
      color: "from-purple-400 to-pink-400"
    },
    {
      title: "Progressive Muscle Relaxation",
      duration: 3,
      icon: "ðŸ’ª",
      steps: [
        "Tense shoulders for 5 seconds",
        "Release slowly for 10 seconds",
        "Move to arms, then legs",
        "Breathe deeply throughout"
      ],
      color: "from-emerald-400 to-teal-400"
    },
    {
      title: "Box Breathing",
      duration: 5,
      icon: "ðŸ“¦",
      steps: [
        "Inhale 4 seconds (visualize up)",
        "Hold 4 seconds (visualize across)", 
        "Exhale 4 seconds (visualize down)",
        "Hold 4 seconds (visualize across)",
        "Repeat cycle"
      ],
      color: "from-orange-400 to-red-400"
    }
  ];

  const startTimer = useCallback(() => {
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev >= techniques[activeStep].duration * 60) {
          clearInterval(intervalRef.current);
          setIsRunning(false);
          setActiveStep((prev) => (prev + 1) % techniques.length);
          setTimer(0);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  }, [activeStep, techniques]);

  const stopTimer = () => {
    setIsRunning(false);
    clearInterval(intervalRef.current);
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative card min-h-[650px] p-8 bg-gradient-to-br from-slate-50/70 via-white/50 to-[hsl(142_72%_36%)]/5 rounded-3xl shadow-2xl border border-white/60 backdrop-blur-xl overflow-hidden max-w-md mx-auto">
      
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(142_72%_36%)]/3 to-transparent" />
        <div className="absolute top-0 left-1/2 w-96 h-96 bg-[hsl(142_72%_36%)]/5 rounded-full blur-3xl -translate-x-1/2 animate-pulse" />
        <div className="absolute bottom-0 right-1/2 w-80 h-80 bg-[hsl(142_60%_45%)]/5 rounded-full blur-2xl translate-x-1/2 animate-pulse delay-1000" />
      </div>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 relative z-10"
      >
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white px-6 py-3 rounded-2xl font-bold shadow-2xl mb-4">
          <span className="text-2xl">{techniques[activeStep].icon}</span>
          {techniques[activeStep].title}
        </div>
        <h1 className="text-3xl font-black bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          Anxiety Dissolver
        </h1>
      </motion.div>

      {/* Timer Display */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative mb-8"
      >
        <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
            <path 
              className="text-gray-200 stroke-[hsl(142_72%_36%)]/20" 
              fill="none" 
              strokeWidth="4" 
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
            />
            <path 
              className={`stroke-[hsl(142_72%_36%)] fill-none stroke-[4] stroke-linecap-round stroke-linejoin-round transition-all duration-1000 ${isRunning ? 'animate-spin' : ''}`}
              strokeDasharray="100, 100"
              strokeDashoffset={Math.max(0, 100 - (timer / (techniques[activeStep].duration * 60)) * 100)}
              pathLength="1"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-mono font-bold text-[hsl(142_72%_36%)] tracking-wide">
              {formatTime(timer)}
            </div>
            <div className="text-sm font-medium text-gray-600 capitalize">
              {techniques[activeStep].duration} min session
            </div>
          </div>
        </div>
      </motion.div>

      {/* Technique Steps */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4 }}
          className="space-y-4 mb-12 relative z-10"  // Increased bottom margin
        >
          {techniques[activeStep].steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group flex items-start gap-4 p-4 bg-white/80 hover:bg-white/95 backdrop-blur-sm rounded-2xl border border-[hsl(142_72%_36%)]/20 hover:border-[hsl(142_72%_36%)]/40 transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_60%_45%)] rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md mt-1">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800 leading-relaxed group-hover:text-[hsl(142_72%_36%)] transition-colors">
                  {step}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-12 relative z-10">  {/* Added bottom margin */}
        <motion.button
          onClick={isRunning ? stopTimer : startTimer}
          className={`flex-1 py-4 px-6 rounded-2xl font-bold text-lg shadow-xl border-2 transition-all duration-300 flex items-center justify-center gap-3 ${
            isRunning
              ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white border-red-400 hover:shadow-red-500/25 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white border-[hsl(142_72%_36%)] hover:shadow-[hsl(142_72%_36%)]/25 hover:scale-[1.02] active:scale-[0.98]'
          }`}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          {isRunning ? (
            <>
              â¸ï¸ Pause
            </>
          ) : (
            <>
              â–¶ï¸ Start {techniques[activeStep].duration}min
            </>
          )}
        </motion.button>

        <motion.button
          onClick={() => setActiveStep((prev) => (prev + 1) % techniques.length)}
          className="px-6 py-4 bg-white/90 hover:bg-white text-gray-800 backdrop-blur-sm rounded-2xl font-bold shadow-xl border border-gray-200 hover:border-[hsl(142_72%_36%)]/30 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 active:scale-[0.98]"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          â†» Next Technique
        </motion.button>
      </div>

      {/* Progress indicator - FIXED VISIBILITY */}
      <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl shadow-2xl border-2 border-[hsl(142_72%_36%)]/30 mx-4 mb-8 pt-6"> {/* Increased padding, better contrast, more spacing */}
        <div className="flex items-center justify-center gap-3 text-sm font-semibold text-gray-800">
          <div className="w-3 h-3 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_60%_45%)] rounded-full shadow-lg animate-pulse" />
          <span className="tracking-wide">
            Progress: <span className="text-[hsl(142_72%_36%)] font-black text-lg">{activeStep + 1}</span> / {techniques.length} techniques mastered
          </span>
          <div className="w-3 h-3 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_60%_45%)] rounded-full shadow-lg animate-pulse ml-auto" />
        </div>
        {/* Visual progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
          <motion.div 
            className="h-2 bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_60%_45%)] rounded-full shadow-md"
            initial={{ width: 0 }}
            animate={{ width: `${((activeStep + 1) / techniques.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
}
