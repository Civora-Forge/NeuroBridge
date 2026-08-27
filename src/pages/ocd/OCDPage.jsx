/**
 * OCDPage.jsx — Premium OCD Support Hub
 *
 * A live-data dashboard that shows:
 *  • Hero banner with mood check-in
 *  • Stats strip (streak, sessions, resistance, milestones)
 *  • Weekly insight panel
 *  • 5 feature cards with live data previews
 *  • Recent activity timeline
 *  • Clinical disclaimer
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Timer, Activity, TrendingDown, Brain,
  Award, Flame, ChevronRight, ShieldAlert, Zap, Star,
} from 'lucide-react';
import {
  getSessions, getStreakStats, getMilestones,
  getResistanceStats, getSudsReadings, getJournalEntries,
  buildWeeklyInsight, checkAndEarnMilestones,
} from '@/support/specialized/ocdStore';

// ─── Mood options ─────────────────────────────────────────────────────────────
const MOODS = [
  { emoji: '😌', label: 'Calm' },
  { emoji: '😊', label: 'Okay' },
  { emoji: '😐', label: 'Tense' },
  { emoji: '😟', label: 'Anxious' },
  { emoji: '😰', label: 'Overwhelmed' },
];

// ─── Feature cards config ─────────────────────────────────────────────────────
const FEATURES = [
  {
    to: '/ocd/exposure-tracker',
    icon: Shield,
    title: 'ERP Session Studio',
    desc: 'Run timed exposure sessions with live urge-wave visualization.',
    gradient: 'from-indigo-500 to-violet-500',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    glowColor: 'rgba(99,102,241,0.15)',
    badge: 'ERP',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
  },
  {
    to: '/ocd/exposure-hierarchy',
    icon: Brain,
    title: 'Hierarchy Builder',
    desc: 'Build your fear ladder with SUDS ratings and mastery tracking.',
    gradient: 'from-teal-500 to-emerald-500',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    glowColor: 'rgba(20,184,166,0.15)',
    badge: 'Build',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
  },
  {
    to: '/ocd/suds-monitor',
    icon: Activity,
    title: 'SUDS Monitor',
    desc: 'Log anxiety readings with context tags and detect anxiety spikes.',
    gradient: 'from-amber-500 to-orange-500',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    glowColor: 'rgba(245,158,11,0.15)',
    badge: 'Live',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  {
    to: '/ocd/exposure-session',
    icon: Timer,
    title: 'Delay Coach',
    desc: 'Practice compulsion delays with guided activities and ACT techniques.',
    gradient: 'from-sky-500 to-cyan-500',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    glowColor: 'rgba(14,165,233,0.15)',
    badge: 'Practice',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
  },
  {
    to: '/ocd/progress',
    icon: TrendingDown,
    title: 'Progress Dashboard',
    desc: 'View habituation curves, milestones, and generate therapist reports.',
    gradient: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    glowColor: 'rgba(16,185,129,0.15)',
    badge: 'Insights',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
];

// ─── Feature Card ─────────────────────────────────────────────────────────────
function FeatureCard({ feature, index, liveData }) {
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: 'easeOut' }}
    >
      <Link
        to={feature.to}
        className="group relative block bg-white rounded-2xl border border-gray-100 p-5 shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
      >
        {/* Top gradient strip */}
        <div
          className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        />

        {/* Glow blob */}
        <div
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: feature.glowColor }}
        />

        {/* Icon row */}
        <div className="flex items-center justify-between relative">
          <div className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center`}>
            <Icon size={22} className={feature.iconColor} />
          </div>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${feature.badgeBg} ${feature.badgeText}`}
          >
            {feature.badge}
          </span>
        </div>

        {/* Text */}
        <div className="mt-3 relative">
          <h3 className={`font-bold text-gray-900 group-hover:${feature.iconColor} transition-colors`}>
            {feature.title}
          </h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{feature.desc}</p>
        </div>

        {/* Live data pill */}
        {liveData && (
          <span
            className={`inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-full ${feature.badgeBg} ${feature.badgeText} text-[11px] font-semibold`}
          >
            <Zap size={9} />
            {liveData}
          </span>
        )}

        {/* CTA */}
        <div className={`mt-3 flex items-center gap-1 text-xs font-bold ${feature.iconColor}`}>
          Open <ChevronRight size={13} />
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OCDPage() {
  // ── Mood state ───────────────────────────────────────────────────────────────
  const [selectedMood, setSelectedMood] = useState(null);

  // ── Data loading (exact same as before) ──────────────────────────────────────
  const sessions     = useMemo(() => getSessions(), []);
  const sudsReadings = useMemo(() => getSudsReadings(), []);
  const entries      = useMemo(() => getJournalEntries(), []);
  const milestones   = useMemo(() => { checkAndEarnMilestones(); return getMilestones(); }, []);
  const streaks      = useMemo(() => getStreakStats(), []);
  const resistance   = useMemo(() => getResistanceStats(30), []);
  const insight      = useMemo(() => buildWeeklyInsight(), []);

  const avgDrop = useMemo(() => {
    const valid = sessions.filter((s) => s.preSuds != null && s.postSuds != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((a, s) => a + (s.preSuds - s.postSuds), 0) / valid.length);
  }, [sessions]);

  // ── Live data previews for feature cards ─────────────────────────────────────
  const livePreviews = useMemo(() => ({
    '/ocd/exposure-tracker':   sessions.length > 0 ? `${sessions.length} session${sessions.length > 1 ? 's' : ''} logged` : 'Start your first session',
    '/ocd/exposure-hierarchy': (() => { const h = getSessions(); return `${h.length} exposures tracked`; })(),
    '/ocd/suds-monitor':       sudsReadings.length > 0 ? `${sudsReadings.length} readings logged` : 'Log your first reading',
    '/ocd/exposure-session':   resistance.total > 0 ? `${resistance.resistedPct}% resistance rate` : 'Track compulsion delays',
    '/ocd/progress':           milestones.length > 0 ? `${milestones.length}/7 milestone${milestones.length > 1 ? 's' : ''} earned` : 'Track your milestones',
  }), [sessions, sudsReadings, resistance, milestones]);

  // ── Recent activity: merge sessions + suds + journal, take last 5 ────────────
  const recentActivity = useMemo(() => {
    const items = [
      ...sessions.slice(0, 5).map((s) => ({
        type:  'erp',
        label: `ERP: ${s.title || 'Exposure session'}`,
        sub:   s.preSuds != null && s.postSuds != null ? `SUDS ${s.preSuds} → ${s.postSuds}` : 'Session completed',
        ts:    s.createdAt,
        icon:  '🎯',
      })),
      ...sudsReadings.slice(0, 3).map((r) => ({
        type:  'suds',
        label: `SUDS check-in: ${r.value}`,
        sub:   r.contextTag || 'Anxiety reading',
        ts:    r.ts,
        icon:  '📊',
      })),
      ...entries.slice(0, 3).map((e) => ({
        type:  'journal',
        label: `Journal: ${e.subtype || 'Thought logged'}`,
        sub:   e.body?.slice(0, 50) || '',
        ts:    e.createdAt,
        icon:  '📝',
      })),
    ]
      .filter((a) => a.ts)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts))
      .slice(0, 5);
    return items;
  }, [sessions, sudsReadings, entries]);

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const isEmpty = sessions.length === 0 && entries.length === 0 && sudsReadings.length === 0;

  // ── Dot color per activity type ───────────────────────────────────────────────
  const dotColor = (type) => {
    if (type === 'erp')     return 'bg-indigo-500';
    if (type === 'suds')    return 'bg-amber-500';
    if (type === 'journal') return 'bg-rose-500';
    return 'bg-gray-400';
  };
  const ringColor = (type) => {
    if (type === 'erp')     return 'ring-indigo-200';
    if (type === 'suds')    return 'ring-amber-200';
    if (type === 'journal') return 'ring-rose-200';
    return 'ring-gray-200';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">

        {/* ══ 1. HERO BANNER ══════════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 rounded-2xl p-8 md:p-10 text-white relative overflow-hidden"
        >
          {/* Decorative blobs */}
          <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white blur-3xl opacity-10 pointer-events-none" />
          <div className="absolute top-4 right-0 w-64 h-64 rounded-full bg-teal-300 blur-3xl opacity-10 pointer-events-none" />
          <div className="absolute -bottom-16 left-1/2 w-56 h-56 rounded-full bg-violet-300 blur-3xl opacity-[0.15] pointer-events-none" />

          {/* Header row */}
          <div className="relative flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                OCD Support Hub
              </h1>
              <p className="text-white/80 mt-1 text-sm md:text-base">
                ERP-aligned tools for managing OCD, one step at a time.
              </p>
            </div>
          </div>

          {/* Mood check-in */}
          <div className="relative mt-7">
            <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-3">
              How are you feeling right now?
            </p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((mood) => {
                const isSelected = selectedMood === mood.label;
                return (
                  <button
                    key={mood.label}
                    onClick={() => setSelectedMood(isSelected ? null : mood.label)}
                    className={`rounded-2xl px-3 py-2 flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      isSelected
                        ? 'bg-white text-indigo-700 scale-110 ring-2 ring-white shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <span className="text-xl leading-none">{mood.emoji}</span>
                    <span className={`text-[10px] font-bold leading-none ${isSelected ? 'text-indigo-700' : 'text-white/90'}`}>
                      {mood.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <AnimatePresence>
              {selectedMood && (
                <motion.p
                  key={selectedMood}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="mt-3 text-white/70 text-xs"
                >
                  Feeling <span className="text-white font-semibold">{selectedMood}</span> — your tools are here to help.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ══ 2. STATS STRIP ══════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Streak */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
            className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-amber-100 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-400" />
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
              <Flame size={18} className="text-amber-600" />
            </div>
            <p className="text-2xl font-black text-gray-900">
              {streaks.current > 0 ? `${streaks.current}d` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Active Streak</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {streaks.longest > 0 ? `Best: ${streaks.longest}d` : 'Start today'}
            </p>
          </motion.div>

          {/* Sessions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.35 }}
            className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-indigo-100 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
              <Shield size={18} className="text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-gray-900">{sessions.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">ERP Sessions</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {avgDrop != null ? `Avg drop: ${avgDrop} pts` : 'No sessions yet'}
            </p>
          </motion.div>

          {/* Resistance */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.20, duration: 0.35 }}
            className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-emerald-100 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <Award size={18} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-gray-900">
              {resistance.total > 0 ? `${resistance.resistedPct}%` : '—'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Resistance Rate</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {resistance.total > 0 ? `${resistance.total} attempts` : 'Log first delay'}
            </p>
          </motion.div>

          {/* Milestones */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, duration: 0.35 }}
            className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-violet-100 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-500" />
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center mb-3">
              <Star size={18} className="text-violet-600" />
            </div>
            <p className="text-2xl font-black text-gray-900">{`${milestones.length}/7`}</p>
            <p className="text-xs text-gray-500 mt-0.5">Milestones</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {milestones.length > 0 ? `Latest: ${milestones[milestones.length - 1]?.icon ?? '🏅'}` : 'None yet'}
            </p>
          </motion.div>
        </div>

        {/* ══ 3. WEEKLY INSIGHT ═══════════════════════════════════════════════ */}
        {!isEmpty && insight.narratives.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
            className="bg-white rounded-2xl p-5 shadow-sm flex gap-4 relative overflow-hidden"
          >
            {/* Left accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-l-2xl" />

            <div className="pl-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-indigo-600 shrink-0" />
                <span className="text-sm font-semibold text-indigo-700">Weekly Insight</span>
              </div>
              <div className="space-y-1.5">
                {insight.narratives.map((n, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">
                    {n}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ 4. FEATURE CARDS GRID ═══════════════════════════════════════════ */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Your Tools</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.to} feature={f} index={i} liveData={livePreviews[f.to]} />
            ))}
          </div>
        </div>

        {/* ══ 5. RECENT ACTIVITY (timeline) ═══════════════════════════════════ */}
        {recentActivity.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.35 }}
          >
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Recent Activity
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                  {/* Timeline dot */}
                  <div className={`w-2 h-2 rounded-full shrink-0 ring-2 ${dotColor(a.type)} ${ringColor(a.type)}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.label}</p>
                    {a.sub && (
                      <p className="text-xs text-gray-400 truncate">{a.sub}</p>
                    )}
                  </div>

                  {/* Time */}
                  <span className="text-[11px] text-gray-300 shrink-0">{timeAgo(a.ts)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ══ 6. EMPTY STATE ══════════════════════════════════════════════════ */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl border-2 border-dashed border-indigo-200 py-14 flex flex-col items-center gap-5 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Ready to start your ERP journey</h2>
              <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
                Choose any tool above to begin. We recommend starting with the ERP Session Studio for guided exposure practice.
              </p>
            </div>
            <Link
              to="/ocd/exposure-tracker"
              className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              Start ERP Session →
            </Link>
          </motion.div>
        )}

        {/* ══ 7. CLINICAL DISCLAIMER ══════════════════════════════════════════ */}
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <ShieldAlert size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-500 leading-relaxed">
            These tools support ERP practice between therapy sessions and do not replace clinical care.
            If you are in distress, please contact your therapist or a crisis helpline immediately.
          </p>
        </div>

      </div>
    </div>
  );
}
