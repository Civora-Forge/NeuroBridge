'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon, Coffee, Crosshair, Tag, Brain, CalendarDays, ClipboardList, Heart, Leaf, Play, SlidersHorizontal, Sparkles, Target } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import { useInterventionLifecycle } from '@/support/execution';
import { buildFocusSessionOutcome, completionRatio, validateFocusSessionConfiguration } from '@/support/modules/focusSession/focusSessionService';
import { FOCUS_SESSION_MODULE_ID } from '@/support/modules/focusSession/focusSessionTypes';
import { getSupportEvidenceAsync } from '@/support/evidence';
import { recommendFocusConfiguration } from '@backend/adaptive/reasoning/focusConfiguration';

const PRESETS = [
  { label: '15 min Sprint', minutes: 15, eyebrow: 'Quick', detail: 'Sprint' },
  { label: '25 min Classic', minutes: 25, eyebrow: 'Standard', detail: 'Classic' },
  { label: '45 min Deep Dive', minutes: 45, eyebrow: 'Extended', detail: 'Deep Dive' },
];

const MODES = [
  { id: 'focus', label: 'Focus', icon: Sun },
  { id: 'shortBreak', label: 'Short break', icon: Coffee },
  { id: 'longBreak', label: 'Long break', icon: Moon },
];

const DEFAULT_MODE_MINUTES = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
};

const BREAK_TIPS = [
  'Stretch your arms and legs.',
  'Drink some water.',
  'Look at something 20 feet away for 20 seconds.',
  'Take five deep breaths.',
  'Walk around for a minute.',
];

const BrainMascot = () => <img src="/focus-mascot.svg" alt="Calm brain wearing green headphones" className="h-28 w-36 object-contain" />;

// helpers
const todayKey = () => new Date().toISOString().slice(0, 10);

const loadStreakData = () => {
  if (typeof window === 'undefined') return { streak: 0, lastDay: null, weeklyMinutes: 0 };
  try {
    const raw = window.localStorage.getItem('focusforge-streak');
    if (!raw) return { streak: 0, lastDay: null, weeklyMinutes: 0 };
    return JSON.parse(raw);
  } catch {
    return { streak: 0, lastDay: null, weeklyMinutes: 0 };
  }
};

const saveStreakData = (data) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('focusforge-streak', JSON.stringify(data));
  } catch {}
};

// circular progress
const CircularProgress = ({ progress, children }) => {
  const size = 225;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute -rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#D8E6CE"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#6D9F46"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        {children}
      </div>
    </div>
  );
};

