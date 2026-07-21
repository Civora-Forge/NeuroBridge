/**
 * SymptomDashboard.jsx — Production Symptom Progress Dashboard
 *
 * Charts (Recharts):
 *  1. Symptom intensity trend — LineChart from ERP pre-SUDS over time
 *  2. Compulsion frequency — BarChart of journal entries by subtype
 *  3. ERP success rate — AreaChart (% sessions postSuds < 30)
 *  4. Pre vs Post SUDS comparison — BarChart per session
 *
 * AI narrative: rule-based text generator from computed stats
 * Export to PDF: placeholder with window.print() fallback
 */

import { useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingDown, TrendingUp, BarChart2, Activity, FileDown, Sparkles, Info } from "lucide-react";
import { getSessions, getJournalEntries, getMindfulRuns, buildWeeklyInsight } from "@/lib/ocdStore";

// ─── helpers ──────────────────────────────────────────────────────────────────
function shortDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function pct(n, d) { return d === 0 ? 0 : Math.round((n / d) * 100); }

const CHART_STYLE = {
  grid: "#e2e8f0",
  tick: { fontSize: 10, fill: "#64748b" },
  tooltip: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, color: "#e2e8f0" },
};

function ChartCard({ title, icon: Icon, children, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-teal-600" />
        <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
        {hint && <span className="ml-auto text-[10px] text-gray-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function StatBadge({ label, value, sub, color = "indigo" }) {
  const colors = {
    indigo: "bg-teal-50 border-teal-200 text-teal-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-300 text-amber-700",
    red: "bg-red-50 border-red-700/40 text-red-700",
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-center ${colors[color]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[11px] font-medium mt-0.5">{label}</p>
      {sub && <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── AI Narrative ─────────────────────────────────────────────────────────────
function AINarrative({ sessions, entries, runs }) {
  const insight = buildWeeklyInsight();
  const masteredCount = 0;
  const successSessions = sessions.filter((s) => s.postSuds != null && s.postSuds < 30);
  const successRate = pct(successSessions.length, sessions.length);
  const avgDrop = sessions.length > 0
    ? (sessions.filter((s) => s.preSuds != null && s.postSuds != null)
        .reduce((a, s) => a + (s.preSuds - s.postSuds), 0) / sessions.length).toFixed(1)
    : null;
  const moodLiftRuns = runs.filter((r) => r.preMood && r.postMood && r.postMood > r.preMood);

  const lines = [
    sessions.length === 0 && "No ERP sessions recorded yet. Start your first exposure to begin building data.",
    sessions.length > 0 && avgDrop !== null && `Across ${sessions.length} ERP session${sessions.length > 1 ? "s" : ""}, your anxiety dropped an average of ${avgDrop} SUDS points per session.`,
    sessions.length > 0 && successRate > 0 && `${successRate}% of sessions ended with SUDS below 30 — a clinical marker of habituation.`,
    sessions.length > 0 && successRate === 0 && sessions.length < 4 && "Still early in your ERP journey. Habituation typically becomes visible after 4–6 exposures.",
    entries.length > 0 && insight.dominantSubtype !== "Unknown" && `Journal entries most frequently relate to ${insight.dominantSubtype}.`,
    insight.peakHour && `Highest-anxiety window: ${insight.peakHour}. Consider scheduling an ERP or mindfulness session there.`,
    moodLiftRuns.length > 0 && `Mindfulness sessions improved mood ${pct(moodLiftRuns.length, runs.length)}% of the time.`,
    entries.length >= 10 && successRate < 20 && "You are tracking consistently — now channel that into more ERP sessions. Data without exposure won't reduce OCD.",
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-teal-600" />
        <h4 className="text-sm font-semibold text-teal-700">Progress Narrative</h4>
      </div>
      {lines.map((l, i) => (
        <p key={i} className="text-xs text-gray-700 leading-relaxed">{l}</p>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SymptomDashboard() {
  const sessions = useMemo(() => getSessions(), []);
  const entries  = useMemo(() => getJournalEntries(), []);
  const runs     = useMemo(() => getMindfulRuns(), []);

  // Chart 1: Symptom intensity over time (pre-SUDS)
  const intensityData = useMemo(() =>
    sessions.filter((s) => s.preSuds != null).slice(0, 20).reverse()
      .map((s, i) => ({ name: shortDate(s.createdAt), "Pre-SUDS": s.preSuds, "Post-SUDS": s.postSuds ?? undefined })),
  [sessions]);

  // Chart 2: Compulsion frequency by subtype (journal)
  const subtypeData = useMemo(() => {
    const counts = entries.reduce((a, e) => {
      const k = e.subtype ?? "Unknown";
      a[k] = (a[k] || 0) + 1;
      return a;
    }, {});
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [entries]);

  // Chart 3: ERP weekly success rate (% postSuds < 30)
  const successRateData = useMemo(() => {
    const byWeek = {};
    sessions.forEach((s) => {
      const d = new Date(s.createdAt);
      const week = `W${Math.ceil(d.getDate() / 7)}/${d.getMonth() + 1}`;
      if (!byWeek[week]) byWeek[week] = { total: 0, success: 0 };
      byWeek[week].total++;
      if (s.postSuds != null && s.postSuds < 30) byWeek[week].success++;
    });
    return Object.entries(byWeek).map(([name, v]) => ({
      name, "Success Rate": pct(v.success, v.total),
    }));
  }, [sessions]);

  // Chart 4: Pre vs Post per session
  const prePostData = useMemo(() =>
    sessions.filter((s) => s.preSuds != null && s.postSuds != null).slice(0, 10).reverse()
      .map((s, i) => ({ name: `#${i + 1}`, Pre: s.preSuds, Post: s.postSuds, drop: s.preSuds - s.postSuds })),
  [sessions]);

  // Summary stats
  const totalDrop = prePostData.reduce((a, d) => a + d.drop, 0);
  const avgDrop = prePostData.length > 0 ? (totalDrop / prePostData.length).toFixed(0) : "—";
  const successCount = sessions.filter((s) => s.postSuds != null && s.postSuds < 30).length;
  const successRate = pct(successCount, sessions.length || 1);
  const masteredCount = 0; // computed in ERPTracker, not re-computed here for perf

  const handleExport = () => {
    window.alert("PDF export coming soon. For now, use Ctrl+P → Save as PDF to capture this view.");
  };

  const isEmpty = sessions.length === 0 && entries.length === 0;

  return (
    <div className="space-y-6 pb-4">
      {/* Export button */}
      <div className="flex justify-end">
        <button onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:border-slate-500 transition-colors">
          <FileDown size={13} /> Export PDF
        </button>
      </div>

      {isEmpty && (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 flex flex-col items-center gap-3 text-gray-400">
          <Activity size={28} />
          <p className="text-sm">No data yet. Complete an ERP session or journal entry to see your dashboard.</p>
        </div>
      )}

      {/* Summary stat cards */}
      {!isEmpty && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBadge label="ERP Sessions" value={sessions.length} color="indigo" />
          <StatBadge label="Avg SUDS Drop" value={avgDrop} sub="per session" color={Number(avgDrop) > 0 ? "emerald" : "amber"} />
          <StatBadge label="Success Rate" value={`${successRate}%`} sub="postSuds < 30" color={successRate >= 50 ? "emerald" : "amber"} />
          <StatBadge label="Journal Entries" value={entries.length} color="indigo" />
        </div>
      )}

      {/* AI Narrative */}
      <AINarrative sessions={sessions} entries={entries} runs={runs} />

      {/* Chart 1: Intensity trend */}
      {intensityData.length >= 2 && (
        <ChartCard title="Symptom Intensity Trend" icon={TrendingDown} hint="Pre & Post SUDS over time">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={intensityData} margin={{ top: 5, right: 8, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="name" tick={CHART_STYLE.tick} />
              <YAxis domain={[0, 100]} tick={CHART_STYLE.tick} />
              <Tooltip contentStyle={CHART_STYLE.tooltip} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Pre-SUDS" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Post-SUDS" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 text-center">Downward Post-SUDS line indicates habituation</p>
        </ChartCard>
      )}

      {/* Chart 2: Subtype frequency */}
      {subtypeData.length > 0 && (
        <ChartCard title="Compulsion Frequency by Subtype" icon={BarChart2} hint="Last 100 journal entries">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={subtypeData} margin={{ top: 5, right: 8, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="name" tick={{ ...CHART_STYLE.tick, fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={CHART_STYLE.tick} allowDecimals={false} />
              <Tooltip contentStyle={CHART_STYLE.tooltip} />
              <Bar dataKey="count" name="Entries" radius={[4,4,0,0]}>
                {subtypeData.map((_, i) => (
                  <Cell key={i} fill={["#6366f1","#8b5cf6","#0ea5e9","#10b981","#f59e0b","#f97316"][i % 6]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Chart 3: ERP Success Rate */}
      {successRateData.length > 0 && (
        <ChartCard title="ERP Success Rate (Weekly)" icon={TrendingUp} hint="% sessions with postSuds < 30">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={successRateData} margin={{ top: 5, right: 8, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="succGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="name" tick={CHART_STYLE.tick} />
              <YAxis domain={[0, 100]} tick={CHART_STYLE.tick} unit="%" />
              <Tooltip contentStyle={CHART_STYLE.tooltip} formatter={(v) => `${v}%`} />
              <Area type="monotone" dataKey="Success Rate" stroke="#10b981" fill="url(#succGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Chart 4: Pre vs Post comparison */}
      {prePostData.length >= 2 && (
        <ChartCard title="Pre vs Post SUDS Comparison" icon={Activity} hint="Last 10 sessions">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={prePostData} margin={{ top: 5, right: 8, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="name" tick={CHART_STYLE.tick} />
              <YAxis domain={[0, 100]} tick={CHART_STYLE.tick} />
              <Tooltip contentStyle={CHART_STYLE.tooltip} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Pre" fill="#f97316" radius={[3,3,0,0]} />
              <Bar dataKey="Post" fill="#0d9488" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 text-center">
            Gap between Pre (orange) and Post (indigo) = habituation achieved
          </p>
        </ChartCard>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50/20 p-3 text-[11px] text-gray-400">
        <Info size={12} className="mt-0.5 shrink-0" />
        This dashboard is for self-monitoring only. Share with your therapist for clinical interpretation.
      </div>
    </div>
  );
}
