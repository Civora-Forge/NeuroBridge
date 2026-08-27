import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Timer, Play, Pause, XCircle, CheckCircle2, ArrowRight, Activity, RefreshCw, Check } from 'lucide-react';
import { createSession } from '@/api/ocdApi';
import useOcdStore from '@/stores/useOcdStore';

const INTERVENTIONS = {
  body: [
    'Press your feet firmly into the floor for 10 seconds, then release.',
    'Unclench your jaw and let your tongue rest on the bottom of your mouth.',
    'Place both hands flat on your thighs and feel the pressure. Stay there.',
  ],
  breath: [
    'Breathe out fully — longer than your inhale. Do this 4 times.',
    'Inhale for 4, hold for 4, exhale for 6. Repeat twice.',
    'Take one very slow breath. Focus only on the air moving.',
  ],
  cognitive: [
    'Say to yourself: I notice I am having the urge to...',
    'This thought is visiting. You do not have to entertain it.',
    'The urge is a feeling in your body. It will peak and subside.',
  ]
};

const COMPULSION_TYPES = ['Checking', 'Washing', 'Ordering', 'Mental ritual', 'Reassurance seeking', 'Avoidance'];

const COMPULSION_EMOJIS = {
  'Checking': '🔒',
  'Washing': '🧼',
  'Ordering': '📏',
  'Mental ritual': '🧠',
  'Reassurance seeking': '🗣️',
  'Avoidance': '🏃'
};

