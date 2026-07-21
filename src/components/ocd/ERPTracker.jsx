import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Play, Pause, CheckCircle, Plus, ChevronDown, ChevronRight, Award, Brain, AlertTriangle, BarChart2, Layers } from "lucide-react";
import { getHierarchy, saveHierarchy, getSessions, addSession, checkAndMarkMastery, buildErpCoachingMessage, OCD_SUBTYPES } from "@/lib/ocdStore";

const PRE_COLOR  = "#f97316";
const POST_COLOR = "#0d9488";
const CHART_TIP  = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, color: "#1e293b" };

// Micro-grounding prompts shown during active exposure.
// These keep the user present and engaged WITHOUT providing reassurance.
const GROUNDING_PROMPTS = [
  "Notice 3 things you can see right now.",
  "Feel both feet flat on the floor.",
  "What's the loudest sound in the room?",
  "The urge is just a feeling. A feeling cannot harm you.",
  "Breathe out slowly — longer than your inhale.",
  "Notice where tension lives in your body. Don't change it, just observe.",
  "This discomfort is temporary. The urge will peak and fall.",
  "Name one texture you can feel right now.",
  "You are doing something remarkable — staying when every instinct says leave.",
  "The anxiety is not information about danger. It is your nervous system learning.",
];

const WAIT_SUPPORT_ACTIONS = [
  "Let your shoulders drop for one slow exhale.",
  "Name 1 thing you can hear, 1 thing you can feel, 1 thing you can see.",
  "Unclench your jaw and relax your tongue.",
  "Press your feet into the floor for 5 seconds, then release.",
  "Say: ‘I can feel this urge and still not respond.’",
  "Move your attention to your breath for 3 cycles.",
  "Look at one object and describe its shape and color.",
  "Let your hands rest still for 10 seconds.",
];

// ─── Urge Wave Visual ─────────────────────────────────────────────────────────
// An SVG arc that shows where in the habituation curve the person currently is.
// Clinically: visualising the wave rising and falling helps the person trust they
// don't need to escape — the discomfort will peak and subside on its own.
function UrgeWave({ elapsed, totalSec }) {
  const pct = totalSec > 0 ? Math.min(elapsed / totalSec, 1) : 0;
  const W = 260, H = 60;
  // Bell-curve-ish y position: peaks at ~40% of the session
  const peak = 0.4;
  const bell = (t) => {
    const d = t - peak;
    return Math.exp(-(d * d) / (2 * 0.06));
  };
  const markerX = pct * W;
  const markerY = H - bell(pct) * (H - 8) - 4;

  // Build a smooth SVG path for the wave
  const points = Array.from({ length: 52 }, (_, i) => {
    const t = i / 51;
    return `${(t * W).toFixed(1)},${(H - bell(t) * (H - 8)).toFixed(1)}`;
  }).join(" ");

  const label = pct < 0.35 ? "Rising…" : pct < 0.55 ? "Near peak — stay" : pct < 0.85 ? "Falling ↓" : "Almost there";
  const labelColor = pct < 0.35 ? "#f97316" : pct < 0.55 ? "#dc2626" : pct < 0.85 ? "#0d9488" : "#059669";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] text-gray-400 px-0.5">
        <span>Urge wave</span>
        <span style={{ color: labelColor }} className="font-semibold">{label}</span>
      </div>
      <svg width={W} height={H + 4} className="w-full" viewBox={`0 0 ${W} ${H + 4}`}>
        {/* filled area under curve */}
        <path
          d={`M 0 ${H} ${points} ${W} ${H} Z`}
          fill="url(#wave-grad)"
          opacity={0.18}
        />
        <defs>
          <linearGradient id="wave-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* curve line */}
        <polyline points={points} fill="none" stroke="#0d9488" strokeWidth={2} strokeLinejoin="round" opacity={0.7} />
        {/* marker dot */}
        <circle cx={markerX} cy={markerY} r={5} fill={labelColor} />
        {/* baseline labels */}
        <text x={2} y={H + 3} fontSize={8} fill="#94a3b8">Start</text>
        <text x={W - 22} y={H + 3} fontSize={8} fill="#94a3b8">End</text>
      </svg>
    </div>
  );
}

