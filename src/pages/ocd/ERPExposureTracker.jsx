import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Plus, Check, Play, Square, Pause, 
  AlertTriangle, TrendingDown, Clock, Activity, Target, ChevronDown, ChevronRight,
  ArrowRight, Star
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  getHierarchy, saveHierarchy, getSessions, addSession, 
  checkAndMarkMastery, buildErpCoachingMessage, checkAndEarnMilestones
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

function VisualSudsSelector({ value, onChange, label }) {
  const getColor = (v) => v < 30 ? '#10b981' : v < 60 ? '#f59e0b' : '#ef4444';
  const getEmoji = (v) => v < 20 ? '😌' : v < 40 ? '😊' : v < 60 ? '😐' : v < 80 ? '😟' : '😰';
  const getLabel = (v) => v < 30 ? 'Low' : v < 60 ? 'Moderate' : v < 80 ? 'High' : 'Intense';
  return (
    <div className="space-y-4">
      {label && <div className="text-center font-bold text-slate-700 text-sm tracking-wide">{label}</div>}
      <div className="flex items-end justify-center gap-3">
        <span className="text-5xl font-black transition-colors" style={{color: getColor(value)}}>{value}</span>
        <span className="text-3xl mb-1">{getEmoji(value)}</span>
      </div>
      <div className="text-center text-sm font-bold uppercase tracking-wider transition-colors" style={{color: getColor(value)}}>{getLabel(value)}</div>
      <div className="relative px-2 py-4">
        <div className="h-3 rounded-full shadow-inner" style={{background: 'linear-gradient(to right, #10b981, #f59e0b, #ef4444)'}} />
        <input type="range" min="0" max="100" value={value} onChange={e => onChange(parseInt(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" />
        <div className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md border-4 pointer-events-none transition-all duration-75"
          style={{left: `calc(${value}% - 16px)`, borderColor: getColor(value)}} />
      </div>
      <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
        <span>Calm</span><span>Moderate</span><span>Intense</span>
      </div>
    </div>
  );
}

function CircularTimer({ timeLeft, totalTime, isPaused }) {
  const progress = totalTime > 0 ? timeLeft / totalTime : 0;
  const r = 110;
  const size = 260;
  const center = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = progress * circ;
  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
  // Color shifts from violet when full to teal when done
  const color = progress > 0.5 ? '#6366f1' : '#0d9488'; 
  return (
    <div className="relative flex items-center justify-center" style={{width:size, height:size}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={center} cy={center} r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle cx={center} cy={center} r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circ} strokeDashoffset={circ - dash}
          strokeLinecap="round" style={{transition:'stroke-dashoffset 1s linear, stroke 0.5s ease'}} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-6xl font-black tracking-tighter ${isPaused ? 'text-slate-400' : 'text-slate-800'}`}>
          {formatTime(timeLeft)}
        </span>
        <span className="text-sm font-bold uppercase tracking-widest text-slate-400 mt-2">{isPaused ? 'paused' : 'remaining'}</span>
      </div>
    </div>
  );
}

const UrgeWaveProgress = ({ progress }) => {
  const getLabel = (p) => {
    if (p < 0.2) return "Rising...";
    if (p < 0.45) return "Near peak — stay with it";
    if (p < 0.8) return "Falling";
    return "Almost there";
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative h-20 w-full max-w-sm mx-auto md:h-24">
        <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
          <path 
            d="M 0 40 Q 20 40 30 20 T 40 5 T 60 25 T 100 40" 
            fill="none" 
            stroke="#cbd5e1" 
            strokeWidth="3" 
            strokeLinecap="round"
          />
          <path 
            d="M 0 40 Q 20 40 30 20 T 40 5 T 60 25 T 100 40" 
            fill="none" 
            stroke="#6366f1" 
            strokeWidth="4" 
            strokeLinecap="round"
            style={{ 
              strokeDasharray: "150", 
              strokeDashoffset: `${150 - (progress * 150)}`,
              transition: 'stroke-dashoffset 1s linear'
            }}
          />
          <motion.circle 
            r="4" 
            fill="#4338ca"
            style={{
              offsetPath: "path('M 0 40 Q 20 40 30 20 T 40 5 T 60 25 T 100 40')",
              offsetDistance: `${progress * 100}%`
            }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </svg>
      </div>
      <p className="text-sm font-bold uppercase tracking-widest text-indigo-700 mt-4">{getLabel(progress)}</p>
    </div>
  );
};

export default function ERPExposureTracker() {
  const [hierarchies, setHierarchies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [addingItemToGroup, setAddingItemToGroup] = useState(null);
  const [newItem, setNewItem] = useState({ title: '', targetSuds: 50, durationMin: 10 });
  
  const [sessionPhase, setSessionPhase] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [preSuds, setPreSuds] = useState(50);
  const [postSuds, setPostSuds] = useState(50);
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [durationElapsed, setDurationElapsed] = useState(0);
  const timerRef = useRef(null);

  const [groundingIndex, setGroundingIndex] = useState(0);
  const [actionIndex, setActionIndex] = useState(0);
  const [coachingMessage, setCoachingMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const hData = getHierarchy();
    setHierarchies(hData);
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

  const chartData = useMemo(() => {
    if (sessions.length < 2) return [];
    return sessions.slice(-20).map((s, i) => ({
      name: `S${i+1}`,
      pre: s.preSuds,
      post: s.postSuds,
      date: new Date(s.timestamp).toLocaleDateString()
    }));
  }, [sessions]);

  const getBgClass = () => {
    if (sessionPhase === 'running') return 'bg-gradient-to-br from-indigo-50 to-violet-50';
    if (sessionPhase === 'post' || sessionPhase === 'done') return 'bg-gradient-to-br from-emerald-50 to-teal-50';
    return 'bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20';
  };

  const getItemBorder = (suds) => {
    if (suds < 30) return 'border-emerald-200';
    if (suds < 60) return 'border-amber-200';
    return 'border-rose-200';
  };

  const getItemBadge = (suds) => {
    if (suds < 30) return 'bg-emerald-100 text-emerald-800';
    if (suds < 60) return 'bg-amber-100 text-amber-800';
    return 'bg-rose-100 text-rose-800';
  };

  return (
    <div className={`min-h-screen transition-colors duration-700 ${getBgClass()} py-8 px-4 font-sans text-slate-800 flex flex-col`}>
      <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col">
        
        <AnimatePresence mode="wait">
          {!sessionPhase ? (
            <motion.div 
              key="browser"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pb-10"
            >
              <div className="flex items-center gap-4 mb-2">
                <Link to="/ocd" className="p-3 bg-white/50 hover:bg-white rounded-full transition-colors text-indigo-700 shadow-sm border border-indigo-100 backdrop-blur-sm">
                  <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 to-violet-600">ERP Session Studio</h1>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-full border border-indigo-200">Exposure</span>
                  </div>
                  <p className="text-sm text-slate-500 font-medium mt-1">Structured exposure with compassionate coaching.</p>
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl border border-white overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Target className="w-6 h-6 text-indigo-600" />
                    Your Hierarchies
                  </h2>
                  <button 
                    onClick={() => setIsAddingGroup(!isAddingGroup)}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
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
                      className="p-5 border-b border-slate-100 bg-indigo-50/50"
                    >
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="text" 
                          placeholder="E.g., Contamination fears, Social anxiety..."
                          className="flex-1 rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-4 py-3 font-medium bg-white"
                          value={newGroupTitle}
                          onChange={(e) => setNewGroupTitle(e.target.value)}
                          autoFocus
                        />
                        <button onClick={handleAddGroup} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors">Create List</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="p-4 space-y-4">
                  {hierarchies.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 font-medium bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                      No hierarchies yet. Create one to start structuring your exposures.
                    </div>
                  ) : (
                    hierarchies.map(group => (
                      <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative transition-all hover:shadow-md">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-teal-400 to-emerald-500" />
                        <button 
                          onClick={() => toggleGroup(group.id)}
                          className="w-full p-5 pl-7 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                        >
                          <span className="text-lg font-bold text-slate-800">{group.title}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                              {group.items.filter(i => i.mastered).length}/{group.items.length} mastered
                            </span>
                            <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center">
                              {expandedGroups[group.id] ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                            </div>
                          </div>
                        </button>
                        
                        <AnimatePresence>
                          {expandedGroups[group.id] && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-slate-50 border-t border-slate-100 overflow-hidden"
                            >
                              <div className="p-5 pl-7">
                                {group.items.length === 0 ? (
                                  <p className="text-sm text-slate-500 font-medium mb-2">No exposure items yet.</p>
                                ) : (
                                  <div className="space-y-3">
                                    {group.items.map(item => (
                                      <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border-2 bg-white ${item.mastered ? 'border-emerald-300 opacity-70' : getItemBorder(item.targetSuds)}`}>
                                        <div className="flex-1 mb-3 sm:mb-0">
                                          <div className="flex items-center gap-3 mb-2">
                                            {item.mastered && <Check className="w-5 h-5 text-emerald-600" />}
                                            <span className={`text-base font-bold ${item.mastered ? 'text-emerald-800 line-through' : 'text-slate-800'}`}>
                                              {item.title}
                                            </span>
                                          </div>
                                          <div className="flex gap-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${item.mastered ? 'bg-emerald-100 text-emerald-700' : getItemBadge(item.targetSuds)}`}>
                                              <Activity className="w-3.5 h-3.5"/> SUDS {item.targetSuds}
                                            </span>
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md">
                                              <Clock className="w-3.5 h-3.5"/> {item.durationMin}m
                                            </span>
                                          </div>
                                        </div>
                                        {!item.mastered && (
                                          <button 
                                            onClick={() => startSession(group, item)}
                                            className="sm:ml-4 w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-bold rounded-xl hover:from-indigo-400 hover:to-violet-500 shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                                          >
                                            Begin
                                          </button>
                                        )}
                                        {item.mastered && (
                                          <div className="sm:ml-4 w-full sm:w-auto text-center px-4 py-2 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-xl border border-emerald-200">
                                            Mastered
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {addingItemToGroup === group.id ? (
                                  <div className="mt-4 p-5 bg-white border-2 border-indigo-100 rounded-2xl shadow-sm space-y-6">
                                    <div>
                                      <label className="block text-sm font-bold text-slate-700 mb-2">Exposure Step Description</label>
                                      <input 
                                        type="text"
                                        placeholder="E.g., Touching the doorknob without washing hands..."
                                        className="w-full font-medium border-slate-200 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 p-3 bg-slate-50"
                                        value={newItem.title}
                                        onChange={e => setNewItem({...newItem, title: e.target.value})}
                                        autoFocus
                                      />
                                    </div>
                                    
                                    <div className="pt-2">
                                      <VisualSudsSelector 
                                        label="Target SUDS (Expected anxiety level)"
                                        value={newItem.targetSuds} 
                                        onChange={v => setNewItem({...newItem, targetSuds: v})} 
                                      />
                                    </div>

                                    <div className="pt-2">
                                      <label className="block text-sm font-bold text-slate-700 mb-2 text-center">Duration (minutes)</label>
                                      <div className="flex justify-center items-center gap-4">
                                        <input 
                                          type="range" min="1" max="120"
                                          className="w-full max-w-xs accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                          value={newItem.durationMin}
                                          onChange={e => setNewItem({...newItem, durationMin: e.target.value})}
                                        />
                                        <span className="font-black text-xl text-indigo-700 w-12">{newItem.durationMin}m</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                      <button onClick={() => setAddingItemToGroup(null)} className="font-bold text-slate-500 px-5 py-2.5 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                                      <button onClick={() => handleAddItem(group.id)} className="font-bold bg-indigo-600 text-white px-6 py-2.5 rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-colors">Add to Hierarchy</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => setAddingItemToGroup(group.id)}
                                    className="w-full py-4 mt-3 border-2 border-dashed border-slate-300 rounded-xl text-sm font-bold text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                  >
                                    <Plus className="w-5 h-5" /> Add Exposure Step
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

              {chartData.length >= 2 && (
                <div className="bg-white/70 backdrop-blur-md rounded-3xl shadow-xl border border-white p-6 md:p-8">
                  <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-2">
                    <TrendingDown className="w-7 h-7 text-emerald-500" />
                    Habituation Progress
                  </h3>
                  <p className="text-sm font-medium text-slate-500 mb-8">Narrowing gap indicates sustained habituation progress</p>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                        <defs>
                          <linearGradient id="colorPre" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPost" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" tick={{fontSize: 12, fill: '#94a3b8', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#94a3b8', fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '20px' }} iconType="circle" />
                        <Area type="monotone" name="Pre-SUDS (Before)" dataKey="pre" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPre)" activeDot={{r: 6, strokeWidth: 0}} />
                        <Area type="monotone" name="Post-SUDS (After)" dataKey="post" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPost)" activeDot={{r: 6, strokeWidth: 0}} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {sessions.length > 0 && (
                <div className="space-y-6">
                  <h3 className="text-2xl font-black text-slate-800 ml-2">Recent Sessions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {sessions.slice(-8).reverse().map(s => {
                      const drop = s.preSuds - s.postSuds;
                      const dropColor = drop >= 10 ? 'text-emerald-600' : (drop > 0 ? 'text-emerald-500' : 'text-amber-500');
                      const dropBg = drop >= 10 ? 'bg-emerald-100' : (drop > 0 ? 'bg-emerald-50' : 'bg-amber-50');
                      return (
                        <div key={s.id} className="bg-white/70 backdrop-blur-md border-2 border-white rounded-2xl p-5 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all relative overflow-hidden group">
                          <div className="absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
                            <Target className="w-24 h-24 text-indigo-900" />
                          </div>
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <span className="font-bold text-slate-800 line-clamp-1 pr-4">{s.itemTitle || "ERP Session"}</span>
                          </div>
                          <div className="flex items-center gap-4 mb-5 relative z-10">
                            <div className="flex items-center text-sm font-bold text-slate-500">
                              <span className="text-slate-700 text-lg">{s.preSuds}</span>
                              <ArrowRight className="w-4 h-4 mx-2 text-slate-300" />
                              <span className="text-slate-700 text-lg">{s.postSuds}</span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${dropBg} ${dropColor}`}>
                              {drop > 0 ? `-${drop}` : (drop < 0 ? `+${Math.abs(drop)}` : '0')} pts
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400 relative z-10">
                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {Math.floor(s.durationSec / 60)}m {s.durationSec % 60}s</span>
                            <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="session"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex-1 flex flex-col justify-center"
            >
              {sessionPhase === 'pre' && (
                <div className="w-full max-w-xl mx-auto bg-white/80 backdrop-blur-xl shadow-2xl border border-white rounded-3xl p-8 md:p-12 text-center">
                  <h2 className="text-3xl font-black text-slate-800 mb-6">Ready to begin?</h2>
                  <div className="p-6 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-2xl border border-indigo-200 mb-8 shadow-inner">
                    <p className="text-2xl font-bold text-indigo-900 mb-2">{activeItem.title}</p>
                    <div className="flex items-center justify-center gap-2 text-indigo-700 font-medium">
                      <Clock className="w-5 h-5" /> 
                      <span>Target duration: {activeItem.durationMin} minutes</span>
                    </div>
                  </div>
                  
                  <div className="mb-10">
                    <VisualSudsSelector 
                      label="What is your SUDS right now? (0-100)"
                      value={preSuds}
                      onChange={setPreSuds}
                    />
                  </div>

                  <div className="bg-teal-50 text-teal-800 p-5 rounded-2xl border border-teal-100 mb-8 text-sm font-bold italic shadow-sm">
                    "{coachingMessage}"
                  </div>

                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button onClick={resetStudio} className="px-8 py-4 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors w-full sm:w-auto">
                      Cancel
                    </button>
                    <button onClick={beginTimer} className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/30 transition-all w-full sm:w-auto text-lg">
                      Begin Exposure
                    </button>
                  </div>
                </div>
              )}

              {sessionPhase === 'running' && (
                <div className="w-full max-w-2xl mx-auto flex flex-col items-center py-10 relative">
                  {!isPaused && (
                    <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-30 z-0">
                      <div className="w-[800px] h-[800px] bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full blur-[100px] animate-pulse-slow"></div>
                    </div>
                  )}

                  <div className="mb-12 text-center relative z-10">
                    <h2 className="text-2xl md:text-4xl font-black text-indigo-950 mb-4">{activeItem.title}</h2>
                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-white/50 backdrop-blur-md border border-white text-indigo-900 rounded-full font-bold text-sm tracking-widest uppercase shadow-sm">
                      <Activity className="w-4 h-4" /> Pre-SUDS: {preSuds}
                    </div>
                  </div>

                  <div className="mb-12 relative z-10">
                    <CircularTimer timeLeft={timeLeft} totalTime={activeItem.durationMin * 60} isPaused={isPaused} />
                  </div>

                  <div className="w-full mb-12 relative z-10">
                    <UrgeWaveProgress progress={durationElapsed / (activeItem.durationMin * 60)} />
                  </div>

                  <div className="h-32 flex items-center justify-center w-full px-4 mb-8 relative z-10">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={groundingIndex + actionIndex}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="bg-white/80 backdrop-blur-md rounded-3xl p-6 md:p-8 text-center shadow-xl border border-white w-full max-w-md mx-auto"
                      >
                        <p className="text-lg md:text-xl text-slate-800 font-bold mb-4">{coachingMessage}</p>
                        <p className="text-md font-black text-indigo-600 mb-2">{GROUNDING_PROMPTS[groundingIndex]}</p>
                        <p className="text-sm font-medium text-slate-500 italic">{WAIT_SUPPORT_ACTIONS[actionIndex]}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-6 relative z-10">
                    <button 
                      onClick={() => setIsPaused(!isPaused)}
                      className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-2xl transition-all hover:scale-105 active:scale-95 ${isPaused ? 'bg-slate-800' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/40'}`}
                    >
                      {isPaused ? <Play className="w-8 h-8 ml-1" fill="currentColor" /> : <Pause className="w-8 h-8" fill="currentColor" />}
                    </button>
                    <button 
                      onClick={endSessionEarly}
                      className="w-16 h-16 rounded-full flex items-center justify-center bg-white text-rose-500 hover:bg-rose-50 shadow-lg transition-colors border border-rose-100"
                    >
                      <Square className="w-6 h-6" fill="currentColor" />
                    </button>
                  </div>
                </div>
              )}

              {sessionPhase === 'cancel' && (
                <div className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-10 text-center border border-rose-100">
                  <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-8">
                    <AlertTriangle className="w-12 h-12 text-rose-500" />
                  </div>
                  <h3 className="text-3xl font-black text-slate-800 mb-4">Stopping early is okay</h3>
                  <p className="text-slate-600 font-medium mb-10 text-lg">
                    Leaving early is perfectly fine — the data still helps. Return when you feel ready.
                  </p>
                  <div className="flex flex-col gap-4">
                    <button onClick={resumeTimer} className="w-full py-4 rounded-xl bg-slate-100 text-slate-700 font-bold text-lg hover:bg-slate-200 transition-colors">
                      Resume Session
                    </button>
                    <button onClick={confirmEndEarly} className="w-full py-4 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold text-lg hover:from-rose-600 hover:to-red-700 shadow-lg shadow-rose-500/30 transition-all">
                      End & Log Data
                    </button>
                  </div>
                </div>
              )}

              {sessionPhase === 'post' && (
                <div className="w-full max-w-xl mx-auto bg-white/90 backdrop-blur-xl shadow-2xl border border-white rounded-3xl p-8 md:p-12 text-center">
                  <h2 className="text-4xl font-black text-emerald-800 mb-3">Session Complete! 🎉</h2>
                  <p className="text-emerald-600 font-bold text-lg mb-10">Great job staying with the discomfort.</p>
                  
                  <div className="mb-12">
                    <VisualSudsSelector 
                      label="What is your SUDS now? (0-100)"
                      value={postSuds}
                      onChange={setPostSuds}
                    />
                  </div>

                  <div className="flex justify-center items-center gap-8 mb-12 p-8 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                    <div className="text-center">
                      <div className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-2">Before</div>
                      <div className="text-5xl font-black text-slate-700">{preSuds}</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <ArrowRight className="w-10 h-10 text-emerald-400" />
                      <span className="text-sm font-black text-emerald-600 mt-2 bg-emerald-100 px-3 py-1 rounded-full">
                        {preSuds - postSuds > 0 ? `-${preSuds - postSuds} pts` : `+${postSuds - preSuds} pts`}
                      </span>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold uppercase tracking-widest text-emerald-600 mb-2">Now</div>
                      <div className="text-5xl font-black text-emerald-700">{postSuds}</div>
                    </div>
                  </div>

                  <button onClick={logSession} className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xl hover:from-emerald-400 hover:to-teal-500 shadow-xl shadow-emerald-500/30 transition-all active:scale-95">
                    Save Session Data
                  </button>
                </div>
              )}

              {sessionPhase === 'done' && (
                <div className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-12 text-center border border-emerald-100">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="w-28 h-28 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/40"
                  >
                    <Check className="w-14 h-14 text-white" strokeWidth={3} />
                  </motion.div>
                  
                  <h2 className="text-4xl font-black text-slate-800 mb-6">Data Saved!</h2>
                  
                  {activeItem?.newlyMastered && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl my-8 inline-block shadow-sm w-full"
                    >
                      <p className="font-black text-xl flex items-center gap-3 justify-center mb-2 text-amber-600">
                        <Star className="w-7 h-7 fill-amber-500 text-amber-500" />
                        Step Mastered!
                      </p>
                      <p className="text-sm font-bold">Your SUDS dropped enough over multiple sessions to master this step.</p>
                    </motion.div>
                  )}
                  
                  <p className="text-slate-600 font-medium text-lg mb-12">Every session builds tolerance to uncertainty.</p>
                  
                  <button onClick={resetStudio} className="w-full py-4 rounded-xl bg-slate-100 text-slate-700 font-bold text-lg hover:bg-slate-200 transition-colors">
                    Return to Studio
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