const VisualSudsSelector = ({ value, onChange, label }) => {
  return (
    <div className="w-full space-y-4 my-6">
      <div className="flex justify-between items-end mb-2">
         <span className="text-slate-500 font-medium">{label || 'Distress Level (SUDS)'}</span>
         <motion.span 
           key={value} 
           initial={{ scale: 1.2, opacity: 0 }} 
           animate={{ scale: 1, opacity: 1 }} 
           className="text-4xl font-black text-slate-800"
         >
           {value}
         </motion.span>
      </div>
      
      <div className="relative h-12 flex items-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 opacity-80 h-3 my-auto shadow-inner"></div>
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={value} 
          onChange={(e) => onChange(Number(e.target.value))} 
          className="w-full absolute inset-0 opacity-0 cursor-pointer h-full z-20"
        />
        <motion.div 
          className="absolute h-8 w-8 bg-white rounded-full shadow-lg border-2 border-slate-100 flex items-center justify-center z-10 pointer-events-none"
          animate={{ left: `calc(${value}% - 16px)` }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="w-3 h-3 rounded-full bg-sky-500 shadow-sm" />
        </motion.div>
      </div>
      <div className="flex justify-between text-2xl px-1">
        <span>😌</span>
        <span>😐</span>
        <span>😰</span>
        <span>😫</span>
      </div>
    </div>
  );
};

const CircularTimer = ({ timeLeft, initialTime }) => {
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = initialTime > 0 ? ((initialTime - timeLeft) / initialTime) * 100 : 0;
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = (progress / 100) * circumference;

  return (
    <div className="relative flex justify-center items-center w-[300px] h-[300px] mx-auto my-8">
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle 
          cx="150" cy="150" r={radius} 
          className="text-sky-100" 
          strokeWidth="16" 
          stroke="currentColor" 
          fill="none" 
        />
        <circle 
          cx="150" cy="150" r={radius} 
          className="text-cyan-500 drop-shadow-md transition-all duration-1000 ease-linear" 
          strokeWidth="16" 
          strokeLinecap="round"
          stroke="currentColor" 
          fill="none" 
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-6xl font-black text-slate-800 tracking-tighter tabular-nums drop-shadow-sm">
          {formatTime(timeLeft)}
        </span>
        <span className="text-sky-600 font-semibold mt-2 tracking-widest uppercase text-sm">
          Remaining
        </span>
      </div>
    </div>
  );
};

export default function ExposureSessionTimer() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('pick'); // 'pick' | 'preSuds' | 'running' | 'postSuds' | 'done'
  const [compulsionType, setCompulsionType] = useState('');
  const [initialTime, setInitialTime] = useState(300); // 5 mins
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [preSuds, setPreSuds] = useState(50);
  const [postSuds, setPostSuds] = useState(50);
  const [resisted, setResisted] = useState(null);
  const [currentIntervention, setCurrentIntervention] = useState('');
  const [interventionCategory, setInterventionCategory] = useState('body');
  const { currentSuds, setCurrentSuds, addSessionSudsLog } = useOcdStore();

  const sessionMutation = useMutation({
    mutationFn: createSession,
    onSuccess: () => queryClient.invalidateQueries(['sessions']),
  });

  const rotateIntervention = useCallback(() => {
    const categories = ['body', 'breath', 'cognitive'];
    const nextCat = categories[(categories.indexOf(interventionCategory) + 1) % categories.length];
    setInterventionCategory(nextCat);
    const items = INTERVENTIONS[nextCat];
    setCurrentIntervention(items[Math.floor(Math.random() * items.length)]);
  }, [interventionCategory]);

  useEffect(() => {
    let interval = null;
    if (phase === 'running' && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
        if (timeLeft % 30 === 0) addSessionSudsLog(currentSuds);
      }, 1000);
    } else if (phase === 'running' && timeLeft === 0) {
      setPhase('postSuds');
    }
    return () => clearInterval(interval);
  }, [phase, isPaused, timeLeft, currentSuds, addSessionSudsLog]);

  useEffect(() => {
    if (phase === 'running') {
      rotateIntervention();
      const intInterval = setInterval(rotateIntervention, 45000);
      return () => clearInterval(intInterval);
    }
  }, [phase, rotateIntervention]);

  const handleStartTimer = () => {
    setTimeLeft(initialTime);
    setPhase('running');
    rotateIntervention();
  };

  const handleSave = () => {
    if (resisted === null) return;
    const outcome = resisted ? 'resisted' : 'gave_in';
    sessionMutation.mutate({
      compulsion_type: compulsionType,
      pre_suds: preSuds,
      post_suds: postSuds,
      duration_seconds: initialTime - timeLeft,
      resisted,
      outcome,
    });
    setPhase('done');
  };

  const getContextualMessage = () => {
    if (initialTime === 0) return "Keep going!";
    const p = ((initialTime - timeLeft) / initialTime) * 100;
    if (p < 20) return "You've got this. The urge is just a feeling.";
    if (p < 50) return "Notice the urge peaking. It will pass.";
    if (p < 80) return "You are doing great. Keep riding the wave.";
    return "Almost there! The hardest part is over.";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-cyan-50/20 text-slate-800 font-sans selection:bg-cyan-200">
      <header className="bg-white/80 backdrop-blur-md border-b border-sky-100 px-4 py-4 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/ocd" className="p-2 -ml-2 rounded-full hover:bg-sky-50 text-slate-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                Delay Coach <span className="bg-cyan-100 text-cyan-700 text-[10px] uppercase tracking-bold px-2 py-0.5 rounded-full font-black">Pro</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 pb-24">
        <AnimatePresence mode="wait">
          {phase === 'pick' && (
            <motion.div 
              key="pick" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2 mb-8">
                <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-sky-500">Delay Coach</h1>
                <p className="text-slate-500 font-medium">Build tolerance by delaying the urge.</p>
              </div>

              <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-xl shadow-sky-100/50">
                <h2 className="text-sm font-black uppercase tracking-widest text-sky-400 mb-4">1. What's the urge?</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {COMPULSION_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setCompulsionType(type)}
                      className={`relative overflow-hidden flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300 border-2 ${
                        compulsionType === type 
                          ? 'border-cyan-400 bg-cyan-50 shadow-md shadow-cyan-100 text-cyan-900 scale-105 z-10' 
                          : 'border-transparent bg-white text-slate-600 hover:bg-slate-50 hover:scale-105'
                      }`}
                    >
                      <span className="text-3xl">{COMPULSION_EMOJIS[type] || '⚡'}</span>
                      <span className="text-xs font-bold text-center leading-tight">{type}</span>
                      {compulsionType === type && (
                         <motion.div layoutId="active-badge" className="absolute top-1 right-1 bg-cyan-400 text-white rounded-full p-0.5">
                           <Check className="w-3 h-3" />
                         </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`transition-all duration-500 ${!compulsionType ? 'opacity-40 grayscale pointer-events-none translate-y-4' : 'opacity-100 translate-y-0'}`}>
                <div className="bg-white/60 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-xl shadow-sky-100/50">
                  <h2 className="text-sm font-black uppercase tracking-widest text-sky-400 mb-4">2. Set Target Time</h2>
                  
                  <div className="flex flex-wrap gap-3 mb-6">
                    {[5, 10, 15, 20, 30].map(mins => (
                      <button 
                        key={mins} 
                        onClick={() => setInitialTime(mins * 60)} 
                        className={`flex-1 min-w-[70px] py-3 rounded-xl font-bold transition-colors ${
                          initialTime === mins * 60 
                            ? 'bg-slate-800 text-white shadow-lg shadow-slate-300' 
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>

                  <div className="px-2">
                    <div className="flex justify-between text-xs font-bold text-slate-400 mb-2 uppercase">
                      <span>1 min</span>
                      <span className="text-cyan-600 font-black">{Math.floor(initialTime / 60)} mins</span>
                      <span>60 mins</span>
                    </div>
                    <input 
                      type="range" 
                      min="60" 
                      max="3600" 
                      step="60"
                      value={initialTime}
                      onChange={(e) => setInitialTime(Number(e.target.value))}
                      className="w-full accent-cyan-500 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer" 
                    />
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPhase('preSuds')} 
                  className="w-full mt-8 py-5 bg-gradient-to-r from-cyan-500 to-sky-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-cyan-200/50 flex items-center justify-center gap-2 group"
                >
                  Let's do this <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            </motion.div>
          )}

          {phase === 'preSuds' && (
            <motion.div 
              key="preSuds" 
              initial={{ opacity: 0, x: 20 }} 
              animate={{ opacity: 1, x: 0 }} 
              exit={{ opacity: 0, x: -20 }} 
              className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl shadow-sky-100/50 border border-white text-center"
            >
              <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Activity className="w-8 h-8 text-sky-500" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2">Before you start...</h2>
              <p className="text-slate-500 font-medium mb-8 text-lg">How strong is the urge right now?</p>
              
              <VisualSudsSelector 
                value={preSuds} 
                onChange={(val) => {
                  setPreSuds(val);
                  setCurrentSuds(val);
                }} 
              />
              
              <div className="bg-sky-50 rounded-2xl p-4 my-8 border border-sky-100">
                <p className="text-sky-800 font-medium text-sm">
                  "I am capable of experiencing this discomfort without acting on it."
                </p>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartTimer} 
                className="w-full py-5 bg-slate-800 text-white font-black text-lg rounded-2xl shadow-xl shadow-slate-300"
              >
                I'm Ready
              </motion.button>
            </motion.div>
          )}

          {phase === 'running' && (
            <motion.div 
              key="running" 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, y: 20 }} 
              className="flex flex-col items-center"
            >
              <div className="text-center mb-4">
                <motion.p 
                  key={getContextualMessage()}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg font-bold text-slate-600"
                >
                  {getContextualMessage()}
                </motion.p>
              </div>

              <CircularTimer timeLeft={timeLeft} initialTime={initialTime} />

              <div className="w-full bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-2xl shadow-sky-100/50 border border-white mb-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-800">Current Focus</h3>
                  <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-xs font-bold uppercase tracking-wider">
                    {interventionCategory}
                  </span>
                </div>
                
                <p className="text-slate-700 text-lg font-medium leading-relaxed min-h-[80px] flex items-center">
                  {currentIntervention}
                </p>
                
                <div className="flex gap-4 mt-6">
                  <button 
                    onClick={rotateIntervention} 
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" /> Switch
                  </button>
                </div>
              </div>

              <div className="flex flex-col w-full gap-6">
                <div className="bg-white/60 p-5 rounded-2xl border border-white">
                  <div className="flex justify-between text-sm font-bold text-slate-500 mb-2">
                    <span>Live Anxiety (SUDS)</span>
                    <span className="text-cyan-600 text-xl">{currentSuds}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={currentSuds} 
                    onChange={e => setCurrentSuds(Number(e.target.value))} 
                    className="w-full accent-cyan-500 h-2 bg-slate-200 rounded-full appearance-none cursor-pointer" 
                  />
                </div>

                <div className="flex justify-center gap-6">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsPaused(!isPaused)} 
                    className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${
                      isPaused ? 'bg-cyan-500 text-white shadow-cyan-200' : 'bg-white text-slate-800 shadow-slate-200'
                    }`}
                  >
                    {isPaused ? <Play className="w-8 h-8 ml-1" /> : <Pause className="w-8 h-8" />}
                  </motion.button>
                </div>
                
                <button 
                  onClick={() => setPhase('postSuds')} 
                  className="mt-4 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                >
                  End Session Early
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'postSuds' && (
            <motion.div 
              key="postSuds" 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0 }} 
              className="bg-white/90 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl shadow-sky-100/50 border border-white text-center"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Activity className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2">Check-in</h2>
              <p className="text-slate-500 font-medium mb-8">How is your anxiety level now?</p>
              
              <div className="flex items-center justify-center gap-6 mb-8 bg-slate-50 py-4 rounded-2xl">
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase">Before</p>
                  <p className="text-3xl font-black text-slate-800">{preSuds}</p>
                </div>
                <ArrowRight className="text-slate-300" />
                <div className="text-center">
                  <p className="text-xs font-bold text-cyan-600 uppercase">Now</p>
                  <p className="text-3xl font-black text-cyan-600">{postSuds}</p>
                </div>
              </div>

              <VisualSudsSelector value={postSuds} onChange={setPostSuds} label="Final Distress Level" />
              
              <div className="my-10 border-t border-slate-100 pt-8">
                <h3 className="text-lg font-black text-slate-800 mb-6">Did you resist the urge?</h3>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setResisted(true)} 
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${
                      resisted === true ? 'border-emerald-400 bg-emerald-50 text-emerald-900 scale-105' : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-3xl">✅</span>
                    <span className="font-bold">Yes</span>
                  </button>
                  <button 
                    onClick={() => setResisted(false)} 
                    className={`flex-1 p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${
                      resisted === false ? 'border-amber-400 bg-amber-50 text-amber-900 scale-105' : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-3xl">😐</span>
                    <span className="font-bold text-sm">Needed to act</span>
                  </button>
                </div>
              </div>

              <motion.button 
                whileHover={resisted !== null ? { scale: 1.02 } : {}}
                whileTap={resisted !== null ? { scale: 0.98 } : {}}
                onClick={handleSave}
                disabled={resisted === null}
                className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all ${
                  resisted !== null 
                    ? 'bg-slate-800 text-white shadow-slate-300 cursor-pointer' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                Save Session
              </motion.button>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div 
              key="done" 
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-10 text-center shadow-2xl shadow-sky-100/50 border border-white"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  resisted ? 'bg-emerald-100 text-emerald-500' : 'bg-amber-100 text-amber-500'
                }`}
              >
                {resisted ? <CheckCircle2 className="w-12 h-12" /> : <Activity className="w-12 h-12" />}
              </motion.div>
              
              <h2 className="text-3xl font-black text-slate-800 mb-4">
                {resisted ? 'Incredible Work!' : 'Progress Takes Time'}
              </h2>
              <p className="text-slate-600 font-medium mb-8 text-lg">
                {resisted 
                  ? "Every time you delay, you weaken the OCD cycle. You proved you can handle the discomfort."
                  : "It's okay. You faced the urge and that's a step forward. Be kind to yourself."
                }
              </p>

              <div className="grid grid-cols-2 gap-4 mb-10 text-left">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Time Logged</p>
                  <p className="text-2xl font-black text-slate-700">{Math.floor((initialTime - timeLeft) / 60)}m {(initialTime - timeLeft) % 60}s</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">SUDS Change</p>
                  <p className="text-2xl font-black text-slate-700 flex items-center gap-2">
                    {preSuds} <ArrowRight className="w-4 h-4 text-slate-400" /> {postSuds}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setPhase('pick');
                    setCompulsionType('');
                    setResisted(null);
                    setPreSuds(50);
                    setPostSuds(50);
                  }}
                  className="w-full py-4 bg-cyan-500 text-white font-black rounded-xl shadow-lg shadow-cyan-200 hover:bg-cyan-600 transition-colors"
                >
                  Try Again
                </button>
                <button 
                  onClick={() => navigate('/ocd')}
                  className="w-full py-4 bg-slate-100 text-slate-700 font-black rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Go Home
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
