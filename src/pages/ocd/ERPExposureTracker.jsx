import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Plus, Check, Play, Square, Pause, RotateCcw, 
  AlertTriangle, TrendingDown, Clock, Activity, Target, ChevronDown, ChevronRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  getHierarchy,
  saveHierarchy,
  getSessions,
  addSession,
  checkAndMarkMastery,
  buildErpCoachingMessage,
  checkAndEarnMilestones,
  OCD_SUBTYPES
} from '@/support/specialized/ocdStore';

const GROUNDING_PROMPTS = [
  "Notice 5 things you can see right now.",
  "Notice 4 things you can physically feel.",
  "Notice 3 things you can hear.",
  "Notice 2 things you can smell.",
  "Notice 1 good thing you can taste.",
  "Feel your feet pressing against the floor.",
  "The discomfort will pass.",
  "The urge is not a command.",
  "Uncertainty is tolerable.",
  "You are building tolerance to distress."
];

const WAIT_SUPPORT_ACTIONS = [
  "Take a slow, deep breath in... and out.",
  "Gently stretch your neck side to side.",
  "Let your shoulders drop away from your ears.",
  "Unclench your jaw.",
  "Focus on the physical sensation of sitting.",
  "Observe the thought without engaging with it.",
  "Allow the anxiety to be there without fighting it.",
  "Notice the rising and falling of your chest."
];

