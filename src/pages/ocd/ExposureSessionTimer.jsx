import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Clock, Timer, Hourglass, Play, Pause, XCircle, CheckCircle2, ArrowRightCircle, Activity, Info, RefreshCw } from 'lucide-react';
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

export default function ExposureSessionTimer() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState('pick'); // 'pick', 'preSuds', 'running', 'postSuds', 'done'
  const [compulsionType, setCompulsionType] = useState('');
  const [initialTime, setInitialTime] = useState(0);
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
        if (timeLeft % 30 === 0) addSessionSudsLog(currentSuds); // Log every 30s
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
    setIsPaused(false);
  };

  const handleFinish = (outcomeType) => {
    const isResisted = outcomeType === 'RESISTED';
    setResisted(isResisted);
    
    sessionMutation.mutate({
      title: compulsionType,
      pre_suds: preSuds,
      post_suds: postSuds,
      duration_seconds: initialTime - timeLeft,
      resisted_compulsion: isResisted,
      notes: "Guided ERP Session"
    });
    
    setPhase('done');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = initialTime > 0 ? ((initialTime - timeLeft) / initialTime) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/20 text-slate-800 pb-16">
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/ocd" className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg text-slate-800">Guided ERP Session</h1>
            <p className="text-xs text-slate-500">Ride the urge wave without acting on it</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <AnimatePresence mode="wait">
          {phase === 'pick' && (
            <motion.div key="pick" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div className="neuro-card p-5 bg-white rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-sm font-bold uppercase tracking-wider text-teal-700 mb-3">1. Select Target Urge</h2>
                <div className="flex flex-wrap gap-2">
                  {COMPULSION_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setCompulsionType(type)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${compulsionType === type ? 'bg-teal-600 text-white border-teal-600 shadow-md' : 'bg-white text-slate-600 border-gray-300 hover:bg-teal-50'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`transition-opacity duration-300 ${!compulsionType ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-teal-700 mb-3">2. Choose Duration</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[2, 5, 10].map(mins => (
                    <button key={mins} onClick={() => { setInitialTime(mins * 60); setPhase('preSuds'); }} className="neuro-card p-4 text-left rounded-xl border border-gray-200 hover:border-teal-400 hover:shadow-md transition-all bg-white group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="bg-teal-50 text-teal-600 p-2 rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                          <Timer className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-400">{mins} MIN</span>
                      </div>
                      <h3 className="font-bold text-slate-800 mb-1">{mins === 2 ? 'Quick Delay' : mins === 5 ? 'Standard Delay' : 'Extended'}</h3>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {phase === 'preSuds' && (
            <motion.div key="preSuds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <h2 className="text-xl font-bold mb-4">Pre-Session Check-in</h2>
              <p className="mb-6 text-slate-600">Rate your current anxiety level (SUDS) before starting.</p>
              <div className="text-4xl font-bold text-teal-600 mb-4">{preSuds}</div>
              <input type="range" min="0" max="100" value={preSuds} onChange={e => { setPreSuds(Number(e.target.value)); setCurrentSuds(Number(e.target.value)); }} className="w-full mb-6 accent-teal-600" />
              <button onClick={handleStartTimer} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700">Start Timer</button>
            </motion.div>
          )}

          {phase === 'running' && (
            <motion.div key="running" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-6">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 w-full max-w-sm flex flex-col items-center text-center relative overflow-hidden">
                <div className="relative w-48 h-48 my-6 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="96" cy="96" r="88" className="text-gray-100" strokeWidth="12" stroke="currentColor" fill="none" />
                    <circle cx="96" cy="96" r="88" className="text-teal-500 transition-all duration-1000 ease-linear" strokeWidth="12" stroke="currentColor" fill="none" strokeDasharray="552.92" strokeDashoffset={552.92 - (552.92 * progressPercent) / 100} strokeLinecap="round" />
                  </svg>
                  <div className="text-5xl font-mono font-bold text-slate-800 tabular-nums relative z-10">{formatTime(timeLeft)}</div>
                </div>

                <div className="w-full mb-6">
                  <p className="text-sm font-bold text-slate-600 mb-2">Live Anxiety (SUDS): {currentSuds}</p>
                  <input type="range" min="0" max="100" value={currentSuds} onChange={e => setCurrentSuds(Number(e.target.value))} className="w-full accent-teal-600" />
                </div>

                <div className="w-full bg-teal-50/50 rounded-xl p-4 min-h-[100px] flex flex-col justify-center border border-teal-100 mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 mb-1">{interventionCategory} focus</span>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">{currentIntervention}</p>
                </div>

                <div className="flex flex-wrap justify-center gap-3 w-full">
                  <button onClick={rotateIntervention} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium">
                    <RefreshCw className="w-4 h-4" /> New Idea
                  </button>
                  <button onClick={() => setIsPaused(!isPaused)} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium">
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />} {isPaused ? 'Resume' : 'Pause'}
                  </button>
                </div>
                
                <button onClick={() => setPhase('postSuds')} className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline">End Session Early</button>
              </div>
            </motion.div>
          )}

          {phase === 'postSuds' && (
            <motion.div key="postSuds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <h2 className="text-xl font-bold mb-4">Post-Session Check-in</h2>
              <p className="mb-6 text-slate-600">Rate your anxiety level (SUDS) now.</p>
              <div className="text-4xl font-bold text-teal-600 mb-4">{postSuds}</div>
              <input type="range" min="0" max="100" value={postSuds} onChange={e => setPostSuds(Number(e.target.value))} className="w-full mb-6 accent-teal-600" />
              
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Outcome</h3>
              <div className="space-y-3">
                <button onClick={() => handleFinish('RESISTED')} className="w-full flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left hover:bg-emerald-100">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  <div><div className="font-bold text-emerald-800">Resisted completely</div></div>
                </button>
                <button onClick={() => handleFinish('GAVE_IN')} className="w-full flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-left hover:bg-gray-100">
                  <XCircle className="w-6 h-6 text-gray-500" />
                  <div><div className="font-bold text-gray-700">Compulsion performed</div></div>
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-200">
              <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Session Complete</h2>
              <p className="text-slate-600 font-medium mb-6">
                Your session has been logged and the AI summary is being generated on your dashboard.
              </p>
              <Link to="/ocd/progress" className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 inline-block">View Progress</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
