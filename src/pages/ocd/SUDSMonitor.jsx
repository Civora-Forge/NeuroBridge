import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Activity, Info, X, TrendingUp, 
  Check, AlertTriangle, BarChart2, ShieldAlert
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

const getSudsLevel = (val) => {
  if (val < 30) return 'None / Low';
  if (val < 60) return 'Mild';
  if (val < 80) return 'Moderate';
  if (val < 90) return 'High';
  return 'Extreme';
};

const getSudsColorState = (val) => {
  if (val < 30) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', fill: '#059669' };
  if (val < 60) return { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', fill: '#d97706' };
  if (val < 80) return { text: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', fill: '#f97316' };
  return { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', fill: '#e11d48' };
};

const CustomDot = (props) => {
  const { cx, cy, value } = props;
  const color = getSudsColorState(value).fill;
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1.5} />;
};

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

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogReading = async () => {
    if (isLogging) return;
    setIsLogging(true);
    
    addSudsReading({
      level: currentSuds,
      context: selectedTag,
      note: note.trim()
    });
    
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
          value: r.level
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
      .map(c => ({
        ...c,
        avg: Math.round(c.sum / c.count)
      }))
      .sort((a, b) => b.count - a.count);
  }, [readings]);

  const colorState = getSudsColorState(currentSuds);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/20 pb-16">
      <div className="max-w-3xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to="/ocd" className="p-2 -ml-2 rounded-full hover:bg-slate-200/50 text-slate-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Live SUDS Monitor</h1>
              <p className="text-sm text-slate-500">Track anxiety levels in real-time</p>
            </div>
          </div>
          <Activity className="w-8 h-8 text-teal-600/50" />
        </div>

        {/* Spike Alert Banner */}
        <AnimatePresence>
          {hasSpike && (
            <motion.div
              initial={{ opacity: 0, y: -20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-4 items-start shadow-sm">
                <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-rose-800">High Anxiety Detected</h3>
                  <p className="text-sm text-rose-700 mt-1">
                    You've logged multiple high SUDS readings recently. The discomfort will pass, and the urge is not a command. Consider engaging in an ERP exercise.
                  </p>
                  <div className="flex gap-3 mt-3">
                    <button 
                      onClick={() => navigate('/ocd/exposure-session')}
                      className="text-sm font-medium bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 transition-colors"
                    >
                      Start Exposure
                    </button>
                    <button 
                      onClick={() => navigate('/ocd/exposure-tracker')}
                      className="text-sm font-medium bg-white text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      View Hierarchy
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => setHasSpike(false)}
                  className="text-rose-400 hover:text-rose-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Capture Panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8 relative overflow-hidden">
          <div className="text-center mb-8">
            <div className={`text-sm font-medium uppercase tracking-wider mb-2 ${colorState.text}`}>
              {getSudsLevel(currentSuds)}
            </div>
            <motion.div 
              key={currentSuds}
              initial={{ scale: 0.9, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-6xl font-bold tracking-tight ${colorState.text}`}
            >
              {currentSuds}
            </motion.div>
          </div>

          <div className="mb-8 px-2">
            <input
              type="range"
              min="0"
              max="100"
              value={currentSuds}
              onChange={(e) => setCurrentSuds(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
              <span>0 (Calm)</span>
              <span>50 (Moderate)</span>
              <span>100 (Extreme)</span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">Context</label>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedTag === tag 
                      ? 'bg-teal-600 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <input
              type="text"
              placeholder="What triggered this? (Optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>

          <button
            onClick={handleLogReading}
            disabled={isLogging}
            className={`w-full py-3 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2 relative overflow-hidden ${
              showSuccess ? 'bg-emerald-500' : 'bg-teal-600 hover:bg-teal-500'
            }`}
          >
            <AnimatePresence mode="wait">
              {showSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Reading Logged
                </motion.div>
              ) : (
                <motion.div
                  key="log"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  Log Reading
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Daily Stats Row */}
        {dailyStats.length > 0 && (
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              Last 7 Days
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {dailyStats.map((day, idx) => {
                const dayColor = getSudsColorState(day.average || 0);
                return (
                  <div 
                    key={idx} 
                    className={`min-w-[80px] p-3 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                      day.count > 0 ? `${dayColor.bg} ${dayColor.border}` : 'bg-white border-slate-200'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-500">{day.label}</span>
                    {day.count > 0 ? (
                      <>
                        <span className={`text-lg font-bold ${dayColor.text}`}>{Math.round(day.average)}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: Math.min(day.count, 5) }).map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-full`} style={{backgroundColor: dayColor.fill}} />
                          ))}
                        </div>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-slate-400 mt-1">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Today's Trend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Today's Trend</h3>
            {todayReadings.length >= 2 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={todayReadings} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="timeLabel" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#64748b', fontSize: '12px' }}
                      itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                    />
                    <ReferenceLine y={30} stroke="#10b981" strokeOpacity={0.2} strokeDasharray="3 3" />
                    <ReferenceLine y={60} stroke="#f97316" strokeOpacity={0.2} strokeDasharray="3 3" />
                    <ReferenceLine y={80} stroke="#e11d48" strokeOpacity={0.2} strokeDasharray="3 3" />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#94a3b8" 
                      strokeWidth={2}
                      dot={<CustomDot />}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400 bg-slate-50/50 rounded-lg border border-slate-100 border-dashed">
                Log at least 2 readings today to see your trend
              </div>
            )}
          </div>

          {/* Context Breakdown */}
          {readings.length >= 3 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                <span>Context Breakdown</span>
                <span className="text-xs font-normal text-slate-400">Last 30 Days</span>
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contextBreakdown} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" tick={{fontSize: 10}} tickLine={false} axisLine={false} width={100} />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      formatter={(value, name, props) => [
                        `${value} readings (Avg SUDS: ${props.payload.avg})`,
                        'Count'
                      ]}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {contextBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getSudsColorState(entry.avg).fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Context Breakdown</h3>
              <div className="h-48 flex items-center justify-center text-sm text-slate-400 bg-slate-50/50 rounded-lg border border-slate-100 border-dashed">
                Log more readings to see patterns
              </div>
            </div>
          )}
        </div>

        {/* Recent Readings List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-sm font-bold text-slate-800">Recent Readings</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {readings.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No readings recorded yet.
              </div>
            ) : (
              readings
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 15)
                .map((reading) => {
                  const state = getSudsColorState(reading.level);
                  const date = new Date(reading.timestamp);
                  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  
                  return (
                    <div key={reading.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${state.bg} ${state.text} ${state.border}`}>
                          {reading.level}
                        </div>
                        <div>
                          <div className="font-medium text-slate-700 text-sm">{reading.context}</div>
                          {reading.note && (
                            <div className="text-xs text-slate-500 mt-0.5 max-w-[200px] md:max-w-xs truncate">
                              "{reading.note}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-slate-600">{timeStr}</div>
                        <div className="text-xs text-slate-400">{dateStr}</div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
        
        <p className="text-xs text-center text-slate-400 mt-8 mb-4 max-w-lg mx-auto">
          This tool supports ERP between therapy sessions — it does not replace clinical care.
        </p>

      </div>
    </div>
  );
}
