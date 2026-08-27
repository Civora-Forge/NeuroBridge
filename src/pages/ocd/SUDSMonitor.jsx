import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Activity, Info, X, TrendingUp, 
  Check, AlertTriangle, BarChart2, ShieldAlert, 
  Sparkles, Clock, MapPin, Zap
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell 
} from 'recharts';
import { 
  getSudsReadings, 
  addSudsReading, 
  getDailySudsStats, 
  detectAnxietySpike, 
  checkAndEarnMilestones 
} from '@/support/specialized/ocdStore';

const CONTEXT_TAGS = [
  'Before compulsion', 'During exposure', 'After exposure',
  'Random check-in', 'Morning', 'Evening', 'At trigger'
];

const TAG_META = {
  'Before compulsion': { emoji: '⏳', color: 'bg-violet-100 text-violet-700 border-violet-200', active: 'bg-violet-600 text-white border-violet-600' },
  'During exposure':   { emoji: '🎯', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', active: 'bg-indigo-600 text-white border-indigo-600' },
  'After exposure':    { emoji: '✅', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
  'Random check-in':   { emoji: '📍', color: 'bg-slate-100 text-slate-700 border-slate-200', active: 'bg-slate-600 text-white border-slate-600' },
  'Morning':           { emoji: '☀️', color: 'bg-amber-100 text-amber-700 border-amber-200', active: 'bg-amber-500 text-white border-amber-500' },
  'Evening':           { emoji: '🌙', color: 'bg-blue-100 text-blue-700 border-blue-200', active: 'bg-blue-600 text-white border-blue-600' },
  'At trigger':        { emoji: '⚡', color: 'bg-orange-100 text-orange-700 border-orange-200', active: 'bg-orange-500 text-white border-orange-500' },
};

const getSudsLevel = (val) => {
  if (val < 30) return 'Calm';
  if (val < 60) return 'Mild';
  if (val < 80) return 'Moderate';
  if (val < 90) return 'High';
  return 'Intense';
};

const getSudsColorState = (val) => {
  if (val < 30) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', fill: '#10b981' };
  if (val < 60) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', fill: '#f59e0b' };
  if (val < 80) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', fill: '#f97316' };
  return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', fill: '#e11d48' };
};

const getGradientColor = (v) => {
  if (v < 30) return '#10b981'; // emerald
  if (v < 60) return '#f59e0b'; // amber
  if (v < 80) return '#f97316'; // orange
  return '#e11d48'; // rose
};

const CustomDot = (props) => {
  const { cx, cy, value } = props;
  const color = getSudsColorState(value).fill;
  return (
    <circle 
      cx={cx} cy={cy} r={4.5} 
      fill={color} 
      stroke="white" 
      strokeWidth={2} 
      style={{ filter: `drop-shadow(0px 2px 2px ${color}66)` }}
    />
  );
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const state = getSudsColorState(val);
  return (
    <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl px-4 py-3 text-sm">
      <p className="text-slate-500 font-medium mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`font-black text-2xl ${state.text}`}>{val}</p>
        <p className={`font-semibold ${state.text} opacity-80 uppercase tracking-wide text-xs`}>{getSudsLevel(val)}</p>
      </div>
    </div>
  );
};

function VisualSudsScale({ value, onChange }) {
  const emojis = ['😌', '😊', '😐', '😟', '😰'];
  const color = getGradientColor(value);

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={getSudsLevel(value)}
          initial={{ scale: 0.9, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 1.1, opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="text-center select-none py-4"
        >
          <motion.span
            key={value}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="text-8xl font-black block leading-none tracking-tighter"
            style={{ 
              color,
              textShadow: `0 10px 30px ${color}40`
            }}
          >
            {value}
          </motion.span>
          <div 
            className="text-base font-bold mt-3 tracking-widest uppercase" 
            style={{ color }}
          >
            {getSudsLevel(value)}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="relative pt-2 pb-6 px-2">
        <div className="flex justify-between text-3xl mb-4 relative z-0">
          {emojis.map((e, i) => {
            const threshold = i * 25;
            const active = Math.abs(value - threshold) < 15;
            return (
              <motion.span
                key={i}
                animate={{ 
                  scale: active ? 1.4 : 1, 
                  opacity: active ? 1 : 0.3,
                  y: active ? -5 : 0
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="cursor-default"
                style={{
                  filter: active ? `drop-shadow(0 4px 6px rgba(0,0,0,0.1))` : 'none'
                }}
              >
                {e}
              </motion.span>
            );
          })}
        </div>

        <div className="relative h-6 w-full max-w-full group">
          <div
            className="absolute inset-0 rounded-full shadow-inner overflow-hidden"
            style={{ background: 'linear-gradient(to right, #10b981 0%, #f59e0b 50%, #e11d48 100%)' }}
          >
            <div className="absolute inset-0 bg-white/20 w-full h-full mix-blend-overlay" />
          </div>
          
          <input
            type="range"
            min="0"
            max="100"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />
          
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-xl border-[3px] pointer-events-none z-10"
            style={{
              left: `calc(${value}% - 16px)`,
              borderColor: color,
              boxShadow: `0 4px 12px ${color}60`
            }}
            animate={{ borderColor: color, boxShadow: `0 4px 12px ${color}60` }}
            transition={{ duration: 0.2 }}
          >
            <div className="absolute inset-1 rounded-full opacity-30" style={{ backgroundColor: color }} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function SUDSMonitor() {
  const navigate = useNavigate();

  const [currentSuds, setCurrentSuds] = useState(50);
  const [selectedTag, setSelectedTag] = useState(CONTEXT_TAGS[3]);
  const [note, setNote] = useState('');
  
  const [readings, setReadings] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [hasSpike, setHasSpike] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const loadData = useCallback(() => {
    const allReadings = getSudsReadings() || [];
    setReadings(allReadings);
    setDailyStats(getDailySudsStats(7) || []);
    setHasSpike(detectAnxietySpike());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogReading = async () => {
    if (isLogging) return;
    setIsLogging(true);
    addSudsReading({ level: currentSuds, context: selectedTag, note: note.trim() });
    checkAndEarnMilestones();
    loadData();
    setShowSuccess(true);
    setCurrentSuds(50);
    setNote('');
    setSelectedTag(CONTEXT_TAGS[3]);
    setTimeout(() => { 
      setShowSuccess(false); 
      setIsLogging(false); 
    }, 2000);
  };

  const todayReadings = useMemo(() => {
    const today = new Date().toDateString();
    return readings
      .filter(r => new Date(r.timestamp).toDateString() === today)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(r => {
        const d = new Date(r.timestamp);
        return {
          ...r,
          timeLabel: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: r.level,
        };
      });
  }, [readings]);

  const contextBreakdown = useMemo(() => {
    const counts = {};
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recent = readings.filter(r => r.timestamp > thirtyDaysAgo);
    recent.forEach(r => {
      if (!counts[r.context]) counts[r.context] = { name: r.context, count: 0, sum: 0 };
      counts[r.context].count += 1;
      counts[r.context].sum += r.level;
    });
    return Object.values(counts)
      .map(c => ({ ...c, avg: Math.round(c.sum / c.count) }))
      .sort((a, b) => b.count - a.count);
  }, [readings]);

  const colorState = getSudsColorState(currentSuds);

  const insight = useMemo(() => {
    if (readings.length < 5) return null;
    const avg = Math.round(readings.reduce((s, r) => s + r.level, 0) / readings.length);
    const ctxCounts = {};
    readings.forEach(r => { ctxCounts[r.context] = (ctxCounts[r.context] || 0) + 1; });
    const topCtx = Object.entries(ctxCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    return { avg, topCtx };
  }, [readings]);

  const trendData = useMemo(() => {
    if (todayReadings.length >= 3) return todayReadings;
    return readings
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-20)
      .map(r => ({
        ...r,
        timeLabel: new Date(r.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        value: r.level,
      }));
  }, [readings, todayReadings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50/30 to-orange-50/20 pb-24 selection:bg-amber-200">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link
              to="/ocd"
              className="p-2 -ml-2 rounded-full hover:bg-white/60 text-slate-500 hover:text-amber-600 transition-colors shadow-sm bg-white/40 backdrop-blur-sm border border-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent">
                Anxiety Monitor
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-1">Track your distress levels in real-time</p>
            </div>
          </div>
          <span className="hidden sm:flex items-center gap-2 text-xs font-bold text-amber-700 bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 px-3 py-1.5 rounded-full shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            Live Tracking
          </span>
        </div>

        {/* Spike Alert */}
        <AnimatePresence>
          {hasSpike && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="mb-6 overflow-hidden"
            >
              <div className="relative bg-gradient-to-r from-rose-50 to-red-50/50 border border-rose-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="absolute left-0 inset-y-0 w-1.5 bg-gradient-to-b from-rose-500 to-red-600" />
                <div className="flex items-start gap-4 p-5 pl-6">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-rose-100 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-bold text-rose-950 text-base">High Anxiety Detected</h3>
                    <p className="text-sm text-rose-800/80 mt-1.5 leading-relaxed font-medium">
                      You have logged multiple high SUDS readings recently. The discomfort will pass — an urge is not a command. Consider an ERP exercise to build resilience.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-4">
                      <button
                        onClick={() => navigate('/ocd/exposure-session')}
                        className="text-sm font-bold bg-rose-600 text-white px-5 py-2 rounded-xl hover:bg-rose-700 active:scale-95 transition-all shadow-sm shadow-rose-600/20"
                      >
                        Start ERP
                      </button>
                      <button
                        onClick={() => setHasSpike(false)}
                        className="text-sm font-bold bg-white text-rose-700 border border-rose-200 px-5 py-2 rounded-xl hover:bg-rose-50 active:scale-95 transition-all"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setHasSpike(false)}
                    className="text-rose-400 hover:text-rose-700 p-2 shrink-0 transition-colors rounded-full hover:bg-rose-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Logging Panel */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/50 p-6 md:p-8 mb-8 relative overflow-hidden">
          <div 
            className="absolute -top-32 -right-32 w-64 h-64 rounded-full opacity-10 pointer-events-none transition-colors duration-700 blur-3xl"
            style={{ backgroundColor: getGradientColor(currentSuds) }}
          />

          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <Activity className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Log a Reading</h2>
          </div>

          <div className="mb-10 px-2">
            <VisualSudsScale value={currentSuds} onChange={setCurrentSuds} />
          </div>

          {/* Context Tags */}
          <div className="mb-8">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
              Context
            </label>
            <div className="flex flex-wrap gap-2.5">
              {CONTEXT_TAGS.map(tag => {
                const meta = TAG_META[tag] || { emoji: '📌', color: 'bg-slate-100 text-slate-700', active: 'bg-slate-600 text-white' };
                const isSelected = selectedTag === tag;
                return (
                  <motion.button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                      isSelected
                        ? `${meta.active} shadow-md shadow-${meta.active.split(' ')[0].replace('bg-', '')}/20 scale-105`
                        : `bg-white border-slate-200 text-slate-600 hover:${meta.color}`
                    }`}
                  >
                    <span className="text-base">{meta.emoji}</span>
                    <span>{tag}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Note input */}
          <div className="mb-8">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="What triggered this?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400 transition-all"
            />
          </div>

          {/* Log Button */}
          <motion.button
            onClick={handleLogReading}
            disabled={isLogging}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-4 rounded-2xl font-black text-white text-lg flex items-center justify-center gap-3 transition-all ${
              showSuccess
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-xl hover:shadow-orange-500/20'
            }`}
          >
            <AnimatePresence mode="wait">
              {showSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="flex items-center gap-2"
                >
                  <Check className="w-6 h-6" />
                  Reading Logged!
                </motion.div>
              ) : (
                <motion.div
                  key="log"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2"
                >
                  <Activity className="w-6 h-6" />
                  Save Reading
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Today's Readings */}
        <AnimatePresence>
          {todayReadings.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Today's Timeline
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-1">
                {todayReadings.map((r, idx) => {
                  const cs = getSudsColorState(r.value);
                  return (
                    <motion.div
                      key={r.id || idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05, type: 'spring' }}
                      className={`min-w-[88px] rounded-2xl p-3 text-center border-2 shrink-0 shadow-sm ${cs.bg} ${cs.border}`}
                    >
                      <p className="text-[11px] text-slate-500 font-bold mb-2 uppercase tracking-wide">{r.timeLabel}</p>
                      <p className={`text-3xl font-black mb-1 ${cs.text}`}>{r.value}</p>
                      <p className={`text-[10px] font-black uppercase tracking-wider ${cs.text} opacity-70`}>{getSudsLevel(r.value)}</p>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* SUDS Trend Line Chart */}
          {readings.length >= 3 && (
            <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/40 p-6 md:col-span-2">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Distress Trend
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sudsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="timeLabel" 
                      tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                      tickLine={false} 
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '4 4' }} />
                    <ReferenceLine y={30} stroke="#10b981" strokeOpacity={0.4} strokeDasharray="4 4" />
                    <ReferenceLine y={60} stroke="#f59e0b" strokeOpacity={0.4} strokeDasharray="4 4" />
                    <ReferenceLine y={80} stroke="#e11d48" strokeOpacity={0.4} strokeDasharray="4 4" />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#f59e0b" 
                      strokeWidth={4}
                      dot={<CustomDot />}
                      activeDot={{ r: 7, stroke: '#fff', strokeWidth: 3, fill: '#f59e0b' }}
                      animationDuration={1500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Context Bar Chart */}
          {contextBreakdown.length > 0 && (
            <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/40 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-amber-500" />
                  Contexts
                </h3>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={contextBreakdown} 
                    layout="vertical" 
                    margin={{ top: 0, right: 0, left: -25, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                      tickLine={false} 
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      formatter={(value, name, props) => [
                        `${value} logs (Avg: ${props.payload.avg})`,
                        'Count'
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                        fontWeight: 600,
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>
                      {contextBreakdown.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.avg < 60 ? '#f59e0b' : '#f97316'} 
                          opacity={0.9}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 7-Day Stats */}
          {dailyStats.length > 0 && (
            <div className="bg-white/80 backdrop-blur-lg rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/40 p-6">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Weekly Averages
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {dailyStats.slice(-8).map((day, idx) => {
                  const dayColor = getSudsColorState(day.average || 0);
                  return (
                    <div 
                      key={idx} 
                      className={`rounded-2xl border-2 flex flex-col items-center justify-center gap-1 py-3 px-1 transition-all ${
                        day.count > 0 
                          ? `${dayColor.bg} ${dayColor.border}` 
                          : 'bg-slate-50 border-slate-100 opacity-50'
                      }`}
                    >
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        {day.label.slice(0, 3)}
                      </span>
                      {day.count > 0 ? (
                        <span className={`text-lg font-black ${dayColor.text}`}>
                          {Math.round(day.average)}
                        </span>
                      ) : (
                        <span className="text-base font-bold text-slate-300">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Insight Card */}
        <AnimatePresence>
          {insight && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50/50 border-2 border-indigo-100 rounded-3xl p-6 flex items-start gap-5 shadow-lg shadow-indigo-100/50">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-indigo-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-black text-indigo-950 text-base mb-1.5 uppercase tracking-wide">Your Patterns</h3>
                  <p className="text-sm text-indigo-900/80 leading-relaxed font-medium">
                    Your average distress is{' '}
                    <span className={`font-black ${getSudsColorState(insight.avg).text}`}>
                      {insight.avg}
                    </span>
                    {' '}({getSudsLevel(insight.avg)}). You log most often during{' '}
                    <span className="font-bold text-indigo-700 bg-indigo-100/50 px-2 py-0.5 rounded-md">"{insight.topCtx}"</span>.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-xs text-center text-slate-400 mt-10 mb-6 font-medium max-w-sm mx-auto leading-relaxed px-4">
          This tool supports your daily exposure and response prevention — it does not replace clinical care.
        </p>

      </div>
    </div>
  );
}
