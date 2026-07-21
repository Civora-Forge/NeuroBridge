/**
 * MindfulnessInterruptions.jsx — Production Mindfulness Module
 *
 * Session types (ERP-aligned, no reassurance):
 *  • Urge Surfing — observe urgency without acting
 *  • Uncertainty Tolerance — sit with not-knowing
 *  • Label & Release — name the thought, let it pass
 *  • 4-7-8 Breathing — physiological regulation
 *  • Body Scan — defuse somatic anxiety
 *
 * Features:
 *  • Smart suggestion from recent journal entries
 *  • Pre/Post mood (1-5) per session
 *  • Effectiveness log per session type
 *  • Web Speech API for guided audio prompts
 *  • Animated breath/ring visuals
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Brain, Waves, Eye, Scan, Lightbulb, Play, Pause, StopCircle, Star, TrendingUp } from "lucide-react";
import { getMindfulRuns, addMindfulRun, getJournalEntries, inferSubtype } from "@/lib/ocdStore";

const SESSION_TYPES = [
  {
    key: "urge_surfing",
    label: "Urge Surfing",
    icon: Waves,
    color: "indigo",
    durationMin: 5,
    description: "Observe the urge as a wave — rising, peaking, falling. Do not act on it.",
    scripts: [
      "Notice the urge is present. You do not have to act on it.",
      "This is a wave. It has a peak. Let it rise without turning away.",
      "Your task is not to reduce the discomfort. Your task is to stay.",
      "The urge is information. It is not a command.",
      "Notice where you feel it in your body. Breathe slowly into that place.",
    ],
    subtypes: ["Contamination", "Checking", "Harm"],
  },
  {
    key: "uncertainty_tolerance",
    label: "Uncertainty Tolerance",
    icon: Brain,
    color: "violet",
    durationMin: 6,
    description: "Practise tolerating not knowing. Certainty is not required to move forward.",
    scripts: [
      "Allow the question to remain unanswered. You do not need to resolve it.",
      "Uncertainty is uncomfortable, not dangerous.",
      "Notice the urge to check, to ask, to resolve. Observe it. Don't act.",
      "What if you could carry the question without needing the answer?",
      "This feeling of incompleteness will pass. You can bear it.",
    ],
    subtypes: ["Checking", "Intrusive Thoughts", "Relationship OCD", "Health Anxiety"],
  },
  {
    key: "label_release",
    label: "Label & Release",
    icon: Eye,
    color: "sky",
    durationMin: 4,
    description: "Name the thought. Give it a label. Watch it pass like a cloud.",
    scripts: [
      "Name it: 'This is an intrusive thought.' You don't have to believe it.",
      "Thoughts are mental events. They are not facts, identities, or obligations.",
      "Label it gently — 'there is contamination anxiety' — and return to your breath.",
      "The thought came. You noticed it. Now let it continue past.",
      "You are the observer. The thought is something you notice, not something you are.",
    ],
    subtypes: ["Intrusive Thoughts", "Harm", "Religious / Scrupulosity"],
  },
  {
    key: "breathing_478",
    label: "4-7-8 Breathing",
    icon: Wind,
    color: "emerald",
    durationMin: 4,
    description: "Physiological regulation. Inhale 4s, hold 7s, exhale 8s.",
    scripts: null,
    subtypes: [],
  },
  {
    key: "body_scan",
    label: "Body Scan",
    icon: Scan,
    color: "amber",
    durationMin: 7,
    description: "Systematically release somatic tension from head to feet.",
    scripts: [
      "Start at the crown of your head. Notice. Soften.",
      "Bring awareness to your jaw, your neck, your shoulders.",
      "Move to your chest. Notice where anxiety lives here. Breathe gently.",
      "Your abdomen. Your hands. Is there tension? Invite it to loosen.",
      "Coming down through your legs to your feet. You are grounded.",
    ],
    subtypes: ["Contamination", "Symmetry / Just-Right"],
  },
];

const COLOR_MAP = {
  indigo: { ring: "#0d9488", bg: "bg-teal-50 border-teal-200", badge: "bg-teal-50 text-teal-700 border-teal-200" },
  violet: { ring: "#8b5cf6", bg: "bg-violet-50 border-violet-200", badge: "bg-violet-900/50 text-violet-700 border-violet-700/50" },
  sky:    { ring: "#0ea5e9", bg: "bg-sky-50 border-sky-200",       badge: "bg-sky-900/50 text-sky-700 border-sky-700/50" },
  emerald:{ ring: "#10b981", bg: "bg-emerald-50 border-emerald-200",badge: "bg-emerald-900/50 text-emerald-700 border-emerald-200" },
  amber:  { ring: "#f59e0b", bg: "bg-amber-50 border-amber-300",   badge: "bg-amber-900/50 text-amber-700 border-amber-700/50" },
};

function MoodPicker({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16">{label}</span>
      {[1,2,3,4,5].map((v) => (
        <button key={v} onClick={() => onChange(v)}
          className={`h-6 w-6 rounded-full text-xs font-bold transition-all ${v <= value ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
          {v}
        </button>
      ))}
    </div>
  );
}

function BreathRing({ phase, elapsed, sessionType }) {
  if (sessionType.key === "breathing_478") {
    const cycle = 19;
    const pos = elapsed % cycle;
    const bPhase = pos < 4 ? "Inhale" : pos < 11 ? "Hold" : "Exhale";
    const scale = pos < 4 ? 0.7 + (pos / 4) * 0.3 : pos < 11 ? 1.0 : 1.0 - ((pos - 11) / 8) * 0.3;
    const count = pos < 4 ? pos + 1 : pos < 11 ? pos - 3 : pos - 10;
    return (
      <div className="flex flex-col items-center gap-2">
        <motion.div animate={{ scale }} transition={{ duration: 1, ease: "easeInOut" }}
          className="h-24 w-24 rounded-full border-4 border-emerald-500/60 bg-emerald-50 flex items-center justify-center">
          <span className="text-3xl font-mono font-bold text-emerald-700">{count}</span>
        </motion.div>
        <p className="text-sm font-semibold text-emerald-700">{bPhase}</p>
      </div>
    );
  }
  const r = 38, circ = 2 * Math.PI * r;
  const total = sessionType.durationMin * 60;
  const pct = Math.min(elapsed / total, 1);
  return (
    <svg width={96} height={96}>
      <circle cx={48} cy={48} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle cx={48} cy={48} r={r} fill="none" stroke={COLOR_MAP[sessionType.color]?.ring ?? "#6366f1"} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ * pct} strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 1s linear" }} />
      <text x={48} y={53} textAnchor="middle" fill="#e2e8f0" fontSize={14} fontFamily="monospace" fontWeight="bold">
        {String(Math.floor((total - elapsed) / 60)).padStart(2,"0")}:{String((total - elapsed) % 60).padStart(2,"0")}
      </text>
    </svg>
  );
}

export default function MindfulnessInterruptions({ onSessionComplete }) {
  const [runs, setRuns]           = useState(() => getMindfulRuns());
  const [selected, setSelected]   = useState(null);
  const [phase, setPhase]         = useState("pick");
  const [elapsed, setElapsed]     = useState(0);
  const [isPaused, setIsPaused]   = useState(false);
  const [scriptIdx, setScriptIdx] = useState(0);
  const [preMood, setPreMood]     = useState(3);
  const [postMood, setPostMood]   = useState(3);
  const timerRef = useRef(null);
  const speechRef = useRef(null);

  // Smart suggestion: match dominant recent journal subtype
  const suggestion = useMemo(() => {
    const entries = getJournalEntries().slice(0, 10);
    if (!entries.length) return null;
    const subtypes = entries.map((e) => e.subtype ?? inferSubtype(e.body ?? ""));
    const counts = subtypes.reduce((a, s) => { a[s] = (a[s] || 0) + 1; return a; }, {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return SESSION_TYPES.find((t) => t.subtypes.includes(top)) ?? null;
  }, []);

  // Effectiveness by session type (avg mood lift)
  const effectiveness = useMemo(() => {
    const out = {};
    SESSION_TYPES.forEach((t) => {
      const tr = runs.filter((r) => r.sessionType === t.key && r.preMood && r.postMood);
      if (tr.length) out[t.key] = (tr.reduce((a, r) => a + (r.postMood - r.preMood), 0) / tr.length).toFixed(1);
    });
    return out;
  }, [runs]);

  useEffect(() => {
    if (phase !== "running" || isPaused) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        // Advance script card every ~30s
        if (selected?.scripts && next % 30 === 0) setScriptIdx((i) => Math.min(i + 1, (selected.scripts.length ?? 1) - 1));
        if (next % 30 === 5 && selected?.scripts) speak(selected.scripts[Math.min(Math.floor(next / 30), selected.scripts.length - 1)]);
        if (next >= selected?.durationMin * 60) { clearInterval(timerRef.current); setPhase("post"); }
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, isPaused, selected]);

  const speak = (text) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85; u.pitch = 1;
    window.speechSynthesis.speak(u);
    speechRef.current = u;
  };

  const startSession = () => { setPhase("running"); setElapsed(0); setScriptIdx(0); if (selected?.scripts?.[0]) speak(selected.scripts[0]); };

  const endSession = () => {
    clearInterval(timerRef.current);
    window.speechSynthesis?.cancel();
    setPhase("post");
  };

  const saveRun = () => {
    const run = addMindfulRun({ sessionType: selected.key, sessionLabel: selected.label, durationSec: elapsed, preMood, postMood });
    setRuns(getMindfulRuns());
    setPhase("pick");
    setSelected(null);
    setElapsed(0);
    onSessionComplete?.({ type: "mindfulness", key: selected.key, moodLift: postMood - preMood });
  };

  const selectType = (t) => { setSelected(t); setPhase("pre"); setPreMood(3); };

  return (
    <div className="space-y-5 pb-4">
      {/* Smart suggestion banner */}
      {suggestion && phase === "pick" && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex items-center gap-3">
          <Lightbulb size={15} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-700">Suggested for your recent patterns</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{suggestion.label} — {suggestion.description}</p>
          </div>
          <button onClick={() => selectType(suggestion)}
            className="shrink-0 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">
            Start
          </button>
        </motion.div>
      )}

      {/* Session grid */}
      {phase === "pick" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SESSION_TYPES.map((t) => {
            const eff = effectiveness[t.key];
            const colors = COLOR_MAP[t.color];
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => selectType(t)}
                className={`rounded-xl border p-4 text-left space-y-2 transition-all hover:scale-[1.02] ${colors.bg}`}>
                <div className="flex items-center gap-2">
                  <Icon size={16} style={{ color: colors.ring }} />
                  <span className="text-sm font-semibold text-gray-800">{t.label}</span>
                  <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] ${colors.badge}`}>{t.durationMin} min</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{t.description}</p>
                {eff !== undefined && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <TrendingUp size={10} /> avg mood lift: <span className={Number(eff) > 0 ? "text-emerald-600" : "text-gray-500"}>{Number(eff) > 0 ? "+" : ""}{eff}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Pre-mood capture */}
      {phase === "pre" && selected && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className={`rounded-xl border p-5 space-y-4 ${COLOR_MAP[selected.color]?.bg}`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: COLOR_MAP[selected.color]?.ring }}>
              {selected.label}
            </p>
            <p className="text-sm text-gray-700 mt-1">{selected.description}</p>
          </div>
          <MoodPicker value={preMood} onChange={setPreMood} label="Mood now" />
          <div className="flex gap-2">
            <button onClick={startSession} className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-colors"
              style={{ background: COLOR_MAP[selected.color]?.ring }}>
              <Play size={13} className="inline mr-1.5" />Begin
            </button>
            <button onClick={() => { setSelected(null); setPhase("pick"); }}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-500 hover:text-gray-800">
              Back
            </button>
          </div>
        </motion.div>
      )}

      {/* Running session */}
      {phase === "running" && selected && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`rounded-xl border p-5 space-y-4 ${COLOR_MAP[selected.color]?.bg}`}>
          <div className="flex justify-center">
            <BreathRing phase={phase} elapsed={elapsed} sessionType={selected} />
          </div>
          {selected.scripts && (
            <div className="space-y-2">
              <AnimatePresence mode="wait">
                <motion.div key={scriptIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="rounded-lg bg-white border border-gray-200 p-3 text-sm text-gray-700 text-center leading-relaxed italic">
                  "{selected.scripts[scriptIdx]}"
                </motion.div>
              </AnimatePresence>
              <button
                onClick={() => {
                  if (selected?.scripts?.[scriptIdx]) speak(selected.scripts[scriptIdx]);
                }}
                className="flex items-center gap-1.5 mx-auto text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
                <span>🔁</span> Replay prompt
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setIsPaused((p) => !p)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
              {isPaused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
            </button>
            <button onClick={endSession}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
              <StopCircle size={13} /> End
            </button>
          </div>
        </motion.div>
      )}

      {/* Post-session */}
      {phase === "post" && selected && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700">Session complete — {selected.label}</p>
          </div>
          <MoodPicker value={postMood} onChange={setPostMood} label="Mood now" />
          {postMood > preMood && <p className="text-xs text-emerald-600">+{postMood - preMood} mood lift. That matters.</p>}
          {postMood <= preMood && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">No mood change is also data. Keep practising.</p>
              {/* Suggest an alternative session type */}
              {(() => {
                const alt = SESSION_TYPES.find((t) => t.key !== selected?.key);
                return alt ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-amber-700">Try a different approach?</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{alt.label} — {alt.description.slice(0, 55)}…</p>
                    </div>
                    <button
                      onClick={() => { saveRun(); setTimeout(() => selectType(alt), 200); }}
                      className="shrink-0 rounded-md bg-amber-100 border border-amber-200 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-200 transition-colors">
                      Try
                    </button>
                  </div>
                ) : null;
              })()}
            </div>
          )}
          <button onClick={saveRun} className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors">
            Save & Return
          </button>
        </motion.div>
      )}

      {/* Recent runs */}
      {phase === "pick" && runs.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Recent Sessions</p>
          <div className="space-y-2">
            {runs.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
                <div>
                  <p className="text-xs font-medium text-gray-700">{r.sessionLabel}</p>
                  <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString()} · {Math.floor(r.durationSec / 60)}m</p>
                </div>
                <div className="text-xs text-right">
                  {r.preMood && r.postMood && (
                    <span className={r.postMood > r.preMood ? "text-emerald-600" : "text-gray-400"}>
                      {r.postMood > r.preMood ? `+${r.postMood - r.preMood} mood` : "no change"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