const ModeSelector = ({ mode, setMode, setFocusMinutes, setSecondsLeft }) => {
  const handleModeChange = (id) => {
    setMode(id);
    const mins = DEFAULT_MODE_MINUTES[id] ?? 25;
    setFocusMinutes(mins);
    setSecondsLeft(mins * 60);
  };

  return (
    <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[#dce8d5] bg-white p-1 shadow-sm">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => handleModeChange(m.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all ${
              active
                ? 'bg-[#438f48] text-white shadow-sm'
                 : 'text-stone-600 hover:bg-[#edf6e9] hover:text-[#29451E]'
            }`}
          >
            <Icon size={14} />
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const PresetSelector = ({ selected, onSelect }) => (
  <div className="space-y-3">
    <p className="text-[11px] uppercase tracking-[0.16em] text-[#438f48] font-black">
      Session length
    </p>
    <div className="flex gap-2 flex-wrap">
      {PRESETS.map((p) => {
        const isSelected = selected === p.minutes;
        return (
          <button
            key={p.minutes}
            onClick={() => onSelect(p.minutes)}
              className={`min-w-[150px] px-3 py-3 rounded-xl text-xs font-semibold border transition-all ${
              isSelected
                 ? 'border-[#438f48] bg-[#eff9eb] text-[#29451E] shadow-[2px_2px_0_#D8E6CE]'
                  : 'border-[#e6e9e2] bg-white hover:border-[#438f48] hover:bg-[#eff9eb]'
            }`}
          >
            <span className="block text-[11px] font-black">{p.eyebrow} {p.minutes} min</span><span className="mt-1 block text-[10px] font-medium text-slate-600">{p.detail}</span>
          </button>
        );
      })}
    </div>
  </div>
);

const TaskInput = ({ intent, setIntent, tag, setTag, isActive }) => (
  <section className="space-y-3 rounded-2xl border border-[#dce8d5] bg-white p-5 shadow-[0_4px_12px_rgba(54,92,49,.10)]">
    <div>
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#438f48]"><ClipboardList size={17} /> Session details</p>
      <p className="mt-1 text-xs text-slate-500">Name the one thing this block is for.</p>
    </div>
    <div className="w-full space-y-2">
    <div className="relative">
       <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#6D9F46]">
        <Crosshair size={18} />
      </div>
      <input
        type="text"
        placeholder="Block intent (e.g. Read chapter 3)"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        disabled={isActive}
        className="h-10 w-full rounded-lg border border-[#e4e5df] bg-white pl-11 pr-4 text-sm font-medium text-stone-900 outline-none placeholder:text-stone-400 focus:border-[#438f48] focus:ring-4 focus:ring-[#D8E6CE] disabled:opacity-60"
      />
    </div>

    <div className="relative">
       <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#6D9F46]">
        <Tag size={18} />
      </div>
      <input
        type="text"
        placeholder="Tag (Study, Writing, Deep work...)"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        disabled={isActive}
        className="h-10 w-full rounded-lg border border-[#e4e5df] bg-white pl-11 pr-4 text-sm font-medium text-stone-900 outline-none placeholder:text-stone-400 focus:border-[#438f48] focus:ring-4 focus:ring-[#D8E6CE] disabled:opacity-60"
      />
    </div>
    </div>
  </section>
);

const MicroGoals = ({ goals, setGoals }) => {
  const toggleGoal = (index) => {
    setGoals((prev) =>
      prev.map((g, i) => (i === index ? { ...g, done: !g.done } : g)),
    );
  };

  const completedCount = goals.filter((g) => g.done).length;

  return (
   <div className="relative space-y-2 rounded-2xl border border-[#cbb8ff] bg-[#fcf8ff] p-4 shadow-[0_4px_10px_rgba(105,70,180,.14)]">
       <div className="flex items-center justify-between">
         <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#8057e8] font-black"><Crosshair size={17} /> Micro-goals</p>
         <span className="rounded-full border border-[#dfd2ff] bg-[#f4efff] px-2.5 py-1 text-[11px] font-black text-[#8057e8]">
          {completedCount}/{goals.length}
        </span>
      </div>
      <ul className="space-y-2">
        {goals.map((g, idx) => (
          <li key={idx} className="flex items-center gap-3 text-xs text-slate-800">
            <button
              onClick={() => toggleGoal(idx)}
             className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
               g.done
                     ? 'border-[#8057e8] bg-[#8057e8]'
                     : 'border-[#cbb9ff] bg-white hover:border-[#8057e8]'
              }`}
            >
              {g.done && <span className="w-2.5 h-2.5 rounded-[6px] bg-white" />}
            </button>
            <span className={g.done ? 'line-through text-slate-400' : ''}>
              {g.label}
            </span>
          </li>
        ))}
       </ul><img src="/focus-target.svg" alt="Target with an arrow" className="absolute bottom-4 right-4 h-14 w-14" />
     </div>
  );
};

const StatsRow = ({ sessions, totalMinutes, streak, weeklyMinutes }) => (
  <div className="flex items-center justify-between rounded-2xl border border-[#bfdbff] bg-[#f8fbff] p-4 shadow-[0_4px_10px_rgba(66,112,190,.12)]"><div><p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#3778e9] font-black"><CalendarDays size={16} /> Today</p><p className="mt-1 text-sm font-bold text-slate-800">{sessions} session{sessions === 1 ? '' : 's'} | {totalMinutes} min</p><p className="mt-1 text-xs text-slate-500">Streak {streak} days | Week {weeklyMinutes} min</p></div><div className="grid h-14 w-14 place-items-center rounded-full border-[6px] border-[#bdd8ff] text-sm font-black text-slate-800">0%</div></div>
);

