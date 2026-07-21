/**
 * ResponsePreventionGoals.jsx — Production Response Prevention Goals
 *
 * Features:
 *  • SMART micro-goals with adaptive delay escalation
 *  • Streak tracking + tiered badges (Bronze / Silver / Gold / Diamond)
 *  • Success probability heuristic (time-of-day + mood + streak)
 *  • Confetti burst on milestone completions
 *  • AI-suggested goals from journal patterns
 *  • Compassionate reset — no shame, no punishment language
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Clock, RotateCcw, Plus, CheckCircle, Sparkles, ChevronUp, Zap } from "lucide-react";
import { getGoals, updateGoal, addGoal, suggestGoals } from "@/lib/ocdStore";

// ─── Divert-While-Waiting activities ──────────────────────────────────────────
// Purposeful, non-OCD-related micro-tasks. Clinically: engaging working memory
// during the delay window reduces compulsion strength without reassurance.
const DIVERT_ACTIVITIES = [
  { icon: "🌬️", text: "Take 5 slow breaths — in for 4, hold for 2, out for 6." },
  { icon: "👁️", text: "Name 5 things you can see right now, out loud or in your head." },
  { icon: "🤲", text: "Feel the texture of something near you. Describe it in detail." },
  { icon: "🎵", text: "Hum or sing the first song that pops into your head." },
  { icon: "🔢", text: "Count backwards from 100 in threes: 100, 97, 94…" },
  { icon: "🌡️", text: "Notice any sounds around you. List them from quietest to loudest." },
  { icon: "📝", text: "Think of three things that went okay today, however small." },
  { icon: "💪", text: "Squeeze your hands into fists for 5 seconds, then release. Repeat 3×." },
  { icon: "🧊", text: "Get a glass of cold water and take three slow sips." },
  { icon: "👣", text: "Feel both feet flat on the floor. Notice the weight. Press gently." },
  { icon: "🌿", text: "Think of somewhere calming you have been. Recall one detail." },
  { icon: "🎨", text: "Mentally redecorate one room in your home however you want." },
];

function StayBusyCard({ elapsed, totalSec, rotateSeed, onRotateNow }) {
  // Pick a new activity every 40s so it feels intentional, not distracting
  const idx = (Math.floor(elapsed / 40) + rotateSeed) % DIVERT_ACTIVITIES.length;
  const activity = DIVERT_ACTIVITIES[idx];
  const nextIn = 40 - (elapsed % 40);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.35 }}
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 space-y-1.5"
      >
        <div className="flex items-center gap-2">
          <Zap size={12} className="text-indigo-500 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500">
            Stay engaged while you wait
          </span>
          <span className="ml-auto text-[10px] text-indigo-300">next in {nextIn}s</span>
        </div>
        <p className="text-sm text-indigo-900 leading-snug">
          <span className="text-base mr-1.5">{activity.icon}</span>
          {activity.text}
        </p>
        <div className="flex justify-end">
          <button
            onClick={onRotateNow}
            className="rounded-md border border-indigo-300 bg-white px-2 py-1 text-[11px] text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Show another idea
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Streak is tracked internally for escalation decisions but NOT shown as
// a number — displaying streaks creates compulsive streak-checking behaviour.
const CONSISTENCY_LABELS = [
  { min: 0,  text: "Getting started",     color: "text-gray-500" },
  { min: 3,  text: "Building consistency", color: "text-teal-600" },
  { min: 7,  text: "Strong pattern",       color: "text-emerald-600" },
  { min: 14, text: "Solid foundation",     color: "text-emerald-700" },
  { min: 30, text: "Well established",     color: "text-emerald-800" },
];

function getConsistencyLabel(streak) {
  return [...CONSISTENCY_LABELS].reverse().find((t) => streak >= t.min) ?? CONSISTENCY_LABELS[0];
}

function ConfettiParticle({ i }) {
  const colors = ["#6366f1","#10b981","#f59e0b","#ec4899","#06b6d4"];
  const color = colors[i % colors.length];
  const x = (Math.random() - 0.5) * 300;
  const y = -(Math.random() * 200 + 100);
  return (
    <motion.div
      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
      animate={{ x, y, opacity: 0, scale: 0, rotate: Math.random() * 360 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      style={{ background: color, width: 8, height: 8, borderRadius: 2, position: "absolute", left: "50%", top: "50%" }}
    />
  );
}

function ConfettiBurst({ trigger }) {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    if (trigger) setParticles(Array.from({ length: 24 }, (_, i) => i));
    const t = setTimeout(() => setParticles([]), 1500);
    return () => clearTimeout(t);
  }, [trigger]);
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">{particles.map((i) => <ConfettiParticle key={`${i}-${trigger}`} i={i} />)}</div>;
}

function TimerRing({ elapsed, total }) {
  const pct = total > 0 ? Math.min(elapsed / total, 1) : 0;
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <svg width={88} height={88} className="rotate-[-90deg]">
      <circle cx={44} cy={44} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle cx={44} cy={44} r={r} fill="none" stroke="#0d9488" strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s linear" }} />
    </svg>
  );
}

function GoalCard({ goal, onSuccess, onReset, onEscalate }) {
  const [timerActive, setTimerActive] = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const [done, setDone]               = useState(false);
  const [confetti, setConfetti]       = useState(0);
  const [rotateSeed, setRotateSeed]   = useState(0);
  const intervalRef = useRef(null);
  const durationSec = goal.delayMinutes * 60;

  useEffect(() => {
    if (!timerActive) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= durationSec) { clearInterval(intervalRef.current); setTimerActive(false); setDone(true); }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [timerActive, durationSec]);

  const handleSuccess = () => { setConfetti((c) => c + 1); onSuccess(goal.id); setDone(false); setElapsed(0); };
  const handleReset   = () => { setDone(false); setElapsed(0); setTimerActive(false); setRotateSeed(0); onReset(goal.id); };
  // Consistency label — qualitative, no numbers visible to user
  const consistency = getConsistencyLabel(goal.streak);
  const escalateTarget = goal.delayMinutes + 1;

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white p-4 space-y-3 overflow-hidden">
      <ConfettiBurst trigger={confetti} />
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-800 leading-snug">{goal.title}</h4>
          {/* Show qualitative consistency label — no streak number, no % */}
          <p className={`text-[11px] mt-0.5 ${consistency.color}`}>{consistency.text}</p>
        </div>
      </div>

      {!timerActive && !done && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock size={12} />
          <span>Delay goal: <strong className="text-gray-800">{goal.delayMinutes} min</strong></span>
        </div>
      )}

      {timerActive && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <TimerRing elapsed={elapsed} total={durationSec} />
            <div>
              <p className="text-2xl font-mono font-bold text-white tabular-nums">
                {String(Math.floor((durationSec - elapsed) / 60)).padStart(2,"0")}:{String((durationSec - elapsed) % 60).padStart(2,"0")}
              </p>
              <p className="text-xs text-teal-700 mt-0.5">Stay with the discomfort. Uncertainty is tolerable.</p>
            </div>
          </div>
          <StayBusyCard
            elapsed={elapsed}
            totalSec={durationSec}
            rotateSeed={rotateSeed}
            onRotateNow={() => setRotateSeed((s) => s + 1)}
          />
        </div>
      )}

      {done && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
          <CheckCircle size={20} className="text-emerald-600 mx-auto mb-1" />
          <p className="text-sm font-semibold text-emerald-700">You resisted. That rewires your brain.</p>
          {goal.streak >= 2 && <p className="text-xs text-emerald-600 mt-1">Consider escalating to {escalateTarget} min next session.</p>}
        </motion.div>
      )}

      <div className="flex gap-2 flex-wrap">
        {!timerActive && !done && (
          <button onClick={() => setTimerActive(true)}
            className="flex items-center gap-1.5 rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors">
            <Clock size={12} /> Start Timer
          </button>
        )}
        {timerActive && (
          <button onClick={() => setTimerActive(false)}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors">
            Pause
          </button>
        )}
        {done && (
          <>
            <button onClick={handleSuccess}
              className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors">
              <Sparkles size={12} /> Mark Complete
            </button>
            {/* Escalation is optional and low-pressure — not a default CTA */}
            {goal.streak >= 3 && (
              <button onClick={() => onEscalate(goal.id, escalateTarget)}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
                Try {escalateTarget}m next time
              </button>
            )}
          </>
        )}
        <button onClick={handleReset}
          className="ml-auto flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors">
          <RotateCcw size={10} /> Reset
        </button>
      </div>
    </div>
  );
}

