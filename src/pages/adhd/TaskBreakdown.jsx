'use client';

import React, { useEffect, useState } from 'react';

// Constants & Templates
const taskEmojis = ['Ã°Å¸â€œÅ¡', 'Ã°Å¸â€™Â»', 'Ã°Å¸â€œÂ§', 'Ã°Å¸â€œÂ', 'Ã°Å¸Å½Â¯'];

const vibes = [
  { label: 'Urgent', icon: 'Ã¢Å¡Â¡', color: 'red' },
  { label: 'Important', icon: 'Ã¢Ëœâ€¦', color: 'amber' },
  { label: 'Low-energy', icon: 'Ã¢ËœÂ¾', color: 'indigo' },
  { label: 'Quick', icon: 'Ã¢ÂÂ±', color: 'emerald' },
];

const placeholders = [
  'Clean my room',
  'Study for tomorrow',
  'Reply to emails',
  'Organize my files',
  'Start that project',
  'Prepare a presentation',
];

const breakdownTemplates = {
  'Bare Minimum': (task) => [
    { text: `Define the absolute minimum for Ã¢â‚¬Å“${task}Ã¢â‚¬Â.`, time: 2 },
    { text: 'Set a 5Ã¢â‚¬â€˜minute timer and start.', time: 5 },
    { text: 'Complete one tiny chunk.', time: 5 },
    { text: 'Write where to continue next time.', time: 2 },
  ],
  Standard: (task) => [
    { text: `Clarify: what does Ã¢â‚¬Å“${task}Ã¢â‚¬Â mean in one sentence?`, time: 3 },
    { text: 'Gather materials and clear your workspace.', time: 5 },
    { text: 'Start the first microÃ¢â‚¬â€˜step (5Ã¢â‚¬â€œ10 minutes).', time: 10 },
    { text: 'Do one focused block.', time: 10 },
    { text: 'Pause, check progress, adjust next step.', time: 5 },
  ],
  'Hero Mode': (task) => [
    { text: `Write the ideal outcome for Ã¢â‚¬Å“${task}Ã¢â‚¬Â.`, time: 5 },
    { text: 'Break work into 3Ã¢â‚¬â€œ4 phases.', time: 5 },
    { text: 'List 2Ã¢â‚¬â€œ3 concrete actions for the first phase.', time: 5 },
    { text: 'Run a 25Ã¢â‚¬â€˜minute deepÃ¢â‚¬â€˜focus block.', time: 25 },
    { text: 'Review, then decide: continue or park.', time: 5 },
  ],
};

const motivationalMessages = {
  0: 'We only need one clear next step.',
  30: 'YouÃ¢â‚¬â„¢ve built momentum.',
  60: 'YouÃ¢â‚¬â„¢re in a good groove.',
  100: 'Done is better than perfect.',
};

