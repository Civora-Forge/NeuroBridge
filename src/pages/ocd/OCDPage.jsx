/**
 * OCDPage.jsx — Premium OCD Support Hub
 *
 * A live-data dashboard that shows:
 *  • Today's streak + quick stats
 *  • 5 feature cards with live data previews
 *  • Recent activity feed
 *  • Clinical disclaimer
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield, Timer, BarChart2, Brain, TrendingDown,
  Activity, Award, Flame, BookOpen, ChevronRight,
  ShieldAlert, Zap,
} from "lucide-react";
import {
  getSessions, getStreakStats, getMilestones,
  getResistanceStats, getSudsReadings, getJournalEntries,
  buildWeeklyInsight, checkAndEarnMilestones,
} from "@/support/specialized/ocdStore";

// ─── Feature cards config ─────────────────────────────────────────────────────
const FEATURES = [
  {
    to:      "/ocd/exposure-tracker",
    icon:    Shield,
    title:   "ERP Session Studio",
    desc:    "Run timed exposure sessions with live urge-wave visualization and habituation tracking.",
    color:   "teal",
    gradient:"from-teal-500 to-emerald-500",
    badge:   "ERP",
  },
  {
    to:      "/ocd/exposure-hierarchy",
    icon:    Brain,
    title:   "Hierarchy Builder",
    desc:    "Build your fear ladder with SUDS ratings, mastery tracking, and OCD subtype classification.",
    color:   "violet",
    gradient:"from-violet-500 to-purple-500",
    badge:   "Build",
  },
  {
    to:      "/ocd/suds-monitor",
    icon:    Activity,
    title:   "SUDS Monitor",
    desc:    "Log anxiety readings with context tags, track trends, and detect anxiety spikes.",
    color:   "amber",
    gradient:"from-amber-500 to-orange-500",
    badge:   "Live",
  },
  {
    to:      "/ocd/exposure-session",
    icon:    Timer,
    title:   "Delay Coach",
    desc:    "Practice compulsion delays with guided activities, ACT techniques, and outcome logging.",
    color:   "sky",
    gradient:"from-sky-500 to-cyan-500",
    badge:   "Practice",
  },
  {
    to:      "/ocd/progress",
    icon:    TrendingDown,
    title:   "Progress Dashboard",
    desc:    "View habituation curves, milestone badges, activity calendar, and generate therapist reports.",
    color:   "emerald",
    gradient:"from-emerald-500 to-teal-500",
    badge:   "Insights",
  },
];

const COLOR_CLASSES = {
  teal:    { ring: "ring-teal-200",    bg: "bg-teal-50",    icon: "text-teal-600",    hover: "hover:shadow-teal-100" },
  violet:  { ring: "ring-violet-200",  bg: "bg-violet-50",  icon: "text-violet-600",  hover: "hover:shadow-violet-100" },
  amber:   { ring: "ring-amber-200",   bg: "bg-amber-50",   icon: "text-amber-600",   hover: "hover:shadow-amber-100" },
  sky:     { ring: "ring-sky-200",     bg: "bg-sky-50",     icon: "text-sky-600",     hover: "hover:shadow-sky-100" },
  emerald: { ring: "ring-emerald-200", bg: "bg-emerald-50", icon: "text-emerald-600", hover: "hover:shadow-emerald-100" },
};

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color = "teal", sub }) {
  const cls = COLOR_CLASSES[color];
  return (
    <div className={`rounded-xl border bg-white px-4 py-3 flex items-center gap-3 shadow-sm ring-1 ${cls.ring}`}>
      <div className={`w-9 h-9 rounded-lg ${cls.bg} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={cls.icon} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-none">{label}</p>
        {sub && <p className="text-[10px] text-gray-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ feature, index, liveData }) {
  const cls = COLOR_CLASSES[feature.color];
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
    >
      <Link
        to={feature.to}
        className={`group relative block bg-white rounded-2xl border border-gray-200 p-5 shadow-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${cls.hover}`}
      >
        {/* Glow blob */}
        <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 bg-gradient-to-br ${feature.gradient} blur-2xl group-hover:opacity-20 transition-opacity duration-500`} />

        <div className="flex items-start justify-between gap-3 relative">
          <div className={`w-11 h-11 rounded-xl ${cls.bg} flex items-center justify-center shrink-0 ring-1 ${cls.ring}`}>
            <Icon size={20} className={cls.icon} />
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${cls.bg} ${cls.icon} ring-1 ${cls.ring}`}>
            {feature.badge}
          </span>
        </div>

        <div className="mt-3 relative">
          <h3 className={`font-bold text-gray-900 group-hover:${cls.icon} transition-colors`}>
            {feature.title}
          </h3>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{feature.desc}</p>
        </div>

        {/* Live data preview */}
        {liveData && (
          <p className={`mt-2.5 text-[11px] font-semibold ${cls.icon} flex items-center gap-1`}>
            <Zap size={10} /> {liveData}
          </p>
        )}

        <div className={`mt-3 flex items-center gap-1 text-xs font-semibold ${cls.icon}`}>
          Open <ChevronRight size={13} />
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OCDPage() {
  const sessions    = useMemo(() => getSessions(), []);
  const sudsReadings= useMemo(() => getSudsReadings(), []);
  const entries     = useMemo(() => getJournalEntries(), []);
  const milestones  = useMemo(() => { checkAndEarnMilestones(); return getMilestones(); }, []);
  const streaks     = useMemo(() => getStreakStats(), []);
  const resistance  = useMemo(() => getResistanceStats(30), []);
  const insight     = useMemo(() => buildWeeklyInsight(), []);

  const avgDrop = useMemo(() => {
    const valid = sessions.filter((s) => s.preSuds != null && s.postSuds != null);
    if (!valid.length) return null;
    return Math.round(valid.reduce((a, s) => a + (s.preSuds - s.postSuds), 0) / valid.length);
  }, [sessions]);

  // Live data previews for feature cards
  const livePreviews = useMemo(() => ({
    "/ocd/exposure-tracker": sessions.length > 0 ? `${sessions.length} session${sessions.length > 1 ? "s" : ""} logged` : "Start your first session",
    "/ocd/exposure-hierarchy": (() => { const h = getSessions(); return `${h.length} exposures tracked`; })(),
    "/ocd/suds-monitor": sudsReadings.length > 0 ? `${sudsReadings.length} readings logged` : "Log your first reading",
    "/ocd/exposure-session": resistance.total > 0 ? `${resistance.resistedPct}% resistance rate` : "Track compulsion delays",
    "/ocd/progress": milestones.length > 0 ? `${milestones.length}/7 milestone${milestones.length > 1 ? "s" : ""} earned` : "Track your milestones",
  }), [sessions, sudsReadings, resistance, milestones]);

  // Recent activity: merge sessions + entries, take last 5
  const recentActivity = useMemo(() => {
    const items = [
      ...sessions.slice(0, 5).map((s) => ({
        type: "erp",
        label: `ERP: ${s.title || "Exposure session"}`,
        sub: s.preSuds != null && s.postSuds != null ? `SUDS ${s.preSuds} → ${s.postSuds}` : "Session completed",
        ts: s.createdAt,
        icon: "🎯",
      })),
      ...sudsReadings.slice(0, 3).map((r) => ({
        type: "suds",
        label: `SUDS check-in: ${r.value}`,
        sub: r.contextTag || "Anxiety reading",
        ts: r.ts,
        icon: "📊",
      })),
      ...entries.slice(0, 3).map((e) => ({
        type: "journal",
        label: `Journal: ${e.subtype || "Thought logged"}`,
        sub: e.body?.slice(0, 50) || "",
        ts: e.createdAt,
        icon: "📝",
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
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const isEmpty = sessions.length === 0 && entries.length === 0 && sudsReadings.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/20 to-emerald-50/20">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">

        {/* ── Header ── */}
        <div>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900">OCD Support Hub</h1>
              <p className="text-sm text-gray-500 mt-0.5">ERP-aligned tools for managing compulsions and intrusive thoughts</p>
            </div>
          </motion.div>
        </div>

        {/* ── Stats Row ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <StatCard
            label="Active Streak"
            value={streaks.current > 0 ? `${streaks.current}d` : "—"}
            icon={Flame}
            color="amber"
            sub={streaks.longest > 0 ? `Best: ${streaks.longest}d` : "Start today"}
          />
          <StatCard
            label="ERP Sessions"
            value={sessions.length}
            icon={Shield}
            color="teal"
            sub={avgDrop != null ? `Avg drop: ${avgDrop} pts` : "No sessions yet"}
          />
          <StatCard
            label="Resistance Rate"
            value={resistance.total > 0 ? `${resistance.resistedPct}%` : "—"}
            icon={Award}
            color="emerald"
            sub={resistance.total > 0 ? `${resistance.total} attempts` : "Log first delay"}
          />
          <StatCard
            label="Milestones"
            value={`${milestones.length}/7`}
            icon={BookOpen}
            color="violet"
            sub={milestones.length > 0 ? `Latest: ${milestones[milestones.length - 1]?.icon}` : "None yet"}
          />
        </motion.div>

        {/* ── Weekly Insight ── */}
        {!isEmpty && insight.narratives.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 flex items-start gap-3">
            <Zap size={14} className="text-teal-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              {insight.narratives.map((n, i) => (
                <p key={i} className="text-xs text-gray-700 leading-relaxed">{n}</p>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Feature Grid ── */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">Your Tools</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.to} feature={f} index={i} liveData={livePreviews[f.to]} />
            ))}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        {recentActivity.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">Recent Activity</p>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 overflow-hidden">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-base">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.label}</p>
                    {a.sub && <p className="text-xs text-gray-400 truncate">{a.sub}</p>}
                  </div>
                  <span className="text-[11px] text-gray-300 shrink-0">{timeAgo(a.ts)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {isEmpty && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="rounded-xl border border-dashed border-teal-300 bg-teal-50/30 py-12 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center">
              <Shield size={28} className="text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">Ready to start your ERP journey</p>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">
                Choose any tool above to begin. We recommend starting with the ERP Session Studio.
              </p>
            </div>
            <Link
              to="/ocd/exposure-tracker"
              className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 transition-colors"
            >
              Start ERP Session →
            </Link>
          </motion.div>
        )}

        {/* ── Clinical disclaimer ── */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <ShieldAlert size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            These tools support ERP practice between therapy sessions. They do not replace clinical care.
            If you are in distress, contact your therapist or a crisis line.
          </p>
        </div>

      </div>
    </div>
  );
}
