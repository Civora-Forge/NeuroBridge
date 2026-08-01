"use client";

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useInterventionLifecycle } from "@/support/execution";
import {
  buildTaskBreakdownOutcome,
  generateTaskBreakdown,
  getTaskBreakdownProgress,
} from "@/support/modules/taskBreakdown/taskBreakdownService";
import {
  TASK_BREAKDOWN_MODULE_ID,
  TASK_BREAKDOWN_PRIORITIES,
  TASK_BREAKDOWN_STYLES,
} from "@/support/modules/taskBreakdown/taskBreakdownTypes";

const taskEmojis = ["book", "laptop", "calendar", "note", "target"];

const vibes = TASK_BREAKDOWN_PRIORITIES.map((label) => ({ label }));

const placeholders = [
  'Clean my room',
  'Study for tomorrow',
  'Reply to emails',
  'Organize my files',
  'Start that project',
  'Prepare a presentation',
];

  const motivationalMessages = {
  0: 'We only need one clear next step.',
  30: "You've built momentum.",
  60: "You're in a good groove.",
  100: 'Done is better than perfect.',
};

const TaskBreakdown = ({
  planId = null,
  contextSnapshotId = null,
  triggerSource = "manual",
  selectionMode = "explicit_request",
}) => {
  const { user } = useAuth();
  const [bigTask, setBigTask] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("book");
  const [selectedVibe, setSelectedVibe] = useState("Important");
  const [steps, setSteps] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState("Standard");
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [editingId, setEditingId] = useState(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerSecLeft, setTimerSecLeft] = useState(0);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [stepEdits, setStepEdits] = useState(0);
  const [stepReorders, setStepReorders] = useState(0);
  const [requestedStepCount, setRequestedStepCount] = useState(0);
  const [timerUsed, setTimerUsed] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const sessionKeyRef = useRef(null);
  const completionSentRef = useRef(false);

  const lifecycle = useInterventionLifecycle({
    userId: user?.id ?? null,
    moduleId: TASK_BREAKDOWN_MODULE_ID,
    planId,
    contextSnapshotId,
    triggerSource,
    selectionMode,
    configuration: { selectedStyle, priority: selectedVibe, requestedStepCount, timerEnabled: timerUsed },
  });

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

  const getDurationMs = () => sessionStartedAt ? Date.now() - sessionStartedAt : 0;
  const getProgress = () => getTaskBreakdownProgress(steps, completedSteps);

  const startBreakdown = async () => {
    if (lifecycle.hasStarted) return { ok: true, interventionId: lifecycle.interventionId };
    if (!user?.id) return { ok: false, reasonCodes: ["missing_authenticated_user"] };
    const result = await lifecycle.start({ idempotencyKey: sessionKeyRef.current });
    if (result.ok) setSessionStartedAt(Date.now());
    return result;
  };

  const discardActiveBreakdown = async () => {
    const progress = getProgress();
    if (lifecycle.hasStarted && !lifecycle.isTerminal && progress.completionRate < 1) {
      const result = await lifecycle.abandon("user_reset", {
        completedUnits: progress.completedUnits,
        totalUnits: progress.totalUnits,
        progressRatio: progress.completionRate,
        elapsedMs: getDurationMs(),
      });
      return result.ok;
    }
    return true;
  };

  const resetBreakdown = async () => {
    if (!(await discardActiveBreakdown())) return;
    setSteps([]);
    setCompletedSteps(new Set());
    setTimerActive(false);
    setTimerSecLeft(0);
    setStepEdits(0);
    setStepReorders(0);
    setRequestedStepCount(0);
    setTimerUsed(false);
    setSessionStartedAt(null);
    sessionKeyRef.current = null;
    completionSentRef.current = false;
    lifecycle.reset();
  };

  const generateBreakdown = async () => {
    if (!bigTask.trim()) return;
    if (!(await discardActiveBreakdown())) return;
    const generated = generateTaskBreakdown(bigTask, { selectedStyle, priority: selectedVibe });
    setSteps(generated);
    setCompletedSteps(new Set());
    setRequestedStepCount(generated.length);
    setStepEdits(0);
    setStepReorders(0);
    setTimerUsed(false);
    setSessionStartedAt(null);
    sessionKeyRef.current = `task-breakdown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    completionSentRef.current = false;
    lifecycle.reset();
  };

  const toggleStep = async (id) => {
    const updated = new Set(completedSteps);
    if (updated.has(id)) updated.delete(id);
    else updated.add(id);
    setCompletedSteps(updated);
    if (!user?.id) return;

    const started = await startBreakdown();
    if (!started.ok || lifecycle.isTerminal) return;
    const progress = getTaskBreakdownProgress(steps, updated);
    await lifecycle.progress({
      progressType: "task_step_update",
      completedUnits: progress.completedUnits,
      totalUnits: progress.totalUnits,
      progressRatio: progress.completionRate,
      elapsedMs: getDurationMs(),
      details: { stepId: id, completed: updated.has(id) },
    });
    if (progress.completionRate === 1 && !completionSentRef.current) {
      completionSentRef.current = true;
      await lifecycle.complete(buildTaskBreakdownOutcome({
        steps,
        completedStepIds: updated,
        selectedStyle,
        priority: selectedVibe,
        requestedStepCount,
        timerUsed,
        stepEdits,
        stepReorders,
        durationMs: getDurationMs(),
      }));
    }
  };

  const updateStepText = (id, newText) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, text: newText } : s)));
    setStepEdits((count) => count + 1);
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
    setStepReorders((count) => count + 1);
  };

  const startTiny = async () => {
    const firstIncomplete = steps.find((s) => !completedSteps.has(s.id));
    if (!firstIncomplete) return;
    if (user?.id) {
      const started = await startBreakdown();
      if (!started.ok) return;
    }
    const minutes = firstIncomplete.time || 5;
    setTimerActive(true);
    setTimerSecLeft(minutes * 60);
    setTimerUsed(true);
  };

  const progress = Math.round(getProgress().completionRate * 100);

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
              {TASK_BREAKDOWN_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={async () => {
                    setSelectedStyle(style);
                    if (steps.length && bigTask.trim()) {
                      if (!(await discardActiveBreakdown())) return;
                      const generated = generateTaskBreakdown(bigTask, { selectedStyle: style, priority: selectedVibe });
                      setSteps(generated);
                      setCompletedSteps(new Set());
                      setRequestedStepCount(generated.length);
                      completionSentRef.current = false;
                      lifecycle.reset();
                    }
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
            Describe one task that feels heavy. You will get a short, concrete checklist.
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
                onClick={startBreakdown}
                disabled={!user?.id || lifecycle.hasStarted || completedSteps.size >= steps.length}
                className="flex-1 rounded-xl bg-[hsl(142_72%_36%)] px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lifecycle.hasStarted ? "Breakdown started" : "Start this breakdown"}
              </button>
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

              <button
                onClick={resetBreakdown}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
              >
                Discard breakdown
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
                        disabled={lifecycle.isTerminal}
                        aria-label={`Mark step ${i + 1} ${done ? "incomplete" : "complete"}`}
                        className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center text-[10px] disabled:cursor-not-allowed ${
                          done
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {done ? "Done" : ""}
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
                            disabled={lifecycle.isTerminal}
                            className={`text-left text-sm disabled:cursor-not-allowed ${
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
                          disabled={i === 0 || lifecycle.isTerminal}
                          className="px-1 disabled:opacity-30"
                        >
                          Up
                        </button>
                        <button
                          onClick={() => moveStep(step.id, 'down')}
                          disabled={i === steps.length - 1 || lifecycle.isTerminal}
                          className="px-1 disabled:opacity-30"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-2 text-[11px] text-slate-500">
              Tip: Keep steps small enough that you would not procrastinate on them.
            </p>
            {!user?.id && (
              <p role="alert" className="text-xs text-amber-700">
                Sign in to save this breakdown's progress and outcome. You can still use the checklist locally.
              </p>
            )}
            {lifecycle.error && <p role="alert" className="text-xs text-red-700">{lifecycle.error}</p>}
            {lifecycle.isTerminal && (lifecycle.status === "completed" || lifecycle.status === "partially_completed") && (
              <TaskBreakdownRating lifecycle={lifecycle} />
            )}
          </section>
        )}
      </div>
    </div>
  );
};

function TaskBreakdownRating({ lifecycle }) {
  const [rating, setRating] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async () => {
    if (!rating) return;
    const result = await lifecycle.rate({
      rating,
      feedback,
      storeFeedback: Boolean(feedback.trim()),
    });
    if (result.ok) setSubmitted(true);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-2">
      <p className="font-semibold text-slate-800">How helpful was this breakdown?</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} aria-label={`Rate ${value}`} onClick={() => setRating(value)} className="rounded border px-2 py-1">
            {value}
          </button>
        ))}
      </div>
      <textarea value={feedback} maxLength={500} onChange={(event) => setFeedback(event.target.value)} placeholder="Optional feedback" className="w-full rounded border p-2" />
      <button disabled={!rating || submitted} onClick={submit} className="rounded bg-slate-800 px-3 py-1 text-white disabled:opacity-50">
        {submitted ? "Rating saved" : "Submit rating"}
      </button>
    </div>
  );
}

export default TaskBreakdown;