const CelebrationBanner = ({ onStartBreak, onSkip, intent, focusMinutes }) => (
   <div className="space-y-3 rounded-2xl border border-[#6D9F46] bg-[#E2EDDA] p-4 shadow-[3px_3px_0_#D8E6CE]">
    <p className="text-sm font-semibold text-slate-900">Block complete</p>
    <p className="text-xs text-slate-600">
      You protected {focusMinutes} minutes.
      {intent ? ` "${intent}" moved forward.` : ''}
    </p>
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onStartBreak}
          className="rounded-xl bg-[#6D9F46] px-4 py-2 text-xs font-black text-[#18300F] shadow-[2px_2px_0_#D8E6CE] transition-colors hover:bg-[#557D37]"
      >
        Take 5-min break
      </button>
      <button
        onClick={onSkip}
          className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
      >
        Start next block
      </button>
    </div>
  </div>
);

const FocusCues = () => (
  <section className="relative rounded-2xl border border-[#bde6ac] bg-gradient-to-br from-[#f8fff4] to-[#e8f8e0] p-4 shadow-[0_4px_10px_rgba(54,110,44,.12)]">
    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#438f48]"><ClipboardList size={16} /> A simple plan</p>
    <ol className="mt-3 space-y-2 text-sm text-slate-700">
       <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6D9F46] text-[11px] font-black text-[#18300F]">1</span><span>Choose one small, specific outcome.</span></li>
       <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6D9F46] text-[11px] font-black text-[#18300F]">2</span><span>Work until the timer asks you to stop.</span></li>
       <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#6D9F46] text-[11px] font-black text-[#18300F]">3</span><span>End the block without deciding the next thing yet.</span></li>
    </ol><span className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border-4 border-[#69a95e] text-xl text-[#4c9e50]">✓</span>
  </section>
);

const BreakMode = ({ secondsLeft, tip, onEnd }) => {
  const m = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const s = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <div className="space-y-2 rounded-3xl border border-[#6D9F46] bg-[#E2EDDA] p-4 shadow-[4px_4px_0_#D8E6CE]">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#29451E]">
        Break
      </p>
      <div className="text-3xl font-semibold text-slate-900">
        {m}:{s}
      </div>
      <p className="text-xs text-slate-600">{tip}</p>
      <button
        onClick={onEnd}
        className="mt-1 rounded-2xl bg-[#6D9F46] px-4 py-2 text-xs font-black text-[#18300F] shadow-[2px_2px_0_#D8E6CE] transition-colors hover:bg-[#557D37]"
      >
        Back to focus
      </button>
    </div>
  );
};