const TaskBreakdown = () => {
  const [bigTask, setBigTask] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('Ã°Å¸â€œÅ¡');
  const [selectedVibe, setSelectedVibe] = useState('Important');
  const [steps, setSteps] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('Standard');
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [recentTasks, setRecentTasks] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSecLeft, setTimerSecLeft] = useState(0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  // Load recent tasks
  useEffect(() => {
    const saved = localStorage.getItem('taskBreakdownRecent');
    if (saved) {
      try {
        setRecentTasks(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Cycle placeholder
  useEffect(() => {
    const interval = setInterval(
      () => setPlaceholderIdx((i) => (i + 1) % placeholders.length),
      6000
    );
    return () => clearInterval(interval);
  }, []);

  // Timer
  useEffect(() => {
    if (!timerActive || timerSecLeft <= 0) return;
    const t = setTimeout(() => setTimerSecLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timerActive, timerSecLeft]);

  const saveToRecent = (task) => {
    const entry = { task, emoji: selectedEmoji, vibe: selectedVibe, timestamp: Date.now() };
    const updated = [entry, ...recentTasks.filter((t) => t.task !== task)].slice(0, 5);
    setRecentTasks(updated);
    localStorage.setItem('taskBreakdownRecent', JSON.stringify(updated));
  };

  const generateBreakdown = () => {
    if (!bigTask.trim()) return;
    const template = breakdownTemplates[selectedStyle];
    if (!template) return;
    const generated = template(bigTask.trim()).map((s, i) => ({ ...s, id: i }));
    setSteps(generated);
    setCompletedSteps(new Set());
    saveToRecent(bigTask.trim());
  };

  const toggleStep = (id) => {
    const updated = new Set(completedSteps);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setCompletedSteps(updated);
  };

  const updateStepText = (id, newText) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text: newText } : s)));
  };

  const moveStep = (id, direction) => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === steps.length - 1) return;
    const next = [...steps];
    const swapWith = direction === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    setSteps(next);
  };

  const startTiny = () => {
    const firstIncomplete = steps.find((s) => !completedSteps.has(s.id));
    if (!firstIncomplete) return;
    const minutes = firstIncomplete.time || 5;
    setTimerActive(true);
    setTimerSecLeft(minutes * 60);
  };

  const progress = steps.length
    ? Math.round((completedSteps.size / steps.length) * 100)
    : 0;

  const motivational =
    Object.entries(motivationalMessages)
      .sort((a, b) => parseInt(b[0], 10) - parseInt(a[0], 10))
      .find(([threshold]) => progress >= parseInt(threshold, 10))?.[1] ||
    motivationalMessages[0];

  const timerDisplay = `${Math.floor(timerSecLeft / 60)
    .toString()
    .padStart(2, '0')}:${(timerSecLeft % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <span className="text-xl">{selectedEmoji}</span>
              <span>Task breakdown</span>
            </h2>
            <p className="text-xs text-slate-500">
              Turn one vague task into a short, clear sequence of steps.
            </p>
          </div>
          {steps.length > 0 && (
            <div className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs text-slate-700">
              Progress: {progress}%
            </div>
          )}
        </header>

        {/* Recent tasks */}
        {recentTasks.length > 0 && !steps.length && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs">
            <div className="mb-2 font-semibold text-slate-800">
              Recent tasks
            </div>
            <div className="flex flex-wrap gap-2">
              {recentTasks.map((t) => (
                <button
                  key={t.timestamp}
                  onClick={() => {
                    setBigTask(t.task);
                    setSelectedEmoji(t.emoji);
                    setSelectedVibe(t.vibe);
                  }}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {t.emoji} {t.task.length > 24 ? `${t.task.slice(0, 24)}Ã¢â‚¬Â¦` : t.task}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Task input card */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
          {/* Emoji + style row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {taskEmojis.map((e) => (
                <button
                  key={e}
                  onClick={() => setSelectedEmoji(e)}
                  className={`h-9 w-9 rounded-lg text-lg flex items-center justify-center ${
                    selectedEmoji === e
                      ? 'bg-[hsl(142_72%_36%)] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>

            <div className="flex gap-2 text-xs">
              {Object.keys(breakdownTemplates).map((style) => (
                <button
                  key={style}
                  onClick={() => {
                    setSelectedStyle(style);
                    if (!bigTask.trim()) return;
                    const template = breakdownTemplates[style];
                    const generated = template(bigTask.trim()).map((s, i) => ({
                      ...s,
                      id: i,
                    }));
                    setSteps(generated);
                    setCompletedSteps(new Set());
                  }}
                  className={`rounded-full border px-3 py-1 ${
                    selectedStyle === style
                      ? 'border-[hsl(142_72%_36%)] bg-[hsl(142_72%_36%)] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Task textarea */}
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-[hsl(142_72%_36%)] focus:ring-2 focus:ring-[hsl(142_72%_36%)]/20 resize-none"
            rows={2}
            placeholder={placeholders[placeholderIdx]}
            value={bigTask}
            onChange={(e) => setBigTask(e.target.value)}
          />

          {/* Vibe + CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap gap-2">
              {vibes.map((v) => (
                <button
                  key={v.label}
                  onClick={() => setSelectedVibe(v.label)}
                  className={`rounded-full border px-3 py-1 flex items-center gap-1 ${
                    selectedVibe === v.label
                      ? 'border-[hsl(142_72%_36%)] bg-[hsl(142_72%_36%)] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{v.icon}</span>
                  <span>{v.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={generateBreakdown}
              className="rounded-lg bg-[hsl(142_72%_36%)] px-4 py-2 text-xs font-semibold text-white hover:bg-[hsl(142_72%_32%)]"
            >
              Break into steps
            </button>
          </div>
        </section>

        {/* When no steps yet */}
        {!steps.length && (
          <div className="text-center text-sm text-slate-500 py-8">
            Describe one task that feels heavy. YouÃ¢â‚¬â„¢ll get a short, concrete checklist.
          </div>
        )}

        {/* Steps + progress */}
        {steps.length > 0 && (
          <section className="space-y-4">
            {/* Progress */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Progress</span>
                <span className="font-mono text-slate-800">{progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[hsl(142_72%_36%)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-slate-600">{motivational}</p>
            </div>

            {/* Start tiny + timer */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                disabled={completedSteps.size >= steps.length}
                onClick={startTiny}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium ${
                  completedSteps.size >= steps.length
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border-[hsl(142_72%_36%)] text-[hsl(142_72%_36%)] hover:bg-[hsl(142_72%_36%)]/5'
                }`}
              >
                Focus on the next step
              </button>

              {timerActive && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <span className="font-mono text-slate-800">{timerDisplay}</span>
                  <button
                    onClick={() => setTimerActive(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Stop timer
                  </button>
                </div>
              )}
            </div>

            {/* Steps list */}
            <div className="space-y-2">
              {steps.map((step, i) => {
                const done = completedSteps.has(step.id);
                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border px-3 py-3 text-sm transition ${
                      done
                        ? 'border-emerald-200 bg-emerald-50/60 opacity-80'
                        : 'border-slate-200 bg-white hover:border-[hsl(142_72%_36%)]/40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleStep(step.id)}
                        className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center text-[10px] ${
                          done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {done ? 'Ã¢Å“â€œ' : ''}
                      </button>

                      <div className="flex-1 min-w-0">
                        {editingId === step.id ? (
                          <input
                            autoFocus
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-[hsl(142_72%_36%)] focus:ring-2 focus:ring-[hsl(142_72%_36%)]/20"
                            value={step.text}
                            onChange={(e) => updateStepText(step.id, e.target.value)}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingId(step.id)}
                            className={`text-left text-sm ${
                              done ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {step.text}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="rounded-md bg-slate-50 px-2 py-1 font-mono">
                          {step.time}m
                        </span>
                        <button
                          onClick={() => moveStep(step.id, 'up')}
                          disabled={i === 0}
                          className="px-1 disabled:opacity-30"
                        >
                          Ã¢â€ â€˜
                        </button>
                        <button
                          onClick={() => moveStep(step.id, 'down')}
                          disabled={i === steps.length - 1}
                          className="px-1 disabled:opacity-30"
                        >
                          Ã¢â€ â€œ
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-2 text-[11px] text-slate-500">
              Tip: Keep steps small enough that you wouldnÃ¢â‚¬â„¢t procrastinate on them.
            </p>
          </section>
        )}
      </div>
    </div>
  );
};

export default TaskBreakdown;
