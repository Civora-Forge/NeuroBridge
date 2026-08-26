"use client";

import React, { useEffect, useRef, useState } from "react";
import { Brain, Check, ChevronDown, ChevronUp, ClipboardCheck, Clock3, Heart, Pencil, Play, Rocket, RotateCcw, Sparkles, Target } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import SupportToolThemeProvider from "@/theme/SupportToolThemeProvider";
import SupportToolLayout from "@/components/support/SupportToolLayout";
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
  const location = useLocation();
  const aiData = location.state || null;
  const { user } = useAuth();
  const [bigTask, setBigTask] = useState(aiData?.original_task || "");
  const [selectedVibe, setSelectedVibe] = useState("Important");
  const [planningOpen, setPlanningOpen] = useState(false);
  const [steps, setSteps] = useState(aiData?.steps || []);
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
    setPlanningOpen(false);
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
    <SupportToolThemeProvider theme="adhd_focus">
    <SupportToolLayout className="!m-0 !w-full !max-w-none !gap-0 !p-0">
      <div className="w-full bg-[#fffefa] px-4 py-4 text-[#202036] sm:px-8 sm:py-5 lg:px-[6vw]">
        <header className="relative mx-auto mb-5 max-w-6xl sm:mb-6">
          <div className="max-w-3xl"><p className="inline-flex items-center gap-2 rounded-full bg-[#edf6e6] px-4 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#397348]"><Sparkles size={16} className="text-[#4ba65b]" /> CLEAR THE RUNWAY</p><h1 className="mt-3 text-5xl font-black leading-[.9] tracking-tight text-[#1d2033] sm:text-6xl">Task <span className="text-[#4aa660]">breakdown</span></h1><p className="mt-3 text-lg font-medium tracking-tight text-slate-700 sm:text-xl">Turn one vague task into a short, clear sequence of steps.</p></div>
          <div className="absolute right-[8%] top-0 hidden text-[#8056ea] lg:block"><ClipboardCheck size={150} strokeWidth={1.4} /><Pencil className="absolute -left-9 bottom-7 rotate-[-12deg] text-[#f1b633]" size={57} /><Sparkles className="absolute -right-10 top-3 text-[#f1c936]" size={30} /><Heart className="absolute -right-10 bottom-9 text-[#c89af4]" size={38} /></div>
          {steps.length > 0 && <div className="absolute right-0 top-0 rounded-full bg-[#eaf5e8] px-4 py-2 text-xs font-black text-[#397348]">Progress: {progress}%</div>}
        </header>

        {!steps.length && <section className="relative mx-auto mb-5 max-w-5xl overflow-hidden rounded-[2rem] border border-[#91d5a5] bg-gradient-to-br from-white via-[#fbfff9] to-[#f4fff2] p-5 shadow-[8px_9px_0_#a4dca1] sm:p-6"><span className="absolute -left-9 top-4 h-12 w-12 rounded-full border-4 border-[#d9efaa]" /><Sparkles className="absolute right-8 top-7 text-[#63b957]" size={30} /><div className="relative"><div className="flex items-center gap-4"><span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-[#94d37c] to-[#4ba65b] text-2xl font-black text-white shadow-md">1</span><p className="text-lg font-black uppercase tracking-[0.12em] text-[#397348] sm:text-xl">Step 1: Name the task</p></div><p className="mt-3 text-base font-medium text-slate-700 sm:ml-14 sm:text-lg">You do not need to solve it yet. Just tell me what is on your mind. <Heart className="inline text-[#5caf5c]" size={22} /></p><div className="mt-4 sm:ml-14"><div className="relative"><textarea className="w-full resize-none rounded-3xl border-2 border-[#72c38c] bg-white px-5 py-4 pr-14 text-base font-medium text-slate-900 shadow-[0_4px_0_#daf0d9] outline-none placeholder:text-slate-400 focus:border-[#4ba65b]" rows={1} placeholder={`e.g. ${placeholders[placeholderIdx]}`} value={bigTask} onChange={(e) => setBigTask(e.target.value)} /><Pencil className="absolute right-5 top-1/2 -translate-y-1/2 text-[#4ba65b]" size={28} /></div><div className="mt-4 flex flex-wrap items-center gap-5"><button onClick={generateBreakdown} disabled={!bigTask.trim()} className="inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#66ba69] to-[#4da661] px-5 py-3 text-base font-black text-white shadow-[4px_5px_0_#d0e9cc] disabled:cursor-not-allowed disabled:opacity-45"><Rocket size={22} /> Break into steps</button><p className="text-sm font-bold text-[#5ca651]">← Let&apos;s break it down!</p></div></div></div></section>}

        {/* When no steps yet */}
        {!steps.length && <section className="relative mx-auto grid max-w-4xl grid-cols-[auto_1fr_auto] items-center gap-5 rounded-[2rem] border-2 border-dashed border-[#d4bcff] bg-[#fdfaff] px-6 py-7 text-center sm:px-10"><Target className="h-16 w-16 text-[#9b72f0] sm:h-24 sm:w-24" /><div><p className="text-lg font-black uppercase tracking-[0.12em] text-[#6e3ed2] sm:text-2xl">One thing at a time</p><p className="mt-3 text-sm font-medium text-slate-700 sm:text-lg">Describe one task that feels heavy.<br />You will get a <span className="font-black text-[#55359a] underline decoration-[#bb9cf0] decoration-4 underline-offset-4">short, concrete checklist.</span></p></div><Brain className="h-16 w-16 text-[#c79bf2] sm:h-24 sm:w-24" /></section>}

        {/* Generated task dashboard */}
        {steps.length > 0 && (
          <section className="mx-auto max-w-5xl space-y-5">
            <div className="overflow-hidden rounded-[2rem] border-2 border-[#bfe2b8] bg-white shadow-[7px_8px_0_#cfeac9]">
              <div className="flex flex-col gap-4 bg-[#eff9ed] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#397348]">Your clear runway</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-[#1d2033] sm:text-3xl">{bigTask}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-600">{steps.length} small steps. You only need to do the next one.</p>
                </div>
                <button onClick={() => setPlanningOpen((open) => !open)} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border-2 border-[#86c882] bg-white px-3 py-2 text-xs font-black text-[#397348] hover:bg-[#f7fff5] sm:self-auto">
                  Plan settings <ChevronDown size={15} className={planningOpen ? "rotate-180" : ""} />
                </button>
              </div>
              {planningOpen && <div className="grid gap-4 border-b border-[#d9efd5] bg-[#fbfffa] px-5 py-4 sm:grid-cols-2 sm:px-7"><label className="text-xs font-black uppercase tracking-[0.1em] text-[#397348]">Breakdown style<select value={selectedStyle} onChange={(event) => setSelectedStyle(event.target.value)} className="mt-2 block w-full rounded-xl border-2 border-[#bfe2b8] bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none"><option>{TASK_BREAKDOWN_STYLES[0]}</option><option>{TASK_BREAKDOWN_STYLES[1]}</option><option>{TASK_BREAKDOWN_STYLES[2]}</option></select></label><label className="text-xs font-black uppercase tracking-[0.1em] text-[#397348]">Priority<select value={selectedVibe} onChange={(event) => setSelectedVibe(event.target.value)} className="mt-2 block w-full rounded-xl border-2 border-[#bfe2b8] bg-white px-3 py-2 text-sm font-semibold normal-case tracking-normal text-slate-700 outline-none">{vibes.map(({ label }) => <option key={label}>{label}</option>)}</select></label></div>}
              <div className="grid gap-5 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-7">
                <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.14em] text-[#397348]">Runway progress</span><span className="rounded-full bg-[#dff1da] px-3 py-1 text-xs font-black text-[#397348]">{progress}%</span></div><div className="h-4 w-full overflow-hidden rounded-full bg-[#e3f1df]"><div className="h-full rounded-full bg-gradient-to-r from-[#77c76c] to-[#4ba65b] transition-all" style={{ width: `${progress}%` }} /></div><p className="text-sm font-bold text-slate-600">{motivational}</p></div>
                <div className="flex flex-wrap gap-2"><button onClick={startBreakdown} disabled={!user?.id || lifecycle.hasStarted || completedSteps.size >= steps.length} className="inline-flex items-center gap-2 rounded-xl bg-[#4ba65b] px-4 py-3 text-sm font-black text-white shadow-[3px_4px_0_#b9dfb3] disabled:cursor-not-allowed disabled:opacity-50"><Play size={16} fill="currentColor" />{lifecycle.hasStarted ? "Breakdown started" : "Start this breakdown"}</button><button disabled={completedSteps.size >= steps.length} onClick={startTiny} className="inline-flex items-center gap-2 rounded-xl border-2 border-[#7bbd75] bg-white px-4 py-3 text-sm font-black text-[#397348] disabled:cursor-not-allowed disabled:opacity-50"><Clock3 size={16} />Focus on the next step</button><button onClick={resetBreakdown} className="inline-flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"><RotateCcw size={16} />Discard breakdown</button></div>
              </div>
              {timerActive && (
                 <div className="mx-5 mb-5 flex items-center justify-between gap-3 rounded-xl border-2 border-[#f3c95c] bg-[#fff9df] px-4 py-3 text-sm sm:mx-7">
                  <span className="inline-flex items-center gap-2 font-mono font-black text-[#76520a]"><Clock3 size={17} />{timerDisplay}</span>
                  <button
                    onClick={() => setTimerActive(false)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Stop timer
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {steps.map((step, i) => {
                const done = completedSteps.has(step.id);
                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border-2 px-4 py-4 text-sm transition sm:px-5 ${
                      done
                        ? 'border-[#a9d7a2] bg-[#f0faee] opacity-80'
                           : 'border-[#dce9d9] bg-white hover:border-[#82c77a] hover:shadow-[4px_4px_0_#dcefd8]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleStep(step.id)}
                        disabled={lifecycle.isTerminal}
                        aria-label={`Mark step ${i + 1} ${done ? "incomplete" : "complete"}`}
                        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[10px] disabled:cursor-not-allowed ${
                          done
                              ? 'border-[#4ba65b] bg-[#4ba65b] text-white'
                            : 'border-[#a5cda0] bg-white text-transparent'
                        }`}
                      >
                        {done ? <Check size={16} strokeWidth={4} /> : ""}
                      </button>

                      <div className="flex-1 min-w-0">
                        {editingId === step.id ? (
                          <input
                            autoFocus
                            className="w-full rounded-md border-2 border-[#FF6F61] px-2 py-1 text-xs focus:border-[#7A2E27] focus:ring-2 focus:ring-[#FFE2DE]"
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
                              done ? 'line-through text-slate-400' : 'font-black text-slate-900'
                            }`}
                          >
                            {step.text}
                          </button>
                        )}
                      </div>

                       <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1bd] px-2 py-1 font-mono font-bold text-[#76520a]">
                          <Clock3 size={12} />
                           {step.time}m
                        </span>
                        <button
                          onClick={() => moveStep(step.id, 'up')}
                          disabled={i === 0 || lifecycle.isTerminal}
                          aria-label={`Move step ${i + 1} up`}
                          className="rounded p-1 hover:bg-[#e8f5e5] disabled:opacity-30"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          onClick={() => moveStep(step.id, 'down')}
                          disabled={i === steps.length - 1 || lifecycle.isTerminal}
                          aria-label={`Move step ${i + 1} down`}
                          className="rounded p-1 hover:bg-[#e8f5e5] disabled:opacity-30"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-2 text-center text-[11px] font-medium text-slate-500">
              Tip: Keep steps small enough that you would not procrastinate on them.
            </p>
            {!user?.id && (
              <p role="alert" className="text-xs text-[#7A2E27]">
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
    </SupportToolLayout>
    </SupportToolThemeProvider>
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
    <div className="rounded-[1.5rem] border-2 border-[#d4bcff] bg-[#fdfaff] p-5 text-sm shadow-[4px_4px_0_#e6d9ff] space-y-3">
      <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#6e3ed2]">Nice work finishing</p><p className="mt-1 font-black text-[#2d2442]">How helpful was this breakdown?</p></div>
      <div className="flex gap-2" aria-label="Helpful rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} aria-label={`Rate ${value}`} onClick={() => setRating(value)} className={`grid h-9 w-9 place-items-center rounded-full border-2 font-black transition ${rating === value ? "border-[#7b52db] bg-[#7b52db] text-white" : "border-[#cbb4f4] bg-white text-[#6e3ed2] hover:bg-[#eee6ff]"}`}>
            {value}
          </button>
        ))}
      </div>
      <textarea value={feedback} maxLength={500} onChange={(event) => setFeedback(event.target.value)} placeholder="Optional feedback" className="w-full rounded-xl border-2 border-[#ded1f7] bg-white p-3 text-sm outline-none focus:border-[#9b72f0]" />
      <button disabled={!rating || submitted} onClick={submit} className="rounded-xl bg-[#7b52db] px-4 py-2 text-sm font-black text-white shadow-[2px_3px_0_#d2c0f2] disabled:opacity-50">
        {submitted ? "Rating saved" : "Submit rating"}
      </button>
    </div>
  );
}

export default TaskBreakdown;
