/**
 * ThoughtTriggerJournal.jsx — Production Thought & Trigger Journal
 *
 * Features:
 *  • 5 Quick-Log buttons (Obsession, Compulsion Urge, Trigger, Mood, Urgency)
 *  • On-device AI subtype inference (keyword rules)
 *  • Urgency level: Low / Medium / High
 *  • Weekly insight summary
 *  • Search & filter by entry type
 *  • Entry list with timestamps and inferred subtype
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, BookOpen, Zap, AlertCircle, Smile, Flame, Plus, X, TrendingUp, Info, Wind, Waves, ArrowRight } from "lucide-react";
import { getJournalEntries, addJournalEntry, inferSubtype, buildWeeklyInsight } from "@/lib/ocdStore";
import ACTSOSModal from "./ACTSOSModal";

const ENTRY_TYPES = [
  { key: "obsession",       label: "Obsession",       icon: "🔴", color: "bg-red-900/40 border-red-200 text-red-700" },
  { key: "compulsion_urge", label: "Compulsion Urge",  icon: "🟡", color: "bg-yellow-50 border-yellow-300 text-yellow-300" },
  { key: "trigger",         label: "Trigger",          icon: "⚡", color: "bg-orange-900/40 border-orange-700/50 text-orange-600" },
  { key: "mood",            label: "Mood",             icon: "😐", color: "bg-blue-50 border-blue-700/50 text-blue-300" },
  { key: "urgency",         label: "Urgency Peak",     icon: "🔥", color: "bg-rose-50 border-rose-200 text-rose-700" },
];

const URGENCY_OPTS = ["Low", "Medium", "High"];
const URGENCY_COLOR = { Low: "text-emerald-600", Medium: "text-amber-600", High: "text-red-400" };

function QuickLogButton({ type, onSelect, active }) {
  return (
    <button
      onClick={() => onSelect(type.key)}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
        active ? type.color + " ring-1 ring-white/20" : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
      }`}
    >
      <span>{type.icon}</span> {type.label}
    </button>
  );
}

function WeeklyInsightPanel({ insight }) {
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp size={14} className="text-teal-600" />
        <h4 className="text-sm font-semibold text-teal-700">This Week</h4>
      </div>
      {insight.narratives.map((n, i) => (
        <p key={i} className="text-xs text-gray-700 leading-relaxed">{n}</p>
      ))}
      {insight.peakHour && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
          <Info size={11} /> High-frequency window: {insight.peakHour}
        </div>
      )}
    </div>
  );
}

// ─── Act-Now panel shown after high-urgency / obsession entries ──────────────
function ActNowPanel({ onDismiss, onNavigateTo }) {
  const [actSosOpen, setActSosOpen] = useState(false);
  const [breathing, setBreathing]   = useState(false);
  const [breathStep, setBreathStep] = useState(0);

  // 3-cycle 4-7-8 guidance (inline, no navigation needed)
  const BREATH_STEPS = [
    "Inhale slowly for 4...", "Inhale slowly for 4...", "Inhale slowly for 4...", "Inhale slowly for 4...",
    "Hold for 7...", "Hold for 7...", "Hold for 7...", "Hold for 7...", "Hold for 7...", "Hold for 7...", "Hold for 7...",
    "Exhale for 8...", "Exhale for 8...", "Exhale for 8...", "Exhale for 8...", "Exhale for 8...", "Exhale for 8...", "Exhale for 8...", "Exhale for 8...",
  ];

  const startBreathing = () => {
    setBreathing(true);
    setBreathStep(0);
    let step = 0;
    const tick = setInterval(() => {
      step++;
      if (step >= BREATH_STEPS.length) { clearInterval(tick); setBreathing(false); }
      else setBreathStep(step);
    }, 1000);
  };

  return (
    <>
      <ACTSOSModal open={actSosOpen} onClose={() => setActSosOpen(false)} />
      <motion.div
        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-rose-700">High urgency logged — act now</p>
          <button onClick={onDismiss} className="text-rose-400 hover:text-rose-600"><X size={14} /></button>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          The urge is peaking. The fastest way to ride it out is to engage your body or mind — not the compulsion.
        </p>

        {!breathing ? (
          <div className="flex flex-wrap gap-2">
            <button onClick={startBreathing}
              className="flex items-center gap-1.5 rounded-lg bg-sky-100 border border-sky-200 px-3 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-200 transition-colors">
              <Wind size={12} /> 4-7-8 Breath (19s)
            </button>
            <button onClick={() => setActSosOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-100 border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-200 transition-colors">
              🧠 ACT Defusion
            </button>
            {onNavigateTo && (
              <button onClick={() => onNavigateTo("mindful")}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-100 border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-200 transition-colors">
                <Waves size={12} /> Urge Surfing <ArrowRight size={10} />
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={breathStep}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center rounded-lg bg-sky-100 border border-sky-200 py-3 text-sm font-semibold text-sky-800">
              {BREATH_STEPS[breathStep]}
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>
    </>
  );
}

export default function ThoughtTriggerJournal({ onEntryAdded, onNavigateTo }) {
  const [entries, setEntries] = useState(() => getJournalEntries());
  const [showForm, setShowForm]       = useState(false);
  const [entryType, setEntryType]     = useState("obsession");
  const [bodyText, setBodyText]       = useState("");
  const [urgency, setUrgency]         = useState("Medium");
  const [moodScore, setMoodScore]     = useState(3);
  const [filterType, setFilterType]   = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showActNow, setShowActNow]   = useState(false);

  const insight = useMemo(() => buildWeeklyInsight(), [entries]);

  const handleSubmit = () => {
    if (!bodyText.trim()) return;
    const subtype = inferSubtype(bodyText);
    const entry = addJournalEntry({ type: entryType, body: bodyText.trim(), urgency, moodScore, subtype });
    setEntries(getJournalEntries());
    // Show act-now panel for high-urgency obsessions & urgency peaks
    if (urgency === "High" || entryType === "urgency" || entryType === "obsession") {
      setShowActNow(true);
    }
    setBodyText(""); setShowForm(false);
    onEntryAdded?.({ type: "journal", subtype, urgency });
  };

  const filtered = useMemo(() => {
    let list = filterType === "all" ? entries : entries.filter((e) => e.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => e.body.toLowerCase().includes(q) || (e.subtype ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [entries, filterType, searchQuery]);

  const typeLabel = (key) => ENTRY_TYPES.find((t) => t.key === key)?.label ?? key;
  const typeColor = (key) => ENTRY_TYPES.find((t) => t.key === key)?.color ?? "";

  return (
    <div className="space-y-5 pb-4">
      <AnimatePresence>
        {showActNow && (
          <ActNowPanel onDismiss={() => setShowActNow(false)} onNavigateTo={onNavigateTo} />
        )}
      </AnimatePresence>
      {insight.entryCount > 0 && <WeeklyInsightPanel insight={insight} />}

      {/* Quick-log strip */}
      <div>
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-widest">Quick Log</p>
        <div className="flex flex-wrap gap-2">
          {ENTRY_TYPES.map((t) => (
            <QuickLogButton key={t.key} type={t} active={entryType === t.key && showForm}
              onSelect={(k) => { setEntryType(k); setShowForm(true); }} />
          ))}
        </div>
      </div>

      {/* Entry form */}
      <AnimatePresence>
        {showForm && (
          <motion.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">
                  {ENTRY_TYPES.find((t) => t.key === entryType)?.icon} Logging: {typeLabel(entryType)}
                </p>
                <button onClick={() => setShowForm(false)}><X size={14} className="text-gray-500 hover:text-gray-800" /></button>
              </div>

              <textarea
                value={bodyText} onChange={(e) => setBodyText(e.target.value)}
                placeholder={entryType === "obsession" ? "Describe the intrusive thought..." :
                  entryType === "compulsion_urge" ? "What compulsion did you feel urge to do?" :
                  entryType === "trigger" ? "What triggered this response?" :
                  entryType === "mood" ? "How are you feeling right now?" :
                  "Describe the urgency peak..."}
                rows={3}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400 resize-none" />

              {bodyText.length > 5 && (
                <p className="text-xs text-teal-600 flex items-center gap-1">
                  <Zap size={11} /> Possible subtype: <strong>{inferSubtype(bodyText)}</strong>
                </p>
              )}

              <div className="flex gap-4 items-center">
                <div className="flex gap-1">
                  {URGENCY_OPTS.map((u) => (
                    <button key={u} onClick={() => setUrgency(u)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-all ${
                        urgency === u ? "border-teal-400 bg-teal-50 text-teal-700" : "border-gray-300 text-gray-500 hover:bg-gray-100"
                      }`}>
                      {u}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Smile size={13} className="text-gray-500" />
                  {[1,2,3,4,5].map((v) => (
                    <button key={v} onClick={() => setMoodScore(v)}
                      className={`h-5 w-5 rounded-full text-xs font-bold transition-all ${
                        moodScore >= v ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-500"
                      }`}>{v}</button>
                  ))}
                </div>
              </div>

              <button onClick={handleSubmit}
                className="w-full rounded-lg bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-500 transition-colors">
                Save Entry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries..."
            className="w-full rounded-md border border-gray-300 bg-gray-50 pl-8 pr-3 py-2 text-sm text-gray-800 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400" />
        </div>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="rounded-md border border-gray-300 bg-gray-50 px-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400">
          <option value="all">All types</option>
          {ENTRY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {/* Entry list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-10 text-gray-400 text-sm gap-2">
            <BookOpen size={24} />
            <p>{entries.length === 0 ? "No entries yet. Use Quick Log above." : "No results match your filter."}</p>
          </div>
        )}
        {filtered.map((e) => (
          <motion.div key={e.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${typeColor(e.type)}`}>
                    {ENTRY_TYPES.find((t) => t.key === e.type)?.icon} {typeLabel(e.type)}
                  </span>
                  {e.subtype && (
                    <span className="rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[10px] text-teal-600">
                      {e.subtype}
                    </span>
                  )}
                  <span className={`text-[10px] font-medium ${URGENCY_COLOR[e.urgency] ?? "text-gray-500"}`}>
                    {e.urgency}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{e.body}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400">{new Date(e.createdAt).toLocaleDateString()}</p>
                <p className="text-[10px] text-gray-400">{new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                <div className="flex justify-end gap-0.5 mt-0.5">
                  {[1,2,3,4,5].map((v) => (
                    <div key={v} className={`h-1.5 w-1.5 rounded-full ${e.moodScore >= v ? "bg-teal-500" : "bg-gray-100"}`} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
          <Plus size={15} /> Add journal entry
        </button>
      )}
    </div>
  );
}