// Reusable animated wave SVG component
const UrgeWaveProgress = ({ progress }) => {
  // progress is 0.0 to 1.0
  // bell curve peak at 0.4 (40%)
  
  const getLabel = (p) => {
    if (p < 0.2) return "Rising...";
    if (p < 0.45) return "Near peak — stay with it";
    if (p < 0.8) return "Falling";
    return "Almost there";
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full max-w-sm h-32">
        <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
          {/* Background curve */}
          <path 
            d="M 0 40 Q 20 40 30 20 T 40 5 T 60 25 T 100 40" 
            fill="none" 
            stroke="#e2e8f0" 
            strokeWidth="2" 
            strokeLinecap="round"
          />
          {/* Active curve mask (simplified for visual effect) */}
          <path 
            d="M 0 40 Q 20 40 30 20 T 40 5 T 60 25 T 100 40" 
            fill="none" 
            stroke="#0d9488" 
            strokeWidth="3" 
            strokeLinecap="round"
            style={{ 
              strokeDasharray: "150", 
              strokeDashoffset: `${150 - (progress * 150)}`,
              transition: 'stroke-dashoffset 1s linear'
            }}
          />
          {/* Marker dot */}
          <motion.circle 
            r="3" 
            fill="#0f766e"
            style={{
              offsetPath: "path('M 0 40 Q 20 40 30 20 T 40 5 T 60 25 T 100 40')",
              offsetDistance: `${progress * 100}%`
            }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-teal-700 mt-2">{getLabel(progress)}</p>
    </div>
  );
};

export default function ERPExposureTracker() {
  const navigate = useNavigate();
  const [hierarchies, setHierarchies] = useState([]);
  const [sessions, setSessions] = useState([]);
  
  // UI State
  const [expandedGroups, setExpandedGroups] = useState({});
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [addingItemToGroup, setAddingItemToGroup] = useState(null);
  const [newItem, setNewItem] = useState({ title: '', targetSuds: 50, durationMin: 10 });
  
  // Session State: null | 'pre' | 'running' | 'post' | 'done' | 'cancel'
  const [sessionPhase, setSessionPhase] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [preSuds, setPreSuds] = useState(50);
  const [postSuds, setPostSuds] = useState(50);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [durationElapsed, setDurationElapsed] = useState(0);
  const timerRef = useRef(null);

  // Coaching & Prompts
  const [groundingIndex, setGroundingIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [coachingMessage, setCoachingMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const hData = getHierarchy();
    setHierarchies(hData);
    // Expand first group by default if available
    if (hData.length > 0 && Object.keys(expandedGroups).length === 0) {
      setExpandedGroups({ [hData[0].id]: true });
    }
    setSessions(getSessions());
  };

  const toggleGroup = (id) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddGroup = () => {
    if (!newGroupTitle.trim()) return;
    const newHierarchy = {
      id: Date.now().toString(),
      title: newGroupTitle,
      items: []
    };
    const updated = [...hierarchies, newHierarchy];
    saveHierarchy(updated);
    setHierarchies(updated);
    setNewGroupTitle("");
    setIsAddingGroup(false);
    setExpandedGroups(prev => ({ ...prev, [newHierarchy.id]: true }));
  };

  const handleAddItem = (groupId) => {
    if (!newItem.title.trim()) return;
    const updated = hierarchies.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          items: [...g.items, {
            id: Date.now().toString(),
            title: newItem.title,
            targetSuds: parseInt(newItem.targetSuds),
            durationMin: parseInt(newItem.durationMin),
            mastered: false,
            createdAt: new Date().toISOString()
          }].sort((a, b) => a.targetSuds - b.targetSuds)
        };
      }
      return g;
    });
    saveHierarchy(updated);
    setHierarchies(updated);
    setAddingItemToGroup(null);
    setNewItem({ title: '', targetSuds: 50, durationMin: 10 });
  };

  const startSession = (group, item) => {
    setActiveGroupId(group.id);
    setActiveItem(item);
    setPreSuds(item.targetSuds || 50);
    setPostSuds(50);
    setSessionPhase('pre');
    setCoachingMessage(buildErpCoachingMessage());
  };

  const beginTimer = () => {
    setSessionPhase('running');
    setTimeLeft(activeItem.durationMin * 60);
    setDurationElapsed(0);
    setIsPaused(false);
  };

  // Timer logic
  useEffect(() => {
    if (sessionPhase === 'running' && !isPaused && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
        setDurationElapsed(prev => prev + 1);
      }, 1000);
    } else if (timeLeft === 0 && sessionPhase === 'running') {
      clearInterval(timerRef.current);
      setSessionPhase('post');
    }

    return () => clearInterval(timerRef.current);
  }, [sessionPhase, isPaused, timeLeft]);

  // Rotators
  useEffect(() => {
    if (sessionPhase === 'running') {
      const gInterval = setInterval(() => {
        setGroundingIndex(prev => (prev + 1) % GROUNDING_PROMPTS.length);
      }, 35000);
      const aInterval = setInterval(() => {
        setActionIndex(prev => (prev + 1) % WAIT_SUPPORT_ACTIONS.length);
      }, 45000);
      const cInterval = setInterval(() => {
        setCoachingMessage(buildErpCoachingMessage());
      }, 30000);

      return () => {
        clearInterval(gInterval);
        clearInterval(aInterval);
        clearInterval(cInterval);
      };
    }
  }, [sessionPhase]);

  const endSessionEarly = () => {
    setSessionPhase('cancel');
  };

  const confirmEndEarly = () => {
    clearInterval(timerRef.current);
    setSessionPhase('post');
  };

  const resumeTimer = () => {
    setSessionPhase('running');
  };

  const logSession = () => {
    const totalDurationSec = (activeItem.durationMin * 60) - timeLeft;
    const sessionObj = {
      hierarchyId: activeGroupId,
      itemId: activeItem.id,
      itemTitle: activeItem.title,
      preSuds,
      postSuds,
      durationSec: totalDurationSec,
      completed: timeLeft === 0
    };
    
    addSession(sessionObj);
    const { mastered, newlyMastered } = checkAndMarkMastery(activeGroupId, activeItem.id);
    checkAndEarnMilestones();
    
    loadData();
    setActiveItem({ ...activeItem, newlyMastered });
    setSessionPhase('done');
  };

  const resetStudio = () => {
    setSessionPhase(null);
    setActiveItem(null);
    setActiveGroupId(null);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Chart Data
  const chartData = useMemo(() => {
    if (sessions.length < 2) return [];
    return sessions.slice(-20).map((s, i) => ({
      name: `S${i+1}`,
      pre: s.preSuds,
      post: s.postSuds,
      date: new Date(s.timestamp).toLocaleDateString()
    }));
  }, [sessions]);

  // Render main layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/20 py-8 px-4 font-sans text-gray-800">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/ocd" className="p-2 hover:bg-teal-100 rounded-full transition-colors text-teal-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ERP Session Studio</h1>
            <p className="text-sm text-gray-500">Structured exposure with compassionate coaching.</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 italic text-center">
          This tool supports ERP between therapy sessions — it does not replace clinical care.
        </p>

        <AnimatePresence mode="wait">
          {!sessionPhase ? (
            <motion.div 
              key="browser"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Hierarchy Browser */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Target className="w-5 h-5 text-teal-600" />
                    Your Hierarchies
                  </h2>
                  <button 
                    onClick={() => setIsAddingGroup(!isAddingGroup)}
                    className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> New List
                  </button>
                </div>

                <AnimatePresence>
                  {isAddingGroup && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-4 border-b border-gray-100 bg-teal-50/50"
                    >
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="E.g., Contamination fears, Social anxiety..."
                          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 px-3 py-2 text-sm"
                          value={newGroupTitle}
                          onChange={(e) => setNewGroupTitle(e.target.value)}
                        />
                        <button onClick={handleAddGroup} className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-500">Save</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="divide-y divide-gray-100">
                  {hierarchies.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                      No hierarchies yet. Create one to start structuring your exposures.
                    </div>
                  ) : (
                    hierarchies.map(group => (
                      <div key={group.id} className="w-full">
                        <button 
                          onClick={() => toggleGroup(group.id)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className="font-medium text-gray-800">{group.title}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {group.items.filter(i => i.mastered).length}/{group.items.length} mastered
                            </span>
                            {expandedGroups[group.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          </div>
                        </button>
                        
                        <AnimatePresence>
                          {expandedGroups[group.id] && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-gray-50 border-t border-gray-100 overflow-hidden"
                            >
                              <div className="p-4 space-y-3">
                                {group.items.length === 0 ? (
                                  <p className="text-sm text-gray-500 italic">No exposure items yet.</p>
                                ) : (
                                  group.items.map(item => (
                                    <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${item.mastered ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white'}`}>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          {item.mastered && <Check className="w-4 h-4 text-emerald-600" />}
                                          <span className={`text-sm font-medium ${item.mastered ? 'text-emerald-800 line-through opacity-70' : 'text-gray-800'}`}>
                                            {item.title}
                                          </span>
                                        </div>
                                        <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                          <span className="flex items-center gap-1"><Activity className="w-3 h-3"/> SUDS {item.targetSuds}</span>
                                          <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {item.durationMin}m</span>
                                        </div>
                                      </div>
                                      {!item.mastered && (
                                        <button 
                                          onClick={() => startSession(group, item)}
                                          className="ml-4 px-3 py-1.5 bg-teal-100 text-teal-700 text-xs font-semibold rounded hover:bg-teal-200 transition-colors"
                                        >
                                          Begin
                                        </button>
                                      )}
                                    </div>
                                  ))
                                )}
                                
                                {addingItemToGroup === group.id ? (
                                  <div className="mt-3 p-3 bg-white border border-teal-200 rounded-lg shadow-sm space-y-3">
                                    <input 
                                      type="text"
                                      placeholder="Describe the exposure..."
                                      className="w-full text-sm border-gray-300 rounded focus:ring-teal-500 focus:border-teal-500 p-2"
                                      value={newItem.title}
                                      onChange={e => setNewItem({...newItem, title: e.target.value})}
                                    />
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-1">Target SUDS (0-100)</label>
                                        <input 
                                          type="number" min="0" max="100"
                                          className="w-full text-sm border-gray-300 rounded p-2"
                                          value={newItem.targetSuds}
                                          onChange={e => setNewItem({...newItem, targetSuds: e.target.value})}
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                                        <input 
                                          type="number" min="1" max="120"
                                          className="w-full text-sm border-gray-300 rounded p-2"
                                          value={newItem.durationMin}
                                          onChange={e => setNewItem({...newItem, durationMin: e.target.value})}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                      <button onClick={() => setAddingItemToGroup(null)} className="text-xs text-gray-500 px-3 py-1.5">Cancel</button>
                                      <button onClick={() => handleAddItem(group.id)} className="text-xs bg-teal-600 text-white px-3 py-1.5 rounded hover:bg-teal-700">Add Item</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setAddingItemToGroup(group.id)}
                                    className="text-xs font-medium text-teal-600 flex items-center gap-1 mt-2 p-1 hover:bg-teal-50 rounded"
                                  >
                                    <Plus className="w-3 h-3" /> Add Exposure Step
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Habituation Chart */}
              {chartData.length >= 2 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <TrendingDown className="w-5 h-5 text-emerald-600" />
                    Habituation Progress
                  </h3>
                  <p className="text-sm text-gray-500 mb-6">Narrowing gap = sustained habituation progress</p>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Line type="monotone" name="Pre-SUDS (Anxiety before)" dataKey="pre" stroke="#f97316" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
                        <Line type="monotone" name="Post-SUDS (Anxiety after)" dataKey="post" stroke="#0d9488" strokeWidth={2} dot={{r: 4}} activeDot={{r: 6}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Session History Cards */}
              {sessions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Recent Sessions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sessions.slice(-8).reverse().map(s => {
                      const drop = s.preSuds - s.postSuds;
                      const dropColor = drop >= 10 ? 'text-emerald-600' : 'text-orange-500';
                      return (
                        <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-sm text-gray-800 line-clamp-1">{s.itemTitle || "ERP Session"}</span>
                            <span className="text-xs text-gray-400">{new Date(s.timestamp).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <div className="text-sm">
                              <span className="text-gray-500">SUDS: </span>
                              <span className="font-semibold text-gray-700">{s.preSuds}</span>
                              <span className="text-gray-400 mx-1">→</span>
                              <span className="font-semibold text-gray-700">{s.postSuds}</span>
                            </div>
                            <span className={`text-xs font-bold ${dropColor}`}>
                              {drop > 0 ? `-${drop}` : (drop < 0 ? `+${Math.abs(drop)}` : '0')} pts
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {Math.floor(s.durationSec / 60)}m {s.durationSec % 60}s
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            /* Active Session Panel */
            <motion.div
              key="session"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-lg border border-teal-100 overflow-hidden"
            >
              {sessionPhase === 'pre' && (
                <div className="p-8 text-center space-y-8">
                  <h2 className="text-2xl font-bold text-gray-800">Ready to begin?</h2>
                  <div className="p-4 bg-teal-50 rounded-lg border border-teal-100">
                    <p className="text-teal-900 font-medium">{activeItem.title}</p>
                    <p className="text-teal-700 text-sm mt-1">Target duration: {activeItem.durationMin} minutes</p>
                  </div>
                  
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                      What is your SUDS right now? (0-100)
                    </label>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-teal-600">0</span>
                      <input 
                        type="range" min="0" max="100" 
                        className="flex-1 accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        value={preSuds}
                        onChange={(e) => setPreSuds(parseInt(e.target.value))}
                      />
                      <span className="text-sm font-semibold text-orange-500">100</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-800">{preSuds}</div>
                  </div>

                  <div className="flex justify-center gap-4 pt-4">
                    <button onClick={resetStudio} className="px-6 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors">
                      Cancel
                    </button>
                    <button onClick={beginTimer} className="px-8 py-2 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-500 shadow-md transition-all">
                      Begin Exposure
                    </button>
                  </div>
                </div>
              )}

              {sessionPhase === 'running' && (
                <div className="p-6 md:p-10 flex flex-col items-center justify-center min-h-[500px] space-y-8 relative">
                  {/* Background soft pulse if not paused */}
                  {!isPaused && (
                    <div className="absolute inset-0 bg-teal-50/30 animate-pulse-soft -z-10 rounded-xl" />
                  )}

                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Time Remaining</p>
                    <div className={`text-6xl md:text-7xl font-mono font-light tracking-tight ${isPaused ? 'text-gray-400' : 'text-teal-700'}`}>
                      {formatTime(timeLeft)}
                    </div>
                  </div>

                  <div className="w-full flex justify-center py-4">
                    <UrgeWaveProgress progress={durationElapsed / (activeItem.durationMin * 60)} />
                  </div>

                  <div className="h-24 flex items-center justify-center w-full px-4 text-center">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={groundingIndex + actionIndex}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-2"
                      >
                        <p className="text-lg text-gray-800 font-medium">{coachingMessage}</p>
                        <p className="text-sm text-teal-600">{GROUNDING_PROMPTS[groundingIndex]}</p>
                        <p className="text-sm text-gray-500 italic">{WAIT_SUPPORT_ACTIONS[actionIndex]}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button 
                      onClick={() => setIsPaused(!isPaused)}
                      className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      {isPaused ? <Play className="w-6 h-6 ml-1" /> : <Pause className="w-6 h-6" />}
                    </button>
                    <button 
                      onClick={endSessionEarly}
                      className="w-14 h-14 rounded-full flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      <Square className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              )}

              {sessionPhase === 'cancel' && (
                <div className="p-8 text-center space-y-6">
                  <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">End session early?</h3>
                    <p className="text-gray-600 mt-2">
                      Leaving early is fine — the data still helps. Return when you feel ready.
                    </p>
                  </div>
                  <div className="flex justify-center gap-4">
                    <button onClick={resumeTimer} className="px-6 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors">
                      Resume
                    </button>
                    <button onClick={confirmEndEarly} className="px-6 py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors">
                      End & Log Data
                    </button>
                  </div>
                </div>
              )}

              {sessionPhase === 'post' && (
                <div className="p-8 text-center space-y-8">
                  <h2 className="text-2xl font-bold text-gray-800">Session Complete</h2>
                  <p className="text-gray-600">Great job staying with the discomfort.</p>
                  
                  <div className="space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <label className="block text-sm font-medium text-gray-700">
                      What is your SUDS now? (0-100)
                    </label>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-teal-600">0</span>
                      <input 
                        type="range" min="0" max="100" 
                        className="flex-1 accent-teal-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        value={postSuds}
                        onChange={(e) => setPostSuds(parseInt(e.target.value))}
                      />
                      <span className="text-sm font-semibold text-orange-500">100</span>
                    </div>
                    <div className="flex justify-center items-end gap-4 mt-4">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Before</div>
                        <div className="text-xl font-semibold text-gray-400">{preSuds}</div>
                      </div>
                      <ArrowLeft className="w-5 h-5 text-gray-300 mb-1 rotate-180" />
                      <div className="text-center">
                        <div className="text-xs text-teal-600 font-medium">Now</div>
                        <div className="text-3xl font-bold text-teal-700">{postSuds}</div>
                      </div>
                    </div>
                  </div>

                  <button onClick={logSession} className="px-8 py-3 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-500 shadow-md transition-all w-full md:w-auto">
                    Save Session
                  </button>
                </div>
              )}

              {sessionPhase === 'done' && (
                <div className="p-10 text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">Data Saved!</h2>
                  
                  {activeItem?.newlyMastered && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg my-4 inline-block">
                      <p className="font-semibold flex items-center gap-2 justify-center">
                        <Target className="w-5 h-5" />
                        Item Mastered!
                      </p>
                      <p className="text-sm mt-1">Your SUDS dropped enough over multiple sessions to master this step.</p>
                    </div>
                  )}
                  
                  <p className="text-gray-600">Every session builds tolerance to uncertainty.</p>
                  
                  <div className="pt-6">
                    <button onClick={resetStudio} className="px-6 py-2 rounded-lg bg-teal-50 text-teal-700 font-medium hover:bg-teal-100 transition-colors">
                      Return to Studio
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
