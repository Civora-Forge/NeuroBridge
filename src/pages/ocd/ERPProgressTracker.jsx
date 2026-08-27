import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  ArrowLeft, Brain, Activity, Target, Download, Sparkles, 
  CheckCircle2, ShieldAlert, Award, Calendar, Copy, LineChart as LineChartIcon
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, AreaChart, Area, ReferenceArea 
} from 'recharts';

import { getSessions, getJournalEntries } from '@/api/ocdApi';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function ERPProgressTracker() {
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ['erp-sessions'],
    queryFn: getSessions
  });
  
  const { data: journalEntries = [], isLoading: loadingJournal } = useQuery({
    queryKey: ['ocd-journal'],
    queryFn: getJournalEntries
  });

  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState('');
  const [copied, setCopied] = useState(false);

  // Compute Streak Stats
  const streakStats = useMemo(() => {
    const activeDays = new Set();
    sessions.forEach(s => {
      if (s.created_at) activeDays.add(s.created_at.slice(0, 10));
    });
    journalEntries.forEach(j => {
      if (j.created_at) activeDays.add(j.created_at.slice(0, 10));
    });

    const sortedDays = Array.from(activeDays).sort();
    let current = 0;
    let longest = 0;
    let streak = 0;

    if (sortedDays.length > 0) {
      streak = 1;
      longest = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const d1 = new Date(sortedDays[i - 1]);
        const d2 = new Date(sortedDays[i]);
        const diff = (d2 - d1) / (1000 * 60 * 60 * 24);
        if (diff === 1) {
          streak++;
          longest = Math.max(longest, streak);
        } else {
          streak = 1;
        }
      }
      const today = new Date().toISOString().slice(0, 10);
      const lastDay = sortedDays[sortedDays.length - 1];
      const daysSince = Math.round((new Date(today) - new Date(lastDay)) / (1000 * 60 * 60 * 24));
      current = daysSince > 1 ? 0 : streak;
    }
    return { current, longest };
  }, [sessions, journalEntries]);

  // Compute Avg SUDS Drop
  const avgSudsDrop = useMemo(() => {
    if (sessions.length === 0) return null;
    const completed = sessions.filter(s => s.pre_suds != null && s.post_suds != null);
    if (completed.length === 0) return null;
    const totalDrop = completed.reduce((sum, s) => sum + (s.pre_suds - s.post_suds), 0);
    return Math.round(totalDrop / completed.length);
  }, [sessions]);

  // Compute Symptom Intensity Trend Data
  const sudsTrendData = useMemo(() => {
    return sessions.slice(-20).map(s => {
      const date = new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      return {
        date,
        preSuds: s.pre_suds || 0,
        postSuds: s.post_suds || 0,
        fullDate: new Date(s.created_at).toLocaleString()
      };
    });
  }, [sessions]);

  // Compute Compulsion Frequency by Subtype
  const subtypeFrequencyData = useMemo(() => {
    const entries = journalEntries.slice(-50);
    const counts = {};
    entries.forEach(e => {
      const subtype = e.obsession || e.trigger || 'Unspecified';
      counts[subtype] = (counts[subtype] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // top 5
  }, [journalEntries]);

  // Resistance Stats
  const resistanceStats = useMemo(() => {
    const total = sessions.filter(s => s.resisted_compulsion !== null && s.resisted_compulsion !== undefined).length;
    const resisted = sessions.filter(s => s.resisted_compulsion === true).length;
    return {
      total,
      resisted,
      percentage: total > 0 ? Math.round((resisted / total) * 100) : 0
    };
  }, [sessions]);

  // Compute Resistance Rate Over Time (Weekly)
  const resistanceTrendData = useMemo(() => {
    if (sessions.length === 0) return [];
    
    const outcomesByWeek = {};
    sessions.forEach(s => {
      if (s.resisted_compulsion === null || s.resisted_compulsion === undefined) return;
      
      const d = new Date(s.created_at);
      // Round down to start of week (Sunday)
      const diff = d.getDate() - d.getDay();
      const startOfWeek = new Date(d.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      const key = startOfWeek.getTime();
      
      if (!outcomesByWeek[key]) {
        outcomesByWeek[key] = { resisted: 0, total: 0, date: startOfWeek };
      }
      outcomesByWeek[key].total++;
      if (s.resisted_compulsion) outcomesByWeek[key].resisted++;
    });

    const sortedKeys = Object.keys(outcomesByWeek).sort();
    return sortedKeys.map(k => {
      const week = outcomesByWeek[k];
      return {
        date: week.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        rate: week.total > 0 ? Math.round((week.resisted / week.total) * 100) : 0,
        total: week.total
      };
    });
  }, [sessions]);

  // Consistency Map (Heatmap)
  const heatmap = useMemo(() => {
    const numDays = 84;
    const result = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      
      const sc = sessions.filter(s => s.created_at?.slice(0, 10) === key).length;
      const jc = journalEntries.filter(j => j.created_at?.slice(0, 10) === key).length;
      
      const activity = sc + jc;
      result.push({
        date: key,
        level: activity === 0 ? 0 : Math.min(3, activity <= 1 ? 1 : activity <= 3 ? 2 : 3),
        count: activity
      });
    }
    return result;
  }, [sessions, journalEntries]);

  // Milestones
  const milestones = useMemo(() => {
    const MILESTONE_DEFS = [
      { id: "first_session", label: "First Step", desc: "Completed your first ERP session.", icon: "🌱",
        check: () => sessions.length >= 1 
      },
      { id: "first_resist", label: "First Resistance", desc: "Resisted a compulsion for the first time.", icon: "💪",
        check: () => sessions.some(s => s.resisted_compulsion) 
      },
      { id: "sessions_10", label: "10 Exposures", desc: "Logged 10 ERP sessions.", icon: "🎯",
        check: () => sessions.length >= 10 
      },
      { id: "suds_drop_20", label: "Habituation Hero", desc: "SUDS dropped 20+ points in one session.", icon: "📉",
        check: () => sessions.some(s => s.pre_suds != null && s.post_suds != null && (s.pre_suds - s.post_suds) >= 20) 
      },
      { id: "streak_7", label: "7-Day Warrior", desc: "Active for 7 consecutive days.", icon: "🔥",
        check: () => streakStats.longest >= 7 
      },
      { id: "streak_30", label: "30-Day Champion", desc: "Maintained a 30-day streak.", icon: "🏆",
        check: () => streakStats.longest >= 30 
      },
    ];
    
    return MILESTONE_DEFS.map((m, index) => ({
      id: m.id,
      title: m.label,
      description: m.desc,
      icon: m.icon,
      earned: m.check(),
      index
    }));
  }, [sessions, streakStats]);

  const insight = useMemo(() => {
    const week = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentSessions = sessions.filter(s => new Date(s.created_at).getTime() > week);
    if (recentSessions.length === 0) return "No ERP sessions logged this week yet. Start your first ERP session to see personalized insights about your habituation patterns.";
    
    const avgPre = (recentSessions.reduce((sum, s) => sum + (s.pre_suds || 0), 0) / recentSessions.length).toFixed(0);
    const avgPost = (recentSessions.reduce((sum, s) => sum + (s.post_suds || 0), 0) / recentSessions.length).toFixed(0);
    
    return `Across ${recentSessions.length} ERP session${recentSessions.length > 1 ? "s" : ""} this week, your average post-session SUDS was ${avgPost} (started at ${avgPre}). Great work continuing your practice!`;
  }, [sessions]);

  const handleExport = () => {
    const avgDrop = avgSudsDrop !== null ? avgSudsDrop : "N/A";
    const lines = [
      "═══════════════════════════════════════════════════",
      "   NeuroBridge OCD Progress Report",
      `   Generated: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
      "═══════════════════════════════════════════════════",
      "",
      "── ERP SESSION SUMMARY ──────────────────────────",
      `Total ERP sessions logged:     ${sessions.length}`,
      `Average SUDS drop per session: ${avgDrop} points`,
      `Current active streak:         ${streakStats.current} day(s)`,
      `Longest streak:                ${streakStats.longest} day(s)`,
      "",
      "── RESPONSE PREVENTION ──────────────────────────",
      `Total delay attempts:   ${resistanceStats.total}`,
      `Fully resisted:         ${resistanceStats.resisted} (${resistanceStats.percentage}%)`,
      "",
      "── THOUGHT JOURNAL ──────────────────────────────",
      `Total entries:          ${journalEntries.length}`,
      "",
      "── MILESTONES EARNED ────────────────────────────",
      milestones.filter(m => m.earned).length === 0 
        ? "None yet — keep practising."
        : milestones.filter(m => m.earned).map(m => `  ${m.icon} ${m.title} — ${m.description}`).join("\n"),
      "",
      "── CLINICAL NOTE ────────────────────────────────",
      "This report was generated from self-monitored data via NeuroBridge.",
      "Data reflects client-reported measures and should be interpreted",
      "alongside clinical assessment. Not a substitute for therapy.",
      "═══════════════════════════════════════════════════"
    ];
    setExportText(lines.filter(Boolean).join("\n"));
    setShowExport(true);
    setCopied(false);
  };

  const handleCopy = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(exportText).then(() => setCopied(true));
    } else {
      prompt('Copy this report:', exportText);
      setCopied(true);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCalendarHeatmap = () => {
    if (heatmap.length === 0) return null;
    
    // Group heatmap into 7-day columns (weeks)
    const weeks = [];
    for (let i = 0; i < heatmap.length; i += 7) {
      weeks.push(heatmap.slice(i, i + 7));
    }

    const levelColor = (level) => {
      if (level === 0) return 'bg-gray-100';
      if (level === 1) return 'bg-teal-200';
      if (level === 2) return 'bg-teal-400';
      return 'bg-teal-600';
    };

    return (
      <div className="flex flex-col text-xs text-gray-500">
        <div className="flex overflow-x-auto pb-4 hide-scrollbar">
          <div className="flex gap-1">
            <div className="flex flex-col gap-1 pr-2 pt-5 justify-between">
              <span className="h-3 leading-3">Sun</span>
              <span className="h-3 leading-3">Tue</span>
              <span className="h-3 leading-3">Thu</span>
              <span className="h-3 leading-3">Sat</span>
            </div>
            
            {weeks.map((week, wIdx) => {
              const firstDayOfMonth = week.find(d => new Date(d.date).getDate() <= 7);
              const monthLabel = firstDayOfMonth ? new Date(firstDayOfMonth.date).toLocaleDateString(undefined, { month: 'short' }) : '';
              
              return (
                <div key={wIdx} className="flex flex-col gap-1 relative">
                  <div className="h-4 flex items-end mb-1 font-medium">{monthLabel}</div>
                  {week.map((day) => (
                    <div 
                      key={day.date} 
                      title={`${new Date(day.date).toLocaleDateString()}: ${day.count} activities`}
                      className={`w-3 h-3 rounded-sm ${levelColor(day.level)} hover:ring-1 hover:ring-gray-400 transition-all`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-2">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-gray-100"></div>
          <div className="w-3 h-3 rounded-sm bg-teal-200"></div>
          <div className="w-3 h-3 rounded-sm bg-teal-400"></div>
          <div className="w-3 h-3 rounded-sm bg-teal-600"></div>
          <span>More</span>
        </div>
      </div>
    );
  };

  const Star = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  );

  const isLoading = loadingSessions || loadingJournal;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <Activity className="w-8 h-8 text-teal-600 animate-pulse" />
        <p className="text-gray-500 font-medium">Syncing ERP Progress...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/20 text-slate-800 pb-20">
      <header className="pt-12 pb-8 px-6 bg-white/50 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link to="/ocd" className="inline-flex items-center text-teal-600 font-medium hover:text-teal-700 transition-colors mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to OCD & ERP
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Progress Intelligence</h1>
            <p className="text-slate-500 mt-1">Data-driven insights to guide your recovery journey.</p>
          </div>
          <button 
            onClick={handleExport}
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 py-2.5 px-4 text-sm font-semibold text-white hover:bg-teal-700 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Therapist Export
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <p className="text-sm text-gray-500 italic text-center">
          This tool supports ERP between therapy sessions — it does not replace clinical care.
        </p>

        <motion.div variants={cardVariants} initial="hidden" animate="visible" className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">ERP Sessions</p>
            <p className="text-3xl font-bold text-teal-700">{sessions.length}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Avg SUDS Drop</p>
            <p className="text-3xl font-bold text-teal-700">{avgSudsDrop !== null ? `-${avgSudsDrop}` : '—'}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Streak</p>
            <p className="text-3xl font-bold text-teal-700">{streakStats.current} <span className="text-lg font-normal text-teal-600/70">days</span></p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center flex flex-col justify-center">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Resistance Rate</p>
            <p className="text-3xl font-bold text-teal-700">{resistanceStats.percentage}%</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 text-center flex flex-col justify-center col-span-2 md:col-span-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Milestones</p>
            <p className="text-3xl font-bold text-teal-700">{milestones.filter(m => m.earned).length}</p>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} initial="hidden" animate="visible" className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 shadow-sm p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Brain className="w-24 h-24 text-teal-600" />
          </div>
          <h2 className="text-lg font-semibold text-teal-900 flex items-center mb-3">
            <Sparkles className="w-5 h-5 mr-2 text-teal-600" />
            Clinical Insights
          </h2>
          <div className="relative z-10 text-teal-800 leading-relaxed text-sm">
            <p>{insight}</p>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} initial="hidden" animate="visible" className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-gray-400" />
            Consistency Map (Last 12 Weeks)
          </h2>
          {heatmap.length > 0 ? (
            renderCalendarHeatmap()
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm">No activity data available yet.</div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div variants={cardVariants} initial="hidden" animate="visible" className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 col-span-1 md:col-span-2">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Symptom Intensity Trend</h2>
            <p className="text-sm text-gray-500 mb-6">Narrowing gap between Pre and Post SUDS indicates sustained habituation.</p>
            
            {sudsTrendData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sudsTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#0f172a', fontWeight: 600, marginBottom: '4px' }}
                    />
                    <ReferenceArea y1={0} y2={30} fill="#10b981" fillOpacity={0.05} />
                    <Line type="monotone" dataKey="preSuds" name="Pre-SUDS" stroke="#f97316" strokeWidth={3} dot={{r:4, fill:'#f97316', strokeWidth: 0}} activeDot={{r: 6}} />
                    <Line type="monotone" dataKey="postSuds" name="Post-SUDS" stroke="#0d9488" strokeWidth={3} dot={{r:4, fill:'#0d9488', strokeWidth: 0}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 w-full flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
                Complete ERP sessions to see your habituation curve.
              </div>
            )}
          </motion.div>

          <motion.div variants={cardVariants} initial="hidden" animate="visible" className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">Subtype Distribution</h2>
            {subtypeFrequencyData.length > 0 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subtypeFrequencyData} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 11, fill: '#475569'}} axisLine={false} tickLine={false} width={100} />
                    <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="count" name="Entries" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 w-full flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 text-center p-4">
                Log journal entries to see your primary OCD themes.
              </div>
            )}
          </motion.div>

          <motion.div variants={cardVariants} initial="hidden" animate="visible" className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-6">Weekly Resistance Rate</h2>
            {resistanceTrendData.length > 0 ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={resistanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="rate" name="Resistance %" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 w-full flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-gray-200 text-sm text-gray-400 text-center p-4">
                Log compulsion outcomes to track your resistance strength.
              </div>
            )}
          </motion.div>
        </div>

        <motion.div variants={cardVariants} initial="hidden" animate="visible" className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1 flex items-center">
            <Target className="w-5 h-5 mr-2 text-teal-600" />
            Recovery Milestones
          </h2>
          <p className="text-sm text-gray-500 mb-6">Celebrate your wins. Setbacks are just data for the next attempt.</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {milestones.map((m) => (
              <div 
                key={m.id} 
                className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all ${
                  m.earned 
                    ? 'border-emerald-200 bg-emerald-50 shadow-sm' 
                    : 'border-gray-100 bg-gray-50 opacity-60 grayscale hover:grayscale-0'
                }`}
              >
                <div className={`p-3 rounded-full mb-3 ${m.earned ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-400'}`}>
                  {m.icon === '🌱' && <Target className="w-6 h-6" />}
                  {m.icon === '⭐' && <Star className="w-6 h-6" />}
                  {m.icon === '🔥' && <Activity className="w-6 h-6" />}
                  {m.icon === '🏆' && <Award className="w-6 h-6" />}
                  {m.icon === '💪' && <ShieldAlert className="w-6 h-6" />}
                  {m.icon === '🎯' && <CheckCircle2 className="w-6 h-6" />}
                  {m.icon === '📉' && <LineChartIcon className="w-6 h-6" />}
                </div>
                <h3 className={`font-semibold text-sm mb-1 ${m.earned ? 'text-emerald-900' : 'text-gray-600'}`}>{m.title}</h3>
                <p className={`text-xs ${m.earned ? 'text-emerald-700' : 'text-gray-500'}`}>{m.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

      </main>

      <AnimatePresence>
        {showExport && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                  <Download className="w-5 h-5 mr-2 text-teal-600" />
                  Clinical Data Export
                </h3>
                <button 
                  onClick={() => setShowExport(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex items-start">
                  <ShieldAlert className="w-5 h-5 text-blue-500 mr-3 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800 leading-relaxed">
                    This report contains sensitive health information formatted for clinical review. Share securely via your provider's patient portal or during session.
                  </p>
                </div>
                
                <div className="relative group">
                  <pre className="text-xs sm:text-sm font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4 whitespace-pre-wrap overflow-x-auto min-h-[200px]">
                    {exportText}
                  </pre>
                  <button
                    onClick={handleCopy}
                    className="absolute top-3 right-3 p-2 bg-white rounded-lg border border-gray-200 shadow-sm text-gray-600 hover:text-teal-600 hover:border-teal-200 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    title="Copy to clipboard"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="px-6 py-4 border-t border-gray-100 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setShowExport(false)}
                  className="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
