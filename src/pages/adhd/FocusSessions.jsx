'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Sun, Moon, Coffee, Crosshair, Tag } from 'lucide-react';

const PRESETS = [
  { label: '15 min Sprint', minutes: 15, emoji: 'Ã¢Å¡Â¡' },
  { label: '25 min Classic', minutes: 25, emoji: 'Ã°Å¸Ââ€¦' },
  { label: '45 min Deep Dive', minutes: 45, emoji: 'Ã°Å¸Å’Å ' },
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
  'Stretch your arms & legs Ã°Å¸Â§Ëœ',
  'Drink some water Ã°Å¸â€™Â§',
  'Look at something 20ft away for 20s Ã°Å¸â€˜ÂÃ¯Â¸Â',
  'Take 5 deep breaths Ã°Å¸Å’Â¬Ã¯Â¸Â',
  'Walk around for a minute Ã°Å¸Å¡Â¶',
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
            <stop offset="0%" stopColor="hsl(142 72% 36%)" />
            <stop offset="100%" stopColor="#2563eb" />
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
    <div className="inline-flex items-center gap-2 rounded-2xl bg-white/70 border border-white/80 px-1 py-1 shadow-sm">
      {MODES.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => handleModeChange(m.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-semibold transition-all ${
              active
                ? 'bg-[hsl(142_72%_36%)] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100'
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
            className={`px-3 py-2 rounded-2xl text-xs font-semibold border transition-all ${
              isSelected
                ? 'border-[hsl(142_72%_36%)] bg-[hsl(142_72%_36%)]/10 text-[hsl(142_72%_32%)] shadow-sm'
                : 'border-slate-200 bg-white hover:border-[hsl(142_72%_36%)]/60 hover:bg-[hsl(142_72%_36%)]/5'
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
  <div className="w-full space-y-3">
    <div className="relative">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[hsl(142_72%_36%)]/70">
        <Crosshair size={18} />
      </div>
      <input
        type="text"
        placeholder="Block intent (e.g. Read chapter 3)"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        disabled={isActive}
        className="w-full h-11 rounded-2xl bg-white/80 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm font-medium outline-none pl-11 pr-4 focus:border-[hsl(142_72%_36%)] focus:ring-2 focus:ring-[hsl(142_72%_36%)]/20 disabled:opacity-60"
      />
    </div>

    <div className="relative">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[hsl(142_72%_36%)]/70">
        <Tag size={18} />
      </div>
      <input
        type="text"
        placeholder="Tag (Study, Writing, Deep work...)"
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        disabled={isActive}
        className="w-full h-11 rounded-2xl bg-white/80 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm font-medium outline-none pl-11 pr-4 focus:border-[hsl(142_72%_36%)] focus:ring-2 focus:ring-[hsl(142_72%_36%)]/20 disabled:opacity-60"
      />
    </div>
  </div>
);

const MicroGoals = ({ goals, setGoals }) => {
  const toggleGoal = (index) => {
    setGoals((prev) =>
      prev.map((g, i) => (i === index ? { ...g, done: !g.done } : g)),
    );
  };

  const completedCount = goals.filter((g) => g.done).length;

  return (
    <div className="bg-white/80 backdrop-blur-md border border-white/70 rounded-3xl p-6 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-semibold">
          Micro-goals
        </p>
        <span className="px-3 py-1 rounded-2xl text-[11px] font-semibold bg-[hsl(142_72%_36%)]/8 text-[hsl(142_72%_32%)] border border-[hsl(142_72%_36%)]/40">
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
                  ? 'bg-[hsl(142_72%_36%)] border-[hsl(142_72%_32%)]'
                  : 'border-slate-300 bg-white hover:border-[hsl(142_72%_36%)]/60'
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
  <div className="bg-white/80 backdrop-blur-md border border-white/70 rounded-3xl p-6 shadow-lg space-y-2">
    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-semibold">
      Today
    </p>
    <p className="text-sm text-slate-900">
      {sessions} session{sessions === 1 ? '' : 's'} Ã‚Â· {totalMinutes} min
    </p>
    <p className="text-xs text-slate-600">
      Streak{' '}
      <span className="font-semibold text-[hsl(142_72%_36%)]">{streak}</span> days Ã‚Â· Week{' '}
      <span className="font-semibold text-blue-500">{weeklyMinutes}</span> min
    </p>
  </div>
);

const CelebrationBanner = ({ onStartBreak, onSkip, intent, focusMinutes }) => (
  <div className="bg-white/90 backdrop-blur-md border border-[hsl(142_72%_36%)]/30 rounded-3xl p-5 shadow-lg space-y-3">
    <p className="text-sm font-semibold text-slate-900">Block complete</p>
    <p className="text-xs text-slate-600">
      You protected {focusMinutes} minutes.
      {intent ? ` Ã¢â‚¬Å“${intent}Ã¢â‚¬Â moved forward.` : ''}
    </p>
    <div className="flex flex-wrap gap-2">
      <button
        onClick={onStartBreak}
        className="px-4 py-2 rounded-2xl text-xs font-semibold bg-[hsl(142_72%_36%)] text-white shadow-md hover:shadow-lg hover:-translate-y-[1px] transition-all"
      >
        Take 5-min break
      </button>
      <button
        onClick={onSkip}
        className="px-4 py-2 rounded-2xl text-xs font-semibold border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
      >
        Start next block
      </button>
    </div>
  </div>
);

const BreakMode = ({ secondsLeft, tip, onEnd }) => {
  const m = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const s = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <div className="bg-white/90 backdrop-blur-md border border-blue-200 rounded-3xl p-5 shadow-lg space-y-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-blue-500 font-semibold">
        Break
      </p>
      <div className="text-3xl font-semibold text-slate-900">
        {m}:{s}
      </div>
      <p className="text-xs text-slate-600">{tip}</p>
      <button
        onClick={onEnd}
        className="mt-1 px-4 py-2 rounded-2xl text-xs font-semibold bg-blue-500 text-white shadow-md hover:shadow-lg hover:-translate-y-[1px] transition-all"
      >
        Back to focus
      </button>
    </div>
  );
};

const FocusSessions = () => {
  const [phase, setPhase] = useState('setup');
  const [mode, setMode] = useState('focus');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [intent, setIntent] = useState('');
  const [tag, setTag] = useState('');
  const [completedCount, setCompletedCount] = useState(0);
  const [totalFocusedMinutes, setTotalFocusedMinutes] = useState(0);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(5 * 60);
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
  }, [phase, focusMinutes, mode]);

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

  const selectPreset = useCallback((m) => {
    setFocusMinutes(m);
    setSecondsLeft(m * 60);
  }, []);

  const startSession = () => {
    setSecondsLeft(focusMinutes * 60);
    setMicroGoals([
      { label: 'Open the thing', done: false },
      { label: 'One small chunk', done: false },
      { label: 'Note where you stop', done: false },
    ]);
    setPhase('running');
  };

  const togglePause = () => {
    setPhase((p) => (p === 'running' ? 'paused' : 'running'));
  };

  const resetToSetup = () => {
    setPhase('setup');
    setSecondsLeft(focusMinutes * 60);
    setBreakSecondsLeft(5 * 60);
  };

  const startBreak = () => {
    setBreakSecondsLeft(5 * 60);
    setBreakTip(BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)]);
    setPhase('break');
  };

  const skipToNext = () => {
    resetToSetup();
  };

  const totalSeconds = focusMinutes * 60;
  const elapsed = totalSeconds - secondsLeft;
  const progress = totalSeconds > 0 ? elapsed / totalSeconds : 0;
  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');
  const isActive = phase === 'running' || phase === 'paused';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[hsl(142_72%_36%)]/5 to-blue-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-10">
        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] shadow-xl mb-2">
            <span className="text-2xl">Ã°Å¸Å’Â³</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-[hsl(142_72%_36%)] via-[hsl(142_66%_42%)] to-blue-600 bg-clip-text text-transparent">
            Focus Sessions
          </h1>
          <p className="text-sm md:text-base text-gray-600 max-w-xl mx-auto">
            One calm block at a time, in the same light, minimal style as your Neurobridge hub.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-8">
          {/* left */}
          <section className="bg-white/80 backdrop-blur-md border border-white/70 rounded-3xl p-7 shadow-xl flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 font-semibold">
                Current block
              </p>
              <ModeSelector
                mode={mode}
                setMode={setMode}
                setFocusMinutes={setFocusMinutes}
                setSecondsLeft={setSecondsLeft}
              />
            </div>

            <TaskInput
              intent={intent}
              setIntent={setIntent}
              tag={tag}
              setTag={setTag}
              isActive={isActive}
            />

            <div className="flex flex-col gap-6">
              <div className="flex justify-center">
                <CircularProgress progress={progress}>
                  <div className="text-3xl font-semibold tracking-[0.18em] text-slate-900">
                    {minutes}:{seconds}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {phase === 'running'
                      ? mode === 'focus'
                        ? 'Focus'
                        : 'Break'
                      : phase === 'paused'
                      ? 'Paused'
                      : 'Ready'}
                  </div>
                  {tag && (
                    <div className="mt-3 px-3 py-1 rounded-full border border-slate-200 bg-white text-[11px] text-slate-700">
                      #{tag}
                    </div>
                  )}
                </CircularProgress>
              </div>

              <div className="space-y-4">
                <PresetSelector selected={focusMinutes} onSelect={selectPreset} />

                <div className="flex gap-3">
                  {phase === 'setup' ? (
                    <button
                      onClick={startSession}
                      className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-gradient-to-r from-[hsl(142_72%_36%)] to-[hsl(142_66%_42%)] text-white shadow-md hover:shadow-lg hover:-translate-y-[1px] transition-all"
                    >
                      Start {mode === 'focus' ? 'focus block' : 'break'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={togglePause}
                        className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-[hsl(142_72%_36%)] text-white shadow-md hover:shadow-lg hover:-translate-y-[1px] transition-all"
                      >
                        {phase === 'running' ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={resetToSetup}
                        className="px-4 py-3 rounded-2xl text-sm font-semibold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50"
                      >
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </div>

              {phase === 'celebration' && (
                <CelebrationBanner
                  onStartBreak={startBreak}
                  onSkip={skipToNext}
                  intent={intent}
                  focusMinutes={focusMinutes}
                />
              )}

              {phase === 'break' && (
                <BreakMode
                  secondsLeft={breakSecondsLeft}
                  tip={breakTip}
                  onEnd={resetToSetup}
                />
              )}
            </div>
          </section>

          {/* right */}
          <section className="space-y-5">
            <MicroGoals goals={microGoals} setGoals={setMicroGoals} />
            <StatsRow
              sessions={completedCount}
              totalMinutes={totalFocusedMinutes}
              streak={streak}
              weeklyMinutes={weeklyMinutes}
            />
          </section>
        </main>
      </div>
    </div>
  );
};

export default FocusSessions;
