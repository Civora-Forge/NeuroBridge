'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

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
    icon: 'ðŸŒ…',
    category: 'self-care',
    done: false,
  },
  {
    id: 2,
    label: 'Deep work',
    start: '09:00',
    end: '11:00',
    icon: 'ðŸ§ ',
    category: 'study',
    done: false,
  },
  {
    id: 3,
    label: 'Break',
    start: '11:00',
    end: '11:30',
    icon: 'â˜•',
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
          icon: 'ðŸ§˜',
          category: 'self-care',
        },
        {
          label: 'Shower & dress',
          start: '07:10',
          end: '07:30',
          icon: 'ðŸš¿',
          category: 'self-care',
        },
        {
          label: 'Breakfast',
          start: '07:30',
          end: '08:00',
          icon: 'ðŸ¥£',
          category: 'self-care',
        },
      ],
      Study: [
        {
          label: 'Focus block',
          start: '09:00',
          end: '10:00',
          icon: 'ðŸ§ ',
          category: 'study',
        },
        {
          label: 'Short break',
          start: '10:00',
          end: '10:10',
          icon: 'â˜•',
          category: 'self-care',
        },
        {
          label: 'Focus block',
          start: '10:10',
          end: '11:00',
          icon: 'ðŸ§ ',
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
      <div className="flex gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-3 text-sm">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-slate-50">
          <span className="text-lg" aria-hidden>
            {block.icon || 'ðŸ”¹'}
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-slate-900 truncate">
                  {block.label}
                </p>
                {block.routine && (
                  <span className="text-[10px] rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                    {block.routine}
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-slate-500">
                {block.start} â€“ {block.end}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-[11px] text-slate-500">
              {isActive && (
                <span className="text-emerald-600">
                  Now Â· {minutesToCountdown(endM - nowMinutes)}
                </span>
              )}
              {block.done && <span>Done</span>}
            </div>
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                block.done
                  ? 'bg-emerald-500'
                  : 'bg-[hsl(142_72%_36%)]'
              }`}
              style={{ width: `${progressed}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            {!block.done && (
              <button
                onClick={() => toggleDone(block.id)}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-700 hover:bg-slate-50"
              >
                Mark done
              </button>
            )}
            {!block.started ? (
              <button
                onClick={() => startBlock(block.id)}
                className="rounded-full bg-[hsl(142_72%_36%)] px-2 py-0.5 text-white"
              >
                Start
              </button>
            ) : (
              <button
                onClick={() => stopBlock(block.id)}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-700 hover:bg-slate-50"
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
    const [icon, setIcon] = useState('ðŸ”¹');

    const submit = (e) => {
      e.preventDefault();
      if (!label.trim()) return;
      onAdd({ label: label.trim(), start, end, icon, category: 'other' });
      setLabel('');
    };

    return (
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:flex-row sm:items-center"
      >
        <input
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add block: Email 20m"
        />
        <div className="flex items-center gap-2">
          <input
            className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <span className="text-slate-400 text-xs">â†’</span>
          <input
            className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-xs"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
          <button className="rounded-lg bg-[hsl(142_72%_36%)] px-3 py-2 text-xs font-medium text-white">
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
          className="rounded-full border border-slate-200 px-3 py-1 text-slate-700 hover:bg-slate-50"
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
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white"
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
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {banner && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {banner}
          </div>
        )}

        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Visual timeline
            </h1>
            <p className="text-xs text-slate-500">
              Make time visible. Plan a few blocks and follow them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="rounded-full bg-white px-3 py-1 border border-slate-200 font-mono text-slate-700">
              Now: {minutesToTime(nowMinutes)}
            </div>
            <div className="flex rounded-full border border-slate-200 bg-white p-1">
              <button
                onClick={() => setView('day')}
                className={`rounded-full px-3 py-1 ${
                  view === 'day'
                    ? 'bg-[hsl(142_72%_36%)] text-white'
                    : 'text-slate-700'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setView('week')}
                className={`rounded-full px-3 py-1 ${
                  view === 'week'
                    ? 'bg-[hsl(142_72%_36%)] text-white'
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
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <h3 className="mb-2 text-sm font-medium text-slate-900">
                  Brain dump
                </h3>
                <BrainDump />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
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
                  <button
                    key={d.key}
                    className={`flex-1 rounded-lg px-2 py-2 text-left ${
                      isToday
                        ? 'bg-[hsl(142_72%_36%)] text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      if (!isToday) {
                        setView('day');
                      }
                    }}
                  >
                    <div className="text-[11px]">{d.label}</div>
                    <div className="mt-1 text-[10px] opacity-80">
                      {blocks.length === 0
                        ? 'â€“'
                        : `${blocks.length} block${blocks.length > 1 ? 's' : ''}`}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Only today is editable in this prototype. Use week view just to see
              how full your week is.
            </p>
          </section>
        )}

        <footer className="mt-8 text-[11px] text-slate-500">
          Hint: use concrete labels like â€œEmail prof 20mâ€ instead of â€œBe productiveâ€.
        </footer>
      </main>
    </div>
  );
};

export default VisualTimeline;