const FocusSessions = () => {
  const location = useLocation();
  const aiData = location.state || null;
  const navigationConfiguration = aiData?.configuration;
  const initialConfiguration = validateFocusSessionConfiguration(
    navigationConfiguration,
  );
  const initialFocusMinutes = navigationConfiguration?.plannedDurationMinutes ?? aiData?.duration_minutes ?? 25;
  const initialBreakMinutes = navigationConfiguration?.breakDurationMinutes ?? 5;
  const { user } = useAuth();
  const [phase, setPhase] = useState('setup');
  const [mode, setMode] = useState('focus');
  const [focusMinutes, setFocusMinutes] = useState(initialFocusMinutes);
  const [secondsLeft, setSecondsLeft] = useState(initialFocusMinutes * 60);
  const [intent, setIntent] = useState(aiData?.intent || '');
  const [tag, setTag] = useState('');
  const [completedCount, setCompletedCount] = useState(0);
  const [totalFocusedMinutes, setTotalFocusedMinutes] = useState(0);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(initialBreakMinutes * 60);
  const [durationRecommendation, setDurationRecommendation] = useState(null);
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);
  const [breakTip, setBreakTip] = useState('');
  const [microGoals, setMicroGoals] = useState([
    { label: 'Open the thing', done: false },
    { label: 'One small chunk', done: false },
    { label: 'Note where you stop', done: false },
  ]);
  const [streakState, setStreakState] = useState({
    streak: 0,
    weeklyMinutes: 0,
    lastDay: null,
  });
  const pauseCountRef = useRef(0);
  const resumeCountRef = useRef(0);
  const milestonesRef = useRef(new Set());
  const completedRef = useRef(false);
  const startedAtRef = useRef(null);
  const lifecycle = useInterventionLifecycle({
    userId: user?.id ?? null,
    moduleId: FOCUS_SESSION_MODULE_ID,
    planId: aiData?.planId ?? null,
    contextSnapshotId: aiData?.contextSnapshotId ?? null,
    triggerSource: aiData?.interventionId ? 'system' : 'manual',
    selectionMode: aiData?.interventionId ? 'adaptive_ranking' : 'explicit_request',
    configuration: { ...initialConfiguration, plannedDurationMinutes: focusMinutes },
    existingInterventionId: aiData?.interventionId ?? null,
  });

  const { streak, weeklyMinutes } = streakState;

  useEffect(() => {
    const data = loadStreakData();
    setStreakState(data);
  }, []);

  // focus timer
  useEffect(() => {
    if (phase !== 'running') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase('celebration');
          if (!completedRef.current && user?.id) {
            completedRef.current = true;
            void lifecycle.complete(buildFocusSessionOutcome({ configuration: { ...initialConfiguration, plannedDurationMinutes: focusMinutes }, secondsRemaining: 0, pauseCount: pauseCountRef.current, resumeCount: resumeCountRef.current, completedNaturally: true }));
          }
          setCompletedCount((c) => c + 1);
          if (mode === 'focus') {
            setTotalFocusedMinutes((t) => t + focusMinutes);
            setStreakState((curr) => {
              const day = todayKey();
              let newStreak = curr.streak;
              if (!curr.lastDay) {
                newStreak = 1;
              } else if (curr.lastDay === day) {
                newStreak = curr.streak;
              } else {
                const lastDate = new Date(curr.lastDay);
                const todayDate = new Date(day);
                const diffDays =
                  (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
                newStreak = diffDays === 1 ? curr.streak + 1 : 1;
              }

              const updated = {
                streak: newStreak,
                lastDay: day,
                weeklyMinutes: curr.weeklyMinutes + focusMinutes,
              };
              saveStreakData(updated);
              return updated;
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, focusMinutes, mode, lifecycle, user?.id]);

  // break timer
  useEffect(() => {
    if (phase !== 'break') return;
    const interval = setInterval(() => {
      setBreakSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          resetToSetup();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const selectPreset = useCallback(async (m) => {
    setFocusMinutes(m);
    setSecondsLeft(m * 60);
    if (m !== focusMinutes) setRecommendationDismissed(false);
    if (m !== 25 || !user?.id) {
      setDurationRecommendation(null);
      return;
    }
    const evidence = await getSupportEvidenceAsync(user.id, [FOCUS_SESSION_MODULE_ID]);
    const recommendation = recommendFocusConfiguration(evidence);
    setDurationRecommendation(recommendation?.plannedDurationMinutes === 15 ? recommendation : null);
  }, [focusMinutes, user?.id]);

  const startSession = async () => {
    setSecondsLeft(focusMinutes * 60);
    setMicroGoals([
      { label: 'Open the thing', done: false },
      { label: 'One small chunk', done: false },
      { label: 'Note where you stop', done: false },
    ]);
    pauseCountRef.current = 0;
    resumeCountRef.current = 0;
    milestonesRef.current = new Set();
    completedRef.current = false;
    startedAtRef.current = Date.now();
    if (user?.id && !lifecycle.hasStarted) {
      const started = await lifecycle.start();
      if (!started.ok) return;
    }
    setPhase('running');
  };

  const togglePause = async () => {
    if (phase === 'running') {
      pauseCountRef.current += 1;
      if (user?.id) await lifecycle.pause({ pauseCount: pauseCountRef.current });
      setPhase('paused');
    } else {
      resumeCountRef.current += 1;
      if (user?.id) await lifecycle.resume({ resumeCount: resumeCountRef.current });
      setPhase('running');
    }
  };

  const resetToSetup = async () => {
    if (user?.id && (phase === 'running' || phase === 'paused') && !lifecycle.isTerminal && !completedRef.current) {
      await lifecycle.abandon('user_reset', { completionRatio: completionRatio(focusMinutes * 60, secondsLeft) }, buildFocusSessionOutcome({ configuration: { ...initialConfiguration, plannedDurationMinutes: focusMinutes }, secondsRemaining: secondsLeft, pauseCount: pauseCountRef.current, resumeCount: resumeCountRef.current }));
    }
    setPhase('setup');
    setSecondsLeft(focusMinutes * 60);
    setBreakSecondsLeft(initialBreakMinutes * 60);
    lifecycle.reset();
  };

  const startBreak = () => {
    setBreakSecondsLeft(initialBreakMinutes * 60);
    setBreakTip(BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)]);
    setPhase('break');
  };

  const skipToNext = () => {
    resetToSetup();
  };

  const useRecommendedDuration = () => {
    setFocusMinutes(durationRecommendation.plannedDurationMinutes);
    setSecondsLeft(durationRecommendation.plannedDurationMinutes * 60);
    setDurationRecommendation(null);
  };

  const totalSeconds = focusMinutes * 60;
  const elapsed = totalSeconds - secondsLeft;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
  useEffect(() => {
    if (phase !== 'running' || !user?.id || !lifecycle.hasStarted) return;
    const ratio = completionRatio(totalSeconds, secondsLeft);
    const milestone = [0.25, 0.5, 0.75].find((point) => ratio >= point && !milestonesRef.current.has(point));
    if (milestone) {
      milestonesRef.current.add(milestone);
      lifecycle.progress({ progressType: 'focus_milestone', progressRatio: milestone, completedUnits: Math.round(milestone * 4), totalUnits: 4, elapsedMs: Math.max(0, Date.now() - (startedAtRef.current ?? Date.now())) });
    }
  }, [phase, secondsLeft, totalSeconds, user?.id, lifecycle]);
  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');
  const isActive = phase === 'running' || phase === 'paused';

  return (
    <SupportToolThemeProvider theme="adhd_focus">
    <SupportToolLayout className="focus-session-layout">
      <div className="mx-auto w-full max-w-[1320px] space-y-3 px-1 sm:px-2">
        <header className="relative flex flex-col gap-1 pb-1 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#dff6d7] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#26763a]"><Leaf size={15} /> Protect your attention</p><h1 className="text-4xl font-black leading-none tracking-tight text-[#1e2236] sm:text-5xl">Focus <span className="text-[#259447]">Session</span></h1></div>
          <div className="hidden items-center gap-4 lg:flex"><BrainMascot /><div className="rounded-2xl border border-[#d7e9cf] bg-white px-4 py-3 text-center text-xs font-bold shadow-sm">One block.<br />Full focus.<br />You got this. <Heart className="inline text-[#438f48]" size={13} fill="currentColor" /></div></div>
          <p className="max-w-[250px] text-sm font-medium leading-6 text-slate-600 sm:text-right">Choose one block, <span className="font-black text-[#438f48]">make it count</span>, then stop without overthinking it.</p>
        </header>

        <main className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
          <section className="rounded-2xl border border-[#bde5ae] bg-white p-4 shadow-[0_5px_14px_rgba(54,92,49,.14)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#438f48]"><Crosshair size={18} /> Current block</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{mode === 'focus' ? 'A single task, at a steady pace.' : 'Step away briefly and reset.'}</p>
              </div>
              <ModeSelector mode={mode} setMode={setMode} setFocusMinutes={setFocusMinutes} setSecondsLeft={setSecondsLeft} />
            </div>

            <div className="my-3 rounded-2xl border border-[#bde5ae] bg-gradient-to-br from-[#fafff7] to-[#effbe9] p-[2px]">
              <div className="relative rounded-[14px] bg-white px-4 py-3 sm:py-4"><img src="/focus-plant.svg" alt="Potted green plant" className="absolute bottom-3 left-5 h-20 w-16 object-contain" /><Sparkles className="absolute left-28 top-6 text-[#47af55]" size={22} /><Sparkles className="absolute bottom-7 right-8 text-[#47af55]" size={22} />
                <div className="flex justify-center">
                  <CircularProgress progress={progress}>
                    <div className="text-4xl font-black tracking-[0.12em] text-[#171a31] sm:text-5xl">{minutes}:{seconds}</div>
                    <div className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#29451E]">
                      {phase === 'running' ? (mode === 'focus' ? 'Focusing' : 'On break') : phase === 'paused' ? 'Paused' : 'Ready'}
                    </div>
                    {tag && <div className="mt-3 rounded-full border border-[#6D9F46] bg-[#FFFDF8] px-3 py-1 text-[11px] font-semibold text-[#29451E]">#{tag}</div>}
                  </CircularProgress>
                </div>
              </div>
            </div>

               <div className="space-y-2">
              <PresetSelector selected={focusMinutes} onSelect={selectPreset} />
              {durationRecommendation && !recommendationDismissed && phase === 'setup' && (
                <div className="rounded-2xl border border-[#6D9F46] bg-[#E2EDDA] p-4 shadow-[3px_3px_0_#D8E6CE]">
                  <p className="text-sm font-semibold text-slate-900">15 min may work better</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">Your recent Focus Sessions have gone better at 15 minutes.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={useRecommendedDuration} className="rounded-xl bg-[#6D9F46] px-3 py-2 text-xs font-black text-[#18300F] shadow-[2px_2px_0_#D8E6CE]">Use 15 min</button>
                    <button type="button" onClick={() => setRecommendationDismissed(true)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Keep 25 min</button>
                  </div>
                </div>
              )}

               <div className="flex gap-3">
                 {phase === 'setup' ? (
                   <><button aria-label="Start" onClick={startSession} className="flex-1 rounded-xl bg-gradient-to-r from-[#239d4b] to-[#147a38] py-3 text-base font-black text-white shadow-[3px_3px_0_#b7e3b6] transition-colors hover:bg-[#0f6a30]"><Play className="mr-2 inline" size={18} fill="currentColor" /> Start Focus Session</button><button type="button" aria-label="Session settings" className="grid w-16 place-items-center rounded-xl border border-[#9fdfaa] bg-[#f5fff3] text-[#259447] shadow-sm"><SlidersHorizontal size={21} /></button></>
                ) : (
                  <>
                     <button onClick={togglePause} className="flex-1 rounded-xl bg-[#6D9F46] py-3 text-sm font-black text-[#18300F] shadow-[3px_3px_0_#D8E6CE] transition-colors hover:bg-[#557D37]">{phase === 'running' ? 'Pause' : 'Resume'}</button>
                     <button onClick={resetToSetup} className="rounded-xl border-2 border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-slate-500 hover:bg-slate-50">End</button>
                  </>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-3">
            <TaskInput intent={intent} setIntent={setIntent} tag={tag} setTag={setTag} isActive={isActive} />
            <MicroGoals goals={microGoals} setGoals={setMicroGoals} />
            <StatsRow sessions={completedCount} totalMinutes={totalFocusedMinutes} streak={streak} weeklyMinutes={weeklyMinutes} />
            <FocusCues />
            {phase === 'celebration' && <CelebrationBanner onStartBreak={startBreak} onSkip={skipToNext} intent={intent} focusMinutes={focusMinutes} />}
            {phase === 'break' && <BreakMode secondsLeft={breakSecondsLeft} tip={breakTip} onEnd={resetToSetup} />}
            {!user?.id && <p role="alert" className="rounded-xl border border-[#6D9F46] bg-[#E2EDDA] p-3 text-xs text-[#29451E]">Sign in to save Focus Session progress and outcomes. The timer still works locally.</p>}
          </aside>
        </main>
      </div>
    </SupportToolLayout>
    </SupportToolThemeProvider>
  );
};

export default FocusSessions;
