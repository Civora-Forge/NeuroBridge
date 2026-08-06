import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Clock, Timer, Hourglass, 
  Play, Pause, XCircle, CheckCircle2, 
  ArrowRightCircle, Activity, Info, RefreshCw
} from 'lucide-react';

import { 
  DELAY_OUTCOMES, 
  getCompulsionOutcomes, 
  addCompulsionOutcome, 
  getResistanceStats, 
  checkAndEarnMilestones, 
  getGoals 
} from '@/support/specialized/ocdStore';

const INTERVENTIONS = {
  body: [
    'Press your feet firmly into the floor for 10 seconds, then release.',
    'Unclench your jaw and let your tongue rest on the bottom of your mouth.',
    'Place both hands flat on your thighs and feel the pressure. Stay there.',
    'Squeeze your hands into fists for 5 seconds, then release slowly.',
    'Notice 3 things you can physically feel right now.',
  ],
  breath: [
    'Breathe out fully — longer than your inhale. Do this 4 times.',
    'Inhale for 4, hold for 4, exhale for 6. Repeat twice.',
    'Take one very slow breath. Focus only on the air moving.',
    'Breathe in through your nose, out through your mouth. Three cycles.',
  ],
  cognitive: [
    'Say to yourself: I notice I am having the urge to...',
    'This thought is visiting. You do not have to entertain it.',
    'The urge is a feeling in your body. It will peak and subside.',
    'What would you be doing right now if this urge was not here?',
    'Thank your mind for this thought, then return to the present.',
  ]
};

const COMPULSION_TYPES = [
  'Checking', 'Washing', 'Ordering', 'Mental ritual', 'Reassurance seeking', 'Avoidance'
];