// ─── Micro-grounding prompt (shown during exposure, rotates every 35s) ────────
function GroundingMicroPrompt({ elapsed }) {
  const idx = Math.floor(elapsed / 35) % GROUNDING_PROMPTS.length;
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={idx}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 0.9, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.4 }}
        className="text-center text-xs text-gray-500 italic px-2"
      >
        {GROUNDING_PROMPTS[idx]}
      </motion.p>
    </AnimatePresence>
  );
}

function WaitSupportPanel({ elapsed, isPaused }) {
  const idx = Math.floor(elapsed / 45) % WAIT_SUPPORT_ACTIONS.length;
  const activity = WAIT_SUPPORT_ACTIONS[idx];
  const rotateIn = 45 - (elapsed % 45);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${idx}-${isPaused ? "paused" : "running"}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5"
      >
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-indigo-600">
          <span>While you wait</span>
          <span className="ml-auto text-indigo-400 normal-case tracking-normal">next in {rotateIn}s</span>
        </div>
        <p className="mt-1 text-sm text-indigo-900 leading-snug">{activity}</p>
        {isPaused && (
          <p className="mt-1 text-[11px] text-indigo-700">Paused is okay. Press resume when you are ready.</p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function SudsSlider({ value, onChange, label }) {
  const color = value < 30 ? "#16a34a" : value < 60 ? "#d97706" : value < 80 ? "#f97316" : "#dc2626";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span style={{ color }} className="font-bold text-base">{value}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-teal-500 cursor-pointer" />
      <div className="flex justify-between text-[10px] text-gray-400"><span>None</span><span>Moderate</span><span>Extreme</span></div>
    </div>
  );
}

function CoachingBanner({ message }) {
  return (
    <AnimatePresence mode="wait">
      {message && (
        <motion.div key={message} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.4 }}
          className="flex items-start gap-2 rounded-lg bg-teal-50 border border-teal-200 p-3 text-sm text-teal-800">
          <Brain className="mt-0.5 shrink-0 text-teal-600" size={15} />
          <p>{message}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HierarchyItem({ item, onStart }) {
  return (
    <motion.div layout className={`flex items-center justify-between rounded-lg border px-4 py-3 ${item.mastered ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center gap-3">
        {item.mastered ? <Award size={16} className="text-emerald-600" /> : <Layers size={16} className="text-gray-400" />}
        <div>
          <p className={`text-sm font-medium ${item.mastered ? "text-emerald-700" : "text-gray-800"}`}>{item.title}</p>
          <p className="text-xs text-gray-400">SUDS target: {item.suds} · {item.durationMin} min{item.mastered && " · Mastered ✓"}</p>
        </div>
      </div>
      {!item.mastered && (
        <button onClick={() => onStart(item)} className="flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors">
          <Play size={12} /> Start
        </button>
      )}
    </motion.div>
  );
}

export default function ERPTracker({ onSessionLogged }) {
  const [hierarchy, setHierarchy]       = useState(() => getHierarchy());
  const [sessions, setSessions]         = useState(() => getSessions());
  const [expandedH, setExpandedH]       = useState(() => getHierarchy().map((h) => h.id));
  const [activeItem, setActiveItem]     = useState(null);
  const [activeHId, setActiveHId]       = useState(null);
  const [preSuds, setPreSuds]           = useState(60);
  const [phase, setPhase]               = useState("pre");
  const [elapsed, setElapsed]           = useState(0);
  const [postSuds, setPostSuds]         = useState(40);
  const [isPaused, setIsPaused]         = useState(false);
  const [coaching, setCoaching]         = useState("");
  const [justMastered, setJustMastered] = useState(false);
  const intervalRef = useRef(null);
  const [showAddH, setShowAddH]         = useState(false);
  const [newHTitle, setNewHTitle]       = useState("");
  const [newHSubtype, setNewHSubtype]   = useState(OCD_SUBTYPES[0]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemSuds, setNewItemSuds]   = useState(50);
  const [newItemDur, setNewItemDur]     = useState(5);
  const [addingToH, setAddingToH]       = useState(null);

  useEffect(() => {
    if (phase !== "running" || isPaused) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        const approxCurrent = Math.max(preSuds - Math.floor(next / 12), 20);
        if (next % 30 === 0) setCoaching(buildErpCoachingMessage(preSuds, approxCurrent, next / 60));
        if (activeItem && next >= activeItem.durationMin * 60) { clearInterval(intervalRef.current); setPhase("post"); setCoaching(""); }
        return next;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [phase, isPaused, preSuds, activeItem]);

  const handleStart = useCallback((item, hId) => {
    setActiveItem(item); setActiveHId(hId); setPreSuds(item.suds);
    setPhase("pre"); setElapsed(0); setIsPaused(false); setCoaching(""); setJustMastered(false);
  }, []);

  const beginExposure = () => {
    setPhase("running");
    setCoaching(`Starting ${activeItem.durationMin}-min exposure. Stay with whatever arises. Do not escape or seek reassurance.`);
  };

  const handleComplete = () => {
    addSession({ itemId: activeItem.id, hierarchyId: activeHId, title: activeItem.title, preSuds, postSuds, durationSec: elapsed });
    const mastered = checkAndMarkMastery(activeItem.id);
    if (mastered) setJustMastered(true);
    setSessions(getSessions()); setHierarchy(getHierarchy()); setPhase("done");
    onSessionLogged?.({ type: "erp", preSuds, postSuds, itemTitle: activeItem.title, durationSec: elapsed });
  };

  const resetSession = () => { setActiveItem(null); setActiveHId(null); setPhase("pre"); setElapsed(0); setCoaching(""); setJustMastered(false); };

  const handleAddHierarchy = () => {
    if (!newHTitle.trim()) return;
    const updated = [...hierarchy, { id: `h-${Date.now()}`, title: newHTitle.trim(), subtype: newHSubtype, items: [] }];
    saveHierarchy(updated); setHierarchy(updated); setNewHTitle(""); setShowAddH(false);
  };

  const handleAddItem = (hId) => {
    if (!newItemTitle.trim()) return;
    const updated = hierarchy.map((h) => h.id !== hId ? h : {
      ...h, items: [...h.items, { id: `i-${Date.now()}`, title: newItemTitle.trim(), suds: newItemSuds, durationMin: newItemDur, masteryCount: 0, mastered: false }].sort((a, b) => a.suds - b.suds),
    });
    saveHierarchy(updated); setHierarchy(updated); setNewItemTitle(""); setNewItemSuds(50); setNewItemDur(5); setAddingToH(null);
  };

  const chartData = sessions
    .filter((s) => s.preSuds != null && s.postSuds != null)
    .slice(0, 20).reverse()
    .map((s, i) => ({ name: `#${i + 1}`, preSuds: s.preSuds, postSuds: s.postSuds }));

  const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5 pb-4">
      <AnimatePresence>
        {activeItem && phase !== "done" && (
          <motion.div key="session-panel" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 space-y-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-teal-600">Active Exposure</p>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">{activeItem.title}</h3>
              </div>
              <button onClick={resetSession} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>

            {phase === "pre" && (
              <div className="space-y-4">
                <SudsSlider value={preSuds} onChange={setPreSuds} label="How anxious are you RIGHT NOW? (0-100)" />
                <p className="text-xs text-gray-500">Set your baseline before starting. This anchors your habituation data.</p>
                <button onClick={beginExposure} className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 transition-colors">
                  Begin Exposure ({activeItem.durationMin} min)
                </button>
              </div>
            )}

            {phase === "running" && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-5xl font-mono font-bold text-gray-900 tabular-nums">{fmt(Math.max(activeItem.durationMin * 60 - elapsed, 0))}</p>
                  <p className="text-xs text-gray-400 mt-1">remaining</p>
                </div>
                <UrgeWave elapsed={elapsed} totalSec={activeItem.durationMin * 60} />
                <GroundingMicroPrompt elapsed={elapsed} />
                <WaitSupportPanel elapsed={elapsed} isPaused={isPaused} />
                <CoachingBanner message={coaching} />
                <div className="flex gap-3">
                  <button onClick={() => setIsPaused((p) => !p)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                    {isPaused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
                  </button>
                  <button onClick={() => setPhase("post")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-teal-300 py-2 text-sm text-teal-700 hover:bg-teal-50 transition-colors">
                    <CheckCircle size={14} /> End Early
                  </button>
                </div>
              </div>
            )}

            {phase === "post" && (
              <div className="space-y-4">
                <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
                  Exposure complete. Rate your anxiety now honestly. This data builds your habituation curve.
                </div>
                <SudsSlider value={postSuds} onChange={setPostSuds} label="Post-exposure SUDS (0-100)" />
                {preSuds - postSuds >= 10 && <p className="text-xs text-emerald-600">Down {preSuds - postSuds} points. That is habituation.</p>}
                <button onClick={handleComplete} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors">
                  Log Session
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "done" && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Award size={20} className="text-emerald-600 shrink-0" />
              <div>
                {justMastered
                  ? <><p className="text-sm font-bold text-emerald-700">Item mastered!</p><p className="text-xs text-emerald-600 mt-0.5">postSuds below 30 for 3 sessions. Ready to move up the hierarchy.</p></>
                  : <><p className="text-sm font-bold text-gray-800">Session logged</p><p className="text-xs text-gray-500">SUDS: {preSuds} to {postSuds}. Keep practising this item.</p></>}
              </div>
            </div>
            <button onClick={resetSession} className="mt-3 text-xs text-teal-600 hover:text-teal-700">Return to hierarchy</button>
          </motion.div>
        )}
      </AnimatePresence>

      {chartData.length >= 2 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 size={15} className="text-teal-600" />
            <h4 className="text-sm font-semibold text-gray-800">Habituation Curve</h4>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <Tooltip contentStyle={CHART_TIP} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="preSuds" stroke={PRE_COLOR} strokeWidth={2} dot={{ r: 3 }} name="Pre-SUDS" />
              <Line type="monotone" dataKey="postSuds" stroke={POST_COLOR} strokeWidth={2} dot={{ r: 3 }} name="Post-SUDS" />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 mt-1 text-center">Narrowing gap = sustained habituation progress</p>
        </div>
      )}

      {hierarchy.map((h) => {
        const isExpanded = expandedH.includes(h.id);
        return (
          <div key={h.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedH((prev) => isExpanded ? prev.filter((x) => x !== h.id) : [...prev, h.id])}>
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                <span className="text-sm font-semibold text-gray-800">{h.title}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{h.subtype}</span>
              </div>
              <span className="text-xs text-gray-400">{h.items.filter((i) => i.mastered).length}/{h.items.length} mastered</span>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2 border-t border-gray-100">
                {h.items.length === 0 && <p className="text-xs text-gray-400 py-2">No items yet. Add exposures below, ordered low to high SUDS.</p>}
                {h.items.map((item) => <HierarchyItem key={item.id} item={item} onStart={(i) => handleStart(i, h.id)} />)}
                {addingToH === h.id ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3 mt-2">
                    <input value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="Exposure step title"
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-400" />
                    <div className="grid grid-cols-2 gap-3">
                      <SudsSlider value={newItemSuds} onChange={setNewItemSuds} label="Target SUDS" />
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Duration (min): <strong>{newItemDur}</strong></p>
                        <input type="range" min={1} max={60} value={newItemDur} onChange={(e) => setNewItemDur(Number(e.target.value))} className="w-full accent-teal-500" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAddItem(h.id)} className="flex-1 rounded-md bg-teal-600 py-1.5 text-xs font-semibold text-white hover:bg-teal-500">Add Step</button>
                      <button onClick={() => setAddingToH(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingToH(h.id)} className="mt-2 flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700">
                    <Plus size={12} /> Add exposure step
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showAddH ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
          <p className="text-sm font-semibold text-gray-800">New Exposure Hierarchy</p>
          <input value={newHTitle} onChange={(e) => setNewHTitle(e.target.value)} placeholder="e.g. Contamination Hierarchy"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-400" />
          <select value={newHSubtype} onChange={(e) => setNewHSubtype(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400">
            {OCD_SUBTYPES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleAddHierarchy} className="flex-1 rounded-md bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-500">Create</button>
            <button onClick={() => setShowAddH(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAddH(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-400 hover:border-teal-400 hover:text-teal-600 transition-colors">
          <Plus size={15} /> New exposure hierarchy
        </button>
      )}

      {sessions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-700">Session History</h4>
          </div>
          <div className="space-y-2">
            {sessions.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5">
                <div>
                  <p className="text-xs font-medium text-gray-700 truncate max-w-[180px]">{s.title}</p>
                  <p className="text-[10px] text-gray-400">{new Date(s.createdAt).toLocaleDateString()} · {Math.floor(s.durationSec / 60)}m</p>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-orange-500">Pre: {s.preSuds}</span>
                  <span className="text-teal-600">Post: {s.postSuds}</span>
                  {s.preSuds - s.postSuds >= 10 && <span className="text-emerald-600">Down {s.preSuds - s.postSuds}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
