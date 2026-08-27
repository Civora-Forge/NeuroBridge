import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Brain, Activity, Target, Download, Sparkles, 
  CheckCircle2, ShieldAlert, Award, Calendar, ChevronRight, 
  Copy, TrendingDown, Flame, Shield, Star, Check, Lock, X 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, 
  Bar, AreaChart, Area, ReferenceArea, ReferenceLine, Cell 
} from 'recharts';
import {
  getSessions, getJournalEntries, getCompulsionOutcomes, 
  getResistanceStats, getStreakStats, getCalendarHeatmap, 
  getMilestones, checkAndEarnMilestones, buildTherapistExport, 
  buildWeeklyInsight
} from '@/support/specialized/ocdStore';

export default function ERPProgressTracker() {
  const [sessions, setSessions] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [compulsionOutcomes, setCompulsionOutcomes] = useState([]);
  const [streakStats, setStreakStats] = useState({ current: 0, longest: 0, total: 0 });
  const [resistanceStats, setResistanceStats] = useState({ resisted: 0, total: 0, percentage: 0 });
  const [heatmap, setHeatmap] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [insight, setInsight] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkAndEarnMilestones();
    setSessions(getSessions() || []);
    setJournalEntries(getJournalEntries() || []);
    setCompulsionOutcomes(getCompulsionOutcomes() || []);
    setStreakStats(getStreakStats() || { current: 0, longest: 0, total: 0 });
    
    const resStats = getResistanceStats(30) || { resisted: 0, total: 0 };
    setResistanceStats({ 
      ...resStats, 
      percentage: resStats.total > 0 ? Math.round((resStats.resisted / resStats.total) * 100) : 0 
    });
    
    setHeatmap(getCalendarHeatmap(84) || []);
    setMilestones(getMilestones() || []);
    setInsight(buildWeeklyInsight());
  }, []);

  const avgSudsDrop = useMemo(() => {
    if (!sessions || sessions.length === 0) return 0;
    const drops = sessions
      .filter(s => s.preSuds != null && s.postSuds != null)
      .map(s => s.preSuds - s.postSuds);
    if (drops.length === 0) return 0;
    const total = drops.reduce((sum, d) => sum + d, 0);
    return Math.round(total / drops.length);
  }, [sessions]);

  const sudsTrendData = useMemo(() => {
    if (!sessions) return [];
    return [...sessions].reverse().map(s => ({
      date: new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      preSuds: s.preSuds,
      postSuds: s.postSuds
    }));
  }, [sessions]);

  const subtypeFrequencyData = useMemo(() => {
    if (!journalEntries) return [];
    const counts = {};
    journalEntries.forEach(entry => {
      const type = entry.subtype || 'Other';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count
    }));
  }, [journalEntries]);

  const handleExport = () => {
    const text = buildTherapistExport();
    setExportText(text);
    setShowExport(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const weekColumns = useMemo(() => {
    const cols = [];
    if (!heatmap) return cols;
    for (let i = 0; i < heatmap.length; i += 7) {
      cols.push(heatmap.slice(i, i + 7));
    }
    return cols;
  }, [heatmap]);

  const earnedMilestonesCount = milestones.filter(m => m.earnedAt).length;
  const totalMilestonesCount = milestones.length > 0 ? milestones.length : 7;
  const hasData = sessions.length > 0 || journalEntries.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center mb-8">
          <Link to="/ocd" className="mr-4 p-2 rounded-full hover:bg-slate-200/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500">Your Progress</h1>
            <p className="text-slate-500 mt-1">Track your ERP journey and symptom reduction</p>
          </div>
        </div>

        {!hasData ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-100 mb-8"
          >
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-800 mb-2">Ready to start tracking?</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-6">Your progress dashboard will populate as you complete exposure sessions and log journal entries.</p>
            <Link to="/ocd/exposure-tracker" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors">
              Start an Exposure <ChevronRight className="w-5 h-5" />
            </Link>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Hero Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                <div className="flex justify-between items-start mb-2">
                  <div className="bg-amber-100 p-2 rounded-lg"><Flame className="w-5 h-5 text-amber-600" /></div>
                </div>
                <div className="text-3xl font-bold text-slate-800">{streakStats.current}</div>
                <div className="text-sm text-slate-500 font-medium mt-1">Active Streak</div>
                <div className="text-xs text-slate-400 mt-1">Best: {streakStats.longest}</div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-400 to-indigo-600"></div>
                <div className="flex justify-between items-start mb-2">
                  <div className="bg-indigo-100 p-2 rounded-lg"><Shield className="w-5 h-5 text-indigo-600" /></div>
                </div>
                <div className="text-3xl font-bold text-slate-800">{sessions.length}</div>
                <div className="text-sm text-slate-500 font-medium mt-1">ERP Sessions</div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                <div className="flex justify-between items-start mb-2">
                  <div className="bg-emerald-100 p-2 rounded-lg"><Award className="w-5 h-5 text-emerald-600" /></div>
                </div>
                <div className="text-3xl font-bold text-slate-800">{resistanceStats.percentage}%</div>
                <div className="text-sm text-slate-500 font-medium mt-1">Resistance Rate</div>
                <div className="text-xs text-slate-400 mt-1">{resistanceStats.resisted}/{resistanceStats.total} resisted</div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-400 to-purple-500"></div>
                <div className="flex justify-between items-start mb-2">
                  <div className="bg-violet-100 p-2 rounded-lg"><Star className="w-5 h-5 text-violet-600" /></div>
                </div>
                <div className="text-3xl font-bold text-slate-800">{earnedMilestonesCount}/{totalMilestonesCount}</div>
                <div className="text-sm text-slate-500 font-medium mt-1">Milestones Earned</div>
              </div>
            </div>

            {/* Avg SUDS Drop Highlight */}
            {avgSudsDrop > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 shadow-md text-white flex flex-col md:flex-row md:items-center justify-between"
              >
                <div>
                  <h3 className="text-emerald-50 font-medium flex items-center gap-2 mb-1">
                    <TrendingDown className="w-5 h-5" /> Average SUDS Drop
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold">{avgSudsDrop}</p>
                    <p className="text-emerald-100 text-lg">points</p>
                  </div>
                  <p className="text-emerald-100 text-sm mt-1 opacity-90">Reduction in anxiety across all exposure sessions</p>
                </div>
                <div className="mt-4 md:mt-0 p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                  <Activity className="w-10 h-10 text-emerald-100" />
                </div>
              </motion.div>
            )}

            {/* Weekly Insight */}
            {insight?.narratives?.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-l-emerald-500 border-y border-r border-y-slate-100 border-r-slate-100">
                <h3 className="text-slate-800 font-semibold flex items-center gap-2 mb-4 text-lg">
                  <Sparkles className="w-5 h-5 text-emerald-500" /> This Week
                </h3>
                <ul className="space-y-3">
                  {insight.narratives.map((nar, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 bg-emerald-100 rounded-full p-1"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                      <span className="text-slate-700">{nar}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Symptom Trend Chart */}
            {sudsTrendData.length >= 2 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-slate-800 font-semibold mb-6 flex items-center gap-2 text-lg">
                  <Activity className="w-5 h-5 text-teal-500" /> Session SUDS Trends
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sudsTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value, name) => [value, name === 'preSuds' ? 'Pre-SUDS' : 'Post-SUDS']}
                      />
                      <ReferenceLine y={30} stroke="#94a3b8" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="preSuds" name="preSuds" stroke="#f59e0b" strokeWidth={3} dot={{r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                      <Line type="monotone" dataKey="postSuds" name="postSuds" stroke="#14b8a6" strokeWidth={3} dot={{r: 4, fill: '#14b8a6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4 text-sm font-medium text-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div> Pre-Exposure Anxiety
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-teal-500"></div> Post-Exposure Anxiety
                  </div>
                </div>
              </div>
            )}

            {/* Milestones Gallery */}
            {milestones.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-slate-800 font-semibold mb-6 flex items-center gap-2 text-lg">
                  <Target className="w-5 h-5 text-violet-500" /> Milestones Earned
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  {milestones.map((m, i) => {
                    const earned = !!m.earnedAt;
                    return (
                      <div key={i} className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all ${earned ? 'border-violet-200 bg-gradient-to-b from-violet-50 to-white shadow-sm hover:shadow-md' : 'border-slate-100 bg-slate-50/50 opacity-70'}`}>
                        <div className="text-4xl mb-3 relative flex items-center justify-center w-12 h-12">
                          {earned ? m.icon : <div className="grayscale opacity-40">{m.icon}</div>}
                          {!earned && <div className="absolute -bottom-1 -right-1 bg-slate-200 rounded-full p-1 border border-white"><Lock className="w-3 h-3 text-slate-500" /></div>}
                        </div>
                        <div className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight mb-1" title={m.title}>{m.title}</div>
                        {earned ? (
                          <div className="text-[10px] font-medium text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full mt-1">{new Date(m.earnedAt).toLocaleDateString()}</div>
                        ) : (
                          <div className="text-[10px] text-slate-400 mt-1">Locked</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Subtype Frequency Chart */}
              {subtypeFrequencyData.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-slate-800 font-semibold mb-6 flex items-center gap-2 text-lg">
                    <Brain className="w-5 h-5 text-indigo-500" /> Theme Frequency
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subtypeFrequencyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} allowDecimals={false} />
                        <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="count" name="Entries" radius={[4, 4, 0, 0]}>
                          {subtypeFrequencyData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#6366f1', '#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899'][index % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Activity Calendar (Heatmap) */}
              {weekColumns.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 overflow-x-auto">
                  <h3 className="text-slate-800 font-semibold mb-4 flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5 text-emerald-500" /> Activity History
                  </h3>
                  <div className="flex gap-1.5 min-w-max py-2">
                    {weekColumns.map((col, w) => (
                      <div key={w} className="flex flex-col gap-1.5">
                        {col.map((day, d) => {
                          const count = day.count || 0;
                          let colorClass = "bg-slate-100";
                          if (count === 1) colorClass = "bg-emerald-200";
                          else if (count >= 2 && count <= 3) colorClass = "bg-emerald-400";
                          else if (count >= 4) colorClass = "bg-emerald-600";
                          return (
                            <div 
                              key={d} 
                              className={`w-4 h-4 rounded-sm ${colorClass} hover:ring-2 hover:ring-offset-1 hover:ring-emerald-400 transition-all cursor-default`}
                              title={day.date ? `${new Date(day.date).toLocaleDateString()}: ${count} activities` : ''}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-4 text-xs text-slate-500">
                    <span>Less</span>
                    <div className="w-3 h-3 rounded-sm bg-slate-100"></div>
                    <div className="w-3 h-3 rounded-sm bg-emerald-200"></div>
                    <div className="w-3 h-3 rounded-sm bg-emerald-400"></div>
                    <div className="w-3 h-3 rounded-sm bg-emerald-600"></div>
                    <span>More</span>
                  </div>
                </div>
              )}
            </div>

            {/* Therapist Export Section */}
            <div className="bg-slate-900 rounded-2xl p-6 shadow-lg mt-8 text-white flex flex-col md:flex-row items-center justify-between border border-slate-800">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2 mb-1">
                  <Download className="w-5 h-5 text-indigo-400" /> Share with Therapist
                </h3>
                <p className="text-slate-400 text-sm max-w-xl">Generate a structured summary of your recent progress, exposures, and themes to discuss in your next therapy session.</p>
              </div>
              <button 
                onClick={handleExport}
                className="mt-6 md:mt-0 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-white rounded-xl font-medium transition-all shrink-0 shadow-md shadow-indigo-500/20"
              >
                Generate Report
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExport && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Download className="w-4 h-4 text-slate-500" /> Therapist Report
                </h3>
                <button 
                  onClick={() => setShowExport(false)} 
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto bg-slate-900 text-slate-300 font-mono text-sm whitespace-pre-wrap flex-1 selection:bg-indigo-500/30">
                {exportText}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-medium transition-colors shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied to Clipboard' : 'Copy Report'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
