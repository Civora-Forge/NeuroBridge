'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";

// ------- time helpers -------
const timeToMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m || '0', 10);
};

const minutesToTime = (m) => {
  const hh = Math.floor(m / 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
};

const durationMinutes = (start, end) =>
  Math.max(0, timeToMinutes(end) - timeToMinutes(start));

// ------- data -------
const sampleBlocks = [
  {
    id: 1,
    label: 'Morning routine',
    start: '07:00',
    end: '08:00',
    icon: 'Morning',
    category: 'self-care',
    done: false,
  },
  {
    id: 2,
    label: 'Deep work',
    start: '09:00',
    end: '11:00',
    icon: 'Study',
    category: 'study',
    done: false,
  },
  {
    id: 3,
    label: 'Break',
    start: '11:00',
    end: '11:30',
    icon: 'Break',
    category: 'self-care',
    done: false,
  },
];

const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);

// ------- component -------
const VisualTimeline = () => {
  const [view, setView] = useState('day'); // 'day' | 'week'
  const [density, setDensity] = useState('comfortable'); // 'comfortable' | 'compact'
  const idRef = useRef(100);

  const [blocksByDate, setBlocksByDate] = useState({
    [todayKey()]: sampleBlocks,
  });

  const [brainDump, setBrainDump] = useState([
    { id: 'b1', text: 'Buy groceries' },
    { id: 'b2', text: 'Email prof about project' },
  ]);

  const [banner, setBanner] = useState(null);
  const firedRemindersRef = useRef(new Set());

  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const routines = useMemo(
    () => ({
      Morning: [
        {
          label: 'Stretch',
          start: '07:00',
          end: '07:10',
          icon: 'Stretch',
          category: 'self-care',
        },
        {
          label: 'Shower & dress',
          start: '07:10',
          end: '07:30',
          icon: 'Ready',
          category: 'self-care',
        },
        {
          label: 'Breakfast',
          start: '07:30',
          end: '08:00',
          icon: 'Meal',
          category: 'self-care',
        },
      ],
      Study: [
        {
          label: 'Focus block',
          start: '09:00',
          end: '10:00',
          icon: 'Focus',
          category: 'study',
        },
        {
          label: 'Short break',
          start: '10:00',
          end: '10:10',
          icon: 'Break',
          category: 'self-care',
        },
        {
          label: 'Focus block',
          start: '10:10',
          end: '11:00',
          icon: 'Focus',
          category: 'study',
        },
      ],
    }),
    []
  );

  // ------- helpers over state -------
  const getBlocksForDate = (key) => blocksByDate[key] || [];

  const setBlocksForDate = (key, arr) => {
    setBlocksByDate((prev) => ({ ...prev, [key]: arr }));
  };

  const addBlockToDate = (key, block) => {
    const withId = {
      id: ++idRef.current,
      ...block,
      done: false,
      started: false,
      reminders: { enabled: false, minutesBefore: 5 },
    };
    setBlocksForDate(key, [...getBlocksForDate(key), withId]);
    return withId;
  };

  const updateBlock = (key, id, patch) => {
    setBlocksForDate(
      key,
      getBlocksForDate(key).map((b) =>
        b.id === id ? { ...b, ...patch } : b
      )
    );
  };

  const removeBlock = (key, id) => {
    setBlocksForDate(
      key,
      getBlocksForDate(key).filter((b) => b.id !== id)
    );
  };

  // ------- reminders (same logic, calm UI) -------
  useEffect(() => {
    const key = todayKey();
    const blocks = getBlocksForDate(key);
    blocks.forEach((b) => {
      if (!b.reminders || !b.reminders.enabled) return;
      const fireAt = timeToMinutes(b.start) - (b.reminders.minutesBefore || 5);
      const uid = `${key}-${b.id}-rem-${b.reminders.minutesBefore}`;
      if (
        nowMinutes >= fireAt &&
        nowMinutes < timeToMinutes(b.start) &&
        !firedRemindersRef.current.has(uid)
      ) {
        firedRemindersRef.current.add(uid);
        setBanner(`Reminder: ${b.label} in ${b.reminders.minutesBefore} min`);
        setTimeout(() => setBanner(null), 4000);
      }
    });
  }, [nowMinutes, blocksByDate]);

  const todayStats = useMemo(() => {
    const arr = getBlocksForDate(todayKey());
    const completed = arr.filter((b) => b.done).length;
    const planned = arr.length;
    const plannedTime = arr.reduce(
      (s, b) => s + durationMinutes(b.start, b.end),
      0
    );
    const completedTime = arr.reduce(
      (s, b) => s + (b.done ? durationMinutes(b.start, b.end) : 0),
      0
    );
    return { completed, planned, plannedTime, completedTime };
  }, [blocksByDate, nowMinutes]);

  const toggleDone = (id) =>
    updateBlock(todayKey(), id, { done: true });

  const startBlock = (id) =>
    updateBlock(todayKey(), id, { started: true });

  const stopBlock = (id) =>
    updateBlock(todayKey(), id, { started: false });

  const snoozeBlock = (id, minutes = 10) => {
    const key = todayKey();
    setBlocksForDate(
      key,
      getBlocksForDate(key).map((b) => {
        if (b.id !== id) return b;
        const newStart = minutesToTime(timeToMinutes(b.start) + minutes);
        const newEnd = minutesToTime(timeToMinutes(b.end) + minutes);
        return { ...b, start: newStart, end: newEnd };
      })
    );
  };

  const addRoutine = (name) => {
    const tmpl = routines[name];
    if (!tmpl) return;
    tmpl.forEach((t) =>
      addBlockToDate(todayKey(), { ...t, routine: name })
    );
  };

  const addNewBlock = (data) => {
    addBlockToDate(todayKey(), data);
  };

  const minutesToCountdown = (mins) => {
    if (mins <= 0) return '0m';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  // ------- subcomponents -------
  const TimelineBlock = ({ block }) => {
    const startM = timeToMinutes(block.start);
    const endM = timeToMinutes(block.end);
    const total = Math.max(1, endM - startM);
    const progressed = block.started
      ? Math.min(100, Math.round(((nowMinutes - startM) / total) * 100))
      : block.done
      ? 100
      : 0;
    const isActive = nowMinutes >= startM && nowMinutes < endM;

    return (
      <div className={`flex gap-3 rounded-2xl border bg-[#fffdf7] px-3 py-3 shadow-sm sm:px-4 ${block.done ? 'border-[#c9a45a]' : isActive ? 'border-[#b8872e] ring-2 ring-[#f5e6bd]' : 'border-[#e7d7bf]'}`}>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbf1d9] text-xs font-black text-[#8a6117]">
          <span aria-hidden>
            {block.icon || 'Task'}
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-950 truncate">
                  {block.label}
                </p>
                {block.routine && (
                  <span className="text-[10px] rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                    {block.routine}
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-slate-500">
                {block.start} - {block.end}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
              {isActive && (
                  <span className="font-bold text-[#8a6117]">
                    LIVE | {minutesToCountdown(endM - nowMinutes)}
                </span>
              )}
              {block.done && <span>Done</span>}
            </div>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                block.done
                  ? 'bg-lime-500'
                  : 'bg-[#c39234]'
              }`}
              style={{ width: `${progressed}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            {!block.done && (
              <button
                onClick={() => toggleDone(block.id)}
                className="rounded-full border border-lime-300 bg-lime-50 px-2 py-1 font-bold text-lime-800 hover:bg-lime-100"
              >
                Mark done
              </button>
            )}
            {!block.started ? (
              <button
                onClick={() => startBlock(block.id)}
                className="rounded-full bg-[#285943] px-2 py-1 font-bold text-white hover:bg-[#1d4332]"
              >
                Start
              </button>
            ) : (
              <button
                onClick={() => stopBlock(block.id)}
                className="rounded-full border border-[#a8d5ce] px-2 py-1 font-bold text-[#285943] hover:bg-[#edf6ee]"
              >
                Stop
              </button>
            )}
            <button
              onClick={() => snoozeBlock(block.id)}
              className="rounded-full px-2 py-0.5 text-slate-500 hover:bg-slate-50"
            >
              Snooze 10m
            </button>
            <button
              onClick={() => removeBlock(todayKey(), block.id)}
              className="ml-auto text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  };

  const AddBlockForm = ({ onAdd }) => {
    const [label, setLabel] = useState('');
    const [start, setStart] = useState('12:00');
    const [end, setEnd] = useState('12:30');
    const [icon, setIcon] = useState('Task');

    const submit = (e) => {
      e.preventDefault();
      if (!label.trim()) return;
      onAdd({ label: label.trim(), start, end, icon, category: 'other' });
      setLabel('');
    };

    return (
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 rounded-2xl border border-[#e7d7bf] bg-[#fffdf7] p-3 shadow-sm text-sm sm:flex-row sm:items-center"
      >
        <input
          className="flex-1 rounded-xl border border-[#e7d7bf] bg-[#fffaf1] px-3 py-2 text-sm focus:border-[#285943] focus:outline-none"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add block: Email 20m"
        />
        <div className="flex items-center gap-2">
          <input
            type="time"
            className="w-24 rounded-xl border border-slate-200 px-2 py-2 text-xs"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="time"
            className="w-24 rounded-xl border border-slate-200 px-2 py-2 text-xs"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
          <button className="rounded-xl bg-[#285943] px-3 py-2 text-xs font-bold text-white hover:bg-[#1d4332]">
            Add
          </button>
        </div>
      </form>
    );
  };

  const RoutineButtons = () => (
    <div className="flex flex-wrap gap-2 text-xs">
      {Object.keys(routines).map((name) => (
        <button
          key={name}
          onClick={() => addRoutine(name)}
          className="rounded-full border border-[#dcc28a] bg-[#fffdf7] px-3 py-1 font-bold text-[#8a6117] hover:bg-[#fbf1d9]"
        >
          + {name}
        </button>
      ))}
    </div>
  );

  const BrainDump = () => {
    const [text, setText] = useState('');

    const add = () => {
      if (!text.trim()) return;
      setBrainDump((prev) => [...prev, { id: `b${Date.now()}`, text: text.trim() }]);
      setText('');
    };

    return (
      <div className="space-y-2 text-sm">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Brain dump a quick thought"
          />
          <button
            onClick={add}
            className="rounded-lg bg-[#285943] px-3 py-2 text-xs font-medium text-white hover:bg-[#1d4332]"
          >
            Add
          </button>
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {brainDump.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span className="truncate text-xs text-slate-800">{d.text}</span>
              <button
                onClick={() =>
                  setBrainDump((prev) => prev.filter((x) => x.id !== d.id))
                }
                className="text-xs text-slate-500 hover:underline"
              >
                Clear
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const weekDays = useMemo(() => {
    const base = new Date();
    const dow = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((dow + 6) % 7));
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        key: todayKey(d),
        label: d.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
        }),
      };
    });
  }, [nowMinutes]);

  return (
    <SupportToolThemeProvider theme="adhd_focus">
    <SupportToolLayout>
      <main className="mx-auto max-w-4xl bg-[#fffaf1] px-4 py-6 sm:py-8">
        {banner && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {banner}
          </div>
        )}

        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-[#f0d694] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#5f4310]">Time made visible</div>
            <h1 className="text-3xl font-black tracking-tight text-stone-900 sm:text-4xl">
              Visual timeline
            </h1>
            <p className="text-sm font-medium text-slate-600">
              Make time visible. Plan a few blocks and follow them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="rounded-full border border-[#dcc28a] bg-[#fbf1d9] px-3 py-1 font-mono font-bold text-[#8a6117]">
              Now: {minutesToTime(nowMinutes)}
            </div>
            <div className="flex rounded-full border border-[#e7d7bf] bg-[#fffdf7] p-1">
              <button
                onClick={() => setView('day')}
                className={`rounded-full px-3 py-1 ${
                  view === 'day'
                     ? 'bg-[#285943] text-white shadow-sm'
                    : 'text-slate-700'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setView('week')}
                className={`rounded-full px-3 py-1 ${
                  view === 'week'
                     ? 'bg-[#285943] text-white shadow-sm'
                    : 'text-slate-700'
                }`}
              >
                Week
              </button>
            </div>
          </div>
        </header>

        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <RoutineButtons />
          <label className="flex items-center gap-2 text-slate-600">
            Density
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </section>

        {view === 'day' ? (
          <section className="space-y-4">
            <AddBlockForm onAdd={addNewBlock} />

            <div className="space-y-2">
              {getBlocksForDate(todayKey()).length === 0 && (
                <p className="text-xs text-slate-500">
                  No blocks yet. Add one above or use a routine.
                </p>
              )}
              {getBlocksForDate(todayKey()).map((b) => (
                <TimelineBlock key={b.id} block={b} />
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
               <div className="rounded-2xl border border-[#e7d7bf] bg-[#fff7e8] p-4">
                <h3 className="mb-2 text-sm font-medium text-slate-900">
                  Brain dump
                </h3>
                <BrainDump />
              </div>
               <div className="rounded-2xl border border-[#dcc28a] bg-[#fbf1d9] p-4 text-sm">
                <h3 className="mb-2 text-sm font-medium text-slate-900">
                  Today
                </h3>
                <p className="text-xs text-slate-600">
                  Blocks: {todayStats.completed} done / {todayStats.planned} planned
                </p>
                <p className="text-xs text-slate-600">
                  Planned: {todayStats.plannedTime} min
                </p>
                <p className="text-xs text-slate-600">
                  Completed: {todayStats.completedTime} min
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-2 text-xs">
              {weekDays.map((d) => {
                const blocks = getBlocksForDate(d.key);
                const isToday = d.key === todayKey();
                return (
                  <div
                    key={d.key}
                    className={`flex-1 rounded-lg px-2 py-2 text-left ${
                      isToday
                         ? 'bg-[#285943] text-white'
                        : 'text-slate-500'
                    }`}
                  >
                    <div className="text-[11px]">{d.label}</div>
                    <div className="mt-1 text-[10px] opacity-80">
                      {blocks.length === 0
                        ? '-'
                        : `${blocks.length} block${blocks.length > 1 ? 's' : ''}`}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Week view is a quick capacity scan. Today is the only editable day in this local tool.
            </p>
          </section>
        )}

        <footer className="mt-8 text-[11px] text-slate-500">
          Hint: use concrete labels like "Email professor for 20 minutes" instead of "Be productive".
        </footer>
      </main>
    </SupportToolLayout>
    </SupportToolThemeProvider>
  );
};

export default VisualTimeline;