export default function ExposureSessionTimer() {
  const navigate = useNavigate();

  // State
  const [phase, setPhase] = useState('pick'); // 'pick', 'running', 'done'
  const [selectedDuration, setSelectedDuration] = useState(null); // in seconds
  const [customDurationStr, setCustomDurationStr] = useState('');
  const [compulsionType, setCompulsionType] = useState('');
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [initialTime, setInitialTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const [currentIntervention, setCurrentIntervention] = useState('');
  const [interventionCategory, setInterventionCategory] = useState('body');

  const [outcomesList, setOutcomesList] = useState([]);
  const [resistanceStats, setResistanceStats] = useState({ total: 0 });

  // Load stats
  const loadStats = useCallback(() => {
    setOutcomesList(getCompulsionOutcomes().slice(0, 8));
    setResistanceStats(getResistanceStats(30));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Timer logic
  useEffect(() => {
    let interval = null;
    if (phase === 'running' && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (phase === 'running' && timeLeft === 0) {
      setPhase('done');
    }
    return () => clearInterval(interval);
  }, [phase, isPaused, timeLeft]);

  // Intervention Rotation
  const rotateIntervention = useCallback(() => {
    const categories = ['body', 'breath', 'cognitive'];
    const nextCat = categories[(categories.indexOf(interventionCategory) + 1) % categories.length];
    setInterventionCategory(nextCat);
    
    const items = INTERVENTIONS[nextCat];
    const randomItem = items[Math.floor(Math.random() * items.length)];
    setCurrentIntervention(randomItem);
  }, [interventionCategory]);

  useEffect(() => {
    if (phase === 'running') {
      rotateIntervention(); // Initial
      const intInterval = setInterval(rotateIntervention, 45000); // Every 45s
      return () => clearInterval(intInterval);
    }
  }, [phase, rotateIntervention]);

  const handleStart = (durationSeconds) => {
    if (!compulsionType) return;
    setInitialTime(durationSeconds);
    setTimeLeft(durationSeconds);
    setPhase('running');
    setIsPaused(false);
  };

  const handleStartCustom = () => {
    const mins = parseInt(customDurationStr, 10);
    if (!isNaN(mins) && mins > 0 && mins <= 60 && compulsionType) {
      handleStart(mins * 60);
    }
  };

  const handleOutcome = (outcomeType) => {
    addCompulsionOutcome({
      type: compulsionType,
      outcome: outcomeType,
      durationDelayed: initialTime - timeLeft // approximate
    });
    checkAndEarnMilestones();
    loadStats();
    
    // Reset state
    setPhase('pick');
    setCompulsionType('');
    setCustomDurationStr('');
    setSelectedDuration(null);
  };

  // Helper formatting
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = initialTime > 0 ? ((initialTime - timeLeft) / initialTime) * 100 : 0;
  
  const getPhaseLabel = () => {
    if (progressPercent < 33) return 'Holding...';
    if (progressPercent < 66) return 'Strong phase — keep going';
    return 'Almost there';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/20 text-slate-800 pb-16">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/ocd" className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-slate-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-bold text-lg text-slate-800">Intelligent Delay Coach</h1>
            <p className="text-xs text-slate-500">Ride the urge wave without acting on it</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        
        <AnimatePresence mode="wait">
          {phase === 'pick' && (
            <motion.div 
              key="pick"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Type Selection */}
              <div className="neuro-card p-5 bg-white rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-sm font-bold uppercase tracking-wider text-teal-700 mb-3">1. What's the urge?</h2>
                <div className="flex flex-wrap gap-2">
                  {COMPULSION_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setCompulsionType(type)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                        compulsionType === type 
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md' 
                          : 'bg-white text-slate-600 border-gray-300 hover:bg-teal-50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {!compulsionType && (
                  <p className="text-xs text-rose-500 mt-2">Please select an urge type to continue.</p>
                )}
              </div>

              {/* Mode Selection */}
              <div className={`transition-opacity duration-300 ${!compulsionType ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-teal-700 mb-3">2. Choose your delay</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button 
                    onClick={() => handleStart(2 * 60)}
                    className="neuro-card p-4 text-left rounded-xl border border-gray-200 hover:border-teal-400 hover:shadow-md transition-all bg-white group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-teal-50 text-teal-600 p-2 rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <Clock className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-400">2 MIN</span>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1">Quick Delay</h3>
                    <p className="text-xs text-slate-500">For mild urges. A short pause can break the loop.</p>
                  </button>

                  <button 
                    onClick={() => handleStart(5 * 60)}
                    className="neuro-card p-4 text-left rounded-xl border-2 border-teal-500 shadow-sm hover:shadow-md transition-all bg-white relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 bg-teal-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">RECOMMENDED</div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-teal-50 text-teal-600 p-2 rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        <Timer className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-400">5 MIN</span>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1">Standard Delay</h3>
                    <p className="text-xs text-slate-500">The ERP gold standard delay. Ride the wave.</p>
                  </button>

                  <button 
                    onClick={() => handleStart(10 * 60)}
                    className="neuro-card p-4 text-left rounded-xl border border-gray-200 hover:border-emerald-400 hover:shadow-md transition-all bg-white group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Hourglass className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-400">10 MIN</span>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1">Extended Challenge</h3>
                    <p className="text-xs text-slate-500">For strong urges. This builds real resilience.</p>
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600">Or custom:</span>
                  <input 
                    type="number" 
                    min="1" max="60"
                    placeholder="Min"
                    value={customDurationStr}
                    onChange={e => setCustomDurationStr(e.target.value)}
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                  <button 
                    onClick={handleStartCustom}
                    disabled={!customDurationStr || !compulsionType}
                    className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                  >
                    Start
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {phase === 'running' && (
            <motion.div 
              key="running"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-6"
            >
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 w-full max-w-sm flex flex-col items-center text-center relative overflow-hidden">
                {/* Background Wave Animation */}
                <div className="absolute bottom-0 left-0 right-0 opacity-10 pointer-events-none">
                  <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-24 animate-pulse">
                    <path d="M0 30 Q 25 0 50 30 T 100 30 L 100 30 L 0 30 Z" fill="#0d9488" />
                  </svg>
                </div>

                <div className="mb-2 text-teal-600 font-medium text-sm">
                  {getPhaseLabel()}
                </div>
                
                {/* Circular Timer */}
                <div className="relative w-48 h-48 my-6 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="96" cy="96" r="88" className="text-gray-100" strokeWidth="12" stroke="currentColor" fill="none" />
                    <circle 
                      cx="96" cy="96" r="88" 
                      className="text-teal-500 transition-all duration-1000 ease-linear" 
                      strokeWidth="12" stroke="currentColor" fill="none" 
                      strokeDasharray="552.92" 
                      strokeDashoffset={552.92 - (552.92 * progressPercent) / 100} 
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-5xl font-mono font-bold text-slate-800 tabular-nums relative z-10">
                    {formatTime(timeLeft)}
                  </div>
                </div>

                {/* Intervention */}
                <div className="w-full bg-teal-50/50 rounded-xl p-4 min-h-[100px] flex flex-col justify-center border border-teal-100 mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-600 mb-1">
                    {interventionCategory} focus
                  </span>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">
                    {currentIntervention}
                  </p>
                </div>

                <div className="flex flex-wrap justify-center gap-3 w-full">
                  <button 
                    onClick={rotateIntervention}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    New Idea
                  </button>
                  <button 
                    onClick={() => setIsPaused(!isPaused)}
                    className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                </div>
                
                <button 
                  onClick={() => setPhase('done')}
                  className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2"
                >
                  End Session Now
                </button>
              </div>
            </motion.div>
          )}

          {phase === 'done' && (
            <motion.div 
              key="done"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-200">
                <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Time's Up</h2>
                <p className="text-slate-600 font-medium mb-6">That was hard. You stayed. That matters.</p>
                
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-4">Log the Outcome</h3>
                
                <div className="space-y-3 flex flex-col">
                  <button 
                    onClick={() => handleOutcome(DELAY_OUTCOMES.RESISTED)}
                    className="w-full flex items-center gap-3 p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors text-left"
                  >
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-emerald-800">Resisted completely</div>
                      <div className="text-xs text-emerald-600/80">I did not perform the compulsion.</div>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => handleOutcome(DELAY_OUTCOMES.DELAYED)}
                    className="w-full flex items-center gap-3 p-4 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors text-left"
                  >
                    <ArrowRightCircle className="w-6 h-6 text-teal-600 shrink-0" />
                    <div>
                      <div className="font-bold text-teal-800">Delayed then did it</div>
                      <div className="text-xs text-teal-600/80">I delayed, but eventually performed it.</div>
                    </div>
                  </button>
                  
                  <button 
                    onClick={() => handleOutcome(DELAY_OUTCOMES.GAVE_IN)}
                    className="w-full flex items-center gap-3 p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors text-left"
                  >
                    <XCircle className="w-6 h-6 text-gray-500 shrink-0" />
                    <div>
                      <div className="font-bold text-gray-700">Compulsion performed</div>
                      <div className="text-xs text-gray-500">This is data, not failure. We try again next time.</div>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats & History (Always visible except when running) */}
        {phase !== 'running' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-4">
            
            {/* Stats Panel */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-teal-600" />
                30-Day Resistance Stats
              </h3>
              
              {resistanceStats.total > 0 ? (
                <>
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1 bg-emerald-50 text-emerald-700 rounded-lg p-3 text-center border border-emerald-100">
                      <div className="text-2xl font-bold">{resistanceStats.rates.resisted}%</div>
                      <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Resisted</div>
                    </div>
                    <div className="flex-1 bg-teal-50 text-teal-700 rounded-lg p-3 text-center border border-teal-100">
                      <div className="text-2xl font-bold">{resistanceStats.rates.delayed}%</div>
                      <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Delayed</div>
                    </div>
                    <div className="flex-1 bg-gray-50 text-gray-600 rounded-lg p-3 text-center border border-gray-200">
                      <div className="text-2xl font-bold">{resistanceStats.rates.gaveIn}%</div>
                      <div className="text-[10px] uppercase font-bold tracking-wider opacity-70">Gave In</div>
                    </div>
                  </div>
                  
                  {/* Stacked Bar */}
                  <div className="h-3 w-full bg-gray-100 rounded-full flex overflow-hidden">
                    <div style={{ width: `${resistanceStats.rates.resisted}%` }} className="bg-emerald-500 h-full"></div>
                    <div style={{ width: `${resistanceStats.rates.delayed}%` }} className="bg-teal-400 h-full"></div>
                    <div style={{ width: `${resistanceStats.rates.gaveIn}%` }} className="bg-gray-300 h-full"></div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-sm text-slate-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                  Your resistance data will appear here after your first session.
                </div>
              )}
            </div>

            {/* Recent Outcomes */}
            <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Recent Sessions</h3>
              {outcomesList.length > 0 ? (
                <div className="space-y-3">
                  {outcomesList.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <div className="font-medium text-sm text-slate-800">{item.type}</div>
                        <div className="text-xs text-slate-500">{new Date(item.timestamp).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {item.durationDelayed && (
                          <div className="text-xs font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.round(item.durationDelayed / 60)}m
                          </div>
                        )}
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full ${
                          item.outcome === DELAY_OUTCOMES.RESISTED ? 'bg-emerald-100 text-emerald-700' :
                          item.outcome === DELAY_OUTCOMES.DELAYED ? 'bg-teal-100 text-teal-700' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {item.outcome === DELAY_OUTCOMES.RESISTED ? 'Resisted' : 
                           item.outcome === DELAY_OUTCOMES.DELAYED ? 'Delayed' : 'Performed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No recent sessions found.</p>
              )}
            </div>

            <div className="flex items-start gap-2 p-4 bg-teal-50/50 rounded-lg border border-teal-100 text-sm text-teal-800">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-teal-600" />
              <p>This tool supports ERP between therapy sessions — it does not replace clinical care. The urge is not a command. Uncertainty is tolerable.</p>
            </div>
            
          </motion.div>
        )}
      </main>
    </div>
  );
}