export default function ResponsePreventionGoals({ onGoalCompleted }) {
  const [goals, setGoals]     = useState(() => getGoals());
  const [suggestions]         = useState(() => suggestGoals());
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle]   = useState("");
  const [newDelay, setNewDelay]   = useState(3);

  const handleSuccess = useCallback((goalId) => {
    const updated = updateGoal(goalId, (g) => ({
      streak: g.streak + 1,
      successCount: g.successCount + 1,
      attemptCount: g.attemptCount + 1,
    }));
    setGoals(getGoals());
    onGoalCompleted?.({ type: "goal_success", goalId });
  }, [onGoalCompleted]);

  const handleReset = useCallback((goalId) => {
    updateGoal(goalId, (g) => ({ streak: 0, attemptCount: g.attemptCount + 1 }));
    setGoals(getGoals());
  }, []);

  const handleEscalate = useCallback((goalId, nextDelay) => {
    updateGoal(goalId, { delayMinutes: nextDelay });
    setGoals(getGoals());
  }, []);

  const handleAddGoal = () => {
    if (!newTitle.trim()) return;
    addGoal({ title: newTitle.trim(), delayMinutes: newDelay });
    setGoals(getGoals());
    setNewTitle(""); setShowAdd(false);
  };

  const handleAddSuggestion = (s) => {
    addGoal({ title: s.title, delayMinutes: s.delayMinutes });
    setGoals(getGoals());
  };

  return (
    <div className="space-y-5 pb-4">
      {/* Suggested goals from AI */}
      {suggestions.length > 0 && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-teal-600" />
            <h4 className="text-sm font-semibold text-teal-700">Suggested Goals</h4>
          </div>
          {suggestions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50 px-3 py-2">
              <div>
                <p className="text-xs text-gray-700">{s.title}</p>
                <p className="text-[10px] text-gray-400">{s.delayMinutes} min delay · from {s.source}</p>
              </div>
              <button onClick={() => handleAddSuggestion(s)}
                className="rounded-md bg-teal-100 px-2 py-1 text-xs text-teal-800 hover:bg-teal-600/60">
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active goals */}
      <div className="space-y-4">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} onSuccess={handleSuccess} onReset={handleReset} onEscalate={handleEscalate} />
        ))}
      </div>

      {/* Add goal form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div key="add-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">New Response Prevention Goal</p>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Delay checking the oven by 5 minutes"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-400" />
            <div className="space-y-1">
              <p className="text-xs text-gray-500">Delay duration: <strong className="text-white">{newDelay} min</strong></p>
              <input type="range" min={1} max={60} value={newDelay} onChange={(e) => setNewDelay(Number(e.target.value))}
                className="w-full accent-teal-500" />
              <p className="text-[10px] text-gray-400">Start small. You can escalate once you have a streak.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddGoal} className="flex-1 rounded-md bg-teal-600 py-2 text-sm font-semibold text-white hover:bg-teal-500">Add Goal</button>
              <button onClick={() => setShowAdd(false)} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-500 hover:text-gray-800">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showAdd && (
        <button onClick={() => setShowAdd(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors">
          <Plus size={15} /> New response prevention goal
        </button>
      )}

      <p className="text-[10px] text-gray-500 text-center leading-relaxed">
        Setbacks are part of the process. Reset without judgment — every attempt rewires the response.
      </p>
    </div>
  );
}
