'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sun, Moon, Coffee, Crosshair, Tag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
import { useInterventionLifecycle } from '@/support/execution';
import { buildFocusSessionOutcome, completionRatio, validateFocusSessionConfiguration } from '@/support/modules/focusSession/focusSessionService';
import { FOCUS_SESSION_MODULE_ID } from '@/support/modules/focusSession/focusSessionTypes';
import { getSupportEvidenceAsync } from '@/support/evidence';
import { recommendFocusConfiguration } from '@backend/adaptive/reasoning/focusConfiguration';

const PRESETS = [
  { label: '15 min Sprint', minutes: 15, emoji: 'Quick' },
  { label: '25 min Classic', minutes: 25, emoji: 'Standard' },
  { label: '45 min Deep Dive', minutes: 45, emoji: 'Extended' },
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
  const size = 220;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute -rotate-90 transform">
        <defs>
          <linearGradient id="focusRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e40af" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(148, 163, 184, 0.25)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#focusRing)"
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
    <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border-2 border-blue-100 bg-white p-1">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => handleModeChange(m.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all ${
              active
                ? 'bg-blue-700 text-white shadow-[2px_2px_0_#bef264]'
                 : 'text-slate-500 hover:bg-blue-50 hover:text-blue-800'
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
    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-semibold">
      Session length
    </p>
    <div className="flex gap-2 flex-wrap">
      {PRESETS.map((p) => {
        const isSelected = selected === p.minutes;
        return (
          <button
            key={p.minutes}
            onClick={() => onSelect(p.minutes)}
              className={`min-w-[104px] px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
              isSelected
                ? 'border-blue-700 bg-blue-50 text-blue-800 shadow-[2px_2px_0_#bef264]'
                 : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            {p.emoji} {p.label}
          </button>
        );
      })}
    </div>
  </div>
);

const TaskInput = ({ intent, setIntent, tag, setTag, isActive }) => (
  <section className="space-y-3 rounded-2xl border-2 border-blue-100 bg-white p-4 shadow-[3px_3px_0_#dbeafe]">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Session details</p>
      <p className="mt-1 text-xs text-slate-500">Name the one thing this block is for.</p>
    </div>
    <div className="w-full space-y-2">
    <div className="relative">
       <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-blue-700/70">
        <Crosshair size={18} />
      </div>
      <input
        type="text"
        placeholder="Block intent (e.g. Read chapter 3)"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        disabled={isActive}
        className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
      />
    </div>

    <div className="relative">
       <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-blue-700/70">
        <Tag size={18} />
      </div>
      <input
        type="text"
        placeholder="Tag (Study, Writing, Deep work...)"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        disabled={isActive}
        className="h-11 w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
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
   <div className="space-y-3 rounded-2xl border-2 border-blue-100 bg-white p-4 shadow-[3px_3px_0_#dbeafe]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-semibold">
          Micro-goals
        </p>
        <span className="rounded-lg border border-lime-400 bg-lime-100 px-2.5 py-1 text-[11px] font-black text-slate-900">
          {completedCount}/{goals.length}
        </span>
      </div>
      <ul className="space-y-2">
        {goals.map((g, idx) => (
          <li key={idx} className="flex items-center gap-3 text-xs text-slate-800">
            <button
              onClick={() => toggleGoal(idx)}
              className={`w-5 h-5 rounded-xl border flex items-center justify-center transition-all ${
                g.done
                     ? 'border-lime-400 bg-lime-400'
                     : 'border-slate-300 bg-white hover:border-blue-500'
              }`}
            >
              {g.done && <span className="w-2.5 h-2.5 rounded-[6px] bg-white" />}
            </button>
            <span className={g.done ? 'line-through text-slate-400' : ''}>
              {g.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const StatsRow = ({ sessions, totalMinutes, streak, weeklyMinutes }) => (
  <div className="space-y-1 rounded-2xl border-2 border-blue-100 bg-white p-4 shadow-[3px_3px_0_#dbeafe]">
    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-semibold">
      Today
    </p>
    <p className="text-sm text-slate-900">
      {sessions} session{sessions === 1 ? '' : 's'} | {totalMinutes} min
    </p>
    <p className="text-xs text-slate-600">
      Streak{' '}
       <span className="font-black text-blue-700">{streak}</span> days | Week{' '}
       <span className="font-black text-blue-700">{weeklyMinutes}</span> min
    </p>
  </div>
);

const CelebrationBanner = ({ onStartBreak, onSkip, intent, focusMinutes }) => (
  <div className="space-y-3 rounded-2xl border-2 border-lime-400 bg-lime-50 p-4 shadow-[3px_3px_0_#2563eb]">
    <p className="text-sm font-semibold text-slate-900">Block complete</p>
    <p className="text-xs text-slate-600">
      You protected {focusMinutes} minutes.
      {intent ? ` "${intent}" moved forward.` : ''}
    </p>
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onStartBreak}
          className="rounded-xl bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0_#bef264] transition-colors hover:bg-blue-800"
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
  <section className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 shadow-[3px_3px_0_#dbeafe]">
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">A simple plan</p>
    <ol className="mt-3 space-y-2 text-sm text-slate-700">
       <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-300 text-[11px] font-black text-slate-950">1</span><span>Choose one small, specific outcome.</span></li>
       <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-300 text-[11px] font-black text-slate-950">2</span><span>Work until the timer asks you to stop.</span></li>
       <li className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-300 text-[11px] font-black text-slate-950">3</span><span>End the block without deciding the next thing yet.</span></li>
    </ol>
  </section>
);

const BreakMode = ({ secondsLeft, tip, onEnd }) => {
  const m = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const s = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <div className="space-y-2 rounded-3xl border-2 border-lime-400 bg-lime-50 p-4 shadow-[4px_4px_0_#2563eb]">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-800">
        Break
      </p>
      <div className="text-3xl font-semibold text-slate-900">
        {m}:{s}
      </div>
      <p className="text-xs text-slate-600">{tip}</p>
      <button
        onClick={onEnd}
        className="mt-1 rounded-2xl bg-blue-700 px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0_#bef264] transition-all hover:-translate-y-[1px] hover:bg-blue-800"
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
      <div className="mx-auto w-full max-w-[1320px] space-y-4 px-1 sm:px-2">
        <header className="flex flex-col gap-2 border-b-2 border-blue-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">Protect your attention</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Focus Session</h1>
          </div>
          <p className="max-w-sm text-sm text-slate-500 sm:text-right">Choose one block, make it count, then stop without overthinking it.</p>
        </header>

        <main className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
          <section className="rounded-3xl border-2 border-blue-200 bg-white p-4 shadow-[5px_5px_0_#d9f99d] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Current block</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{mode === 'focus' ? 'A single task, at a steady pace.' : 'Step away briefly and reset.'}</p>
              </div>
              <ModeSelector mode={mode} setMode={setMode} setFocusMinutes={setFocusMinutes} setSecondsLeft={setSecondsLeft} />
            </div>

            <div className="my-4 rounded-3xl bg-gradient-to-br from-blue-700 via-blue-500 to-lime-300 p-[2px]">
              <div className="rounded-[22px] bg-blue-50 px-4 py-5 sm:py-6">
                <div className="flex justify-center">
                  <CircularProgress progress={progress}>
                    <div className="text-3xl font-black tracking-[0.12em] text-slate-950 sm:text-4xl">{minutes}:{seconds}</div>
                    <div className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-blue-800">
                      {phase === 'running' ? (mode === 'focus' ? 'Focusing' : 'On break') : phase === 'paused' ? 'Paused' : 'Ready'}
                    </div>
                    {tag && <div className="mt-3 rounded-full border border-blue-200 bg-white px-3 py-1 text-[11px] font-semibold text-blue-800">#{tag}</div>}
                  </CircularProgress>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <PresetSelector selected={focusMinutes} onSelect={selectPreset} />
              {durationRecommendation && !recommendationDismissed && phase === 'setup' && (
                <div className="rounded-2xl border-2 border-lime-400 bg-lime-50 p-4 shadow-[3px_3px_0_#2563eb]">
                  <p className="text-sm font-semibold text-slate-900">15 min may work better</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">Your recent Focus Sessions have gone better at 15 minutes.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={useRecommendedDuration} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white shadow-[2px_2px_0_#bef264]">Use 15 min</button>
                    <button type="button" onClick={() => setRecommendationDismissed(true)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Keep 25 min</button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {phase === 'setup' ? (
                   <button onClick={startSession} className="flex-1 rounded-xl bg-blue-700 py-3 text-sm font-black text-white shadow-[3px_3px_0_#bef264] transition-colors hover:bg-blue-800">Start</button>
                ) : (
                  <>
                     <button onClick={togglePause} className="flex-1 rounded-xl bg-blue-700 py-3 text-sm font-black text-white shadow-[3px_3px_0_#bef264] transition-colors hover:bg-blue-800">{phase === 'running' ? 'Pause' : 'Resume'}</button>
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
            {!user?.id && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Sign in to save Focus Session progress and outcomes. The timer still works locally.</p>}
          </aside>
        </main>
      </div>
    </SupportToolLayout>
    </SupportToolThemeProvider>
  );
};

export default FocusSessions;
