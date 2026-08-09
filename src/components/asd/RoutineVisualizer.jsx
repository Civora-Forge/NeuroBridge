import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { getGeminiApiKey } from "@/features/socialCommunication/services/aiService";
import { useModuleAdaptation } from "@/hooks/useModuleAdaptation";
import { buildUserPreferencesFragment } from "@/support/framework/userPreferencesAdapter";
import {
  BREAKDOWN_DEFAULT_STEP_COUNT,
  ROUTINE_BREAKDOWN_MODULE_ID,
} from "@/support/modules/routineBreakdown/routineBreakdownTypes";
import {
  buildBreakdownConfig,
  buildBreakdownProgress,
  buildRoutineBreakdownPerformance,
  generateRoutineBreakdown,
} from "@/support/modules/routineBreakdown/routineBreakdownService";
import {
  CheckCircle2,
  Clock3,
  ListChecks,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
  X,
} from "lucide-react";

const TASK_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-950/50",    border: "border-blue-300 dark:border-blue-700",    accent: "bg-blue-500",    text: "text-blue-700 dark:text-blue-300"    },
  { bg: "bg-violet-100 dark:bg-violet-950/50", border: "border-violet-300 dark:border-violet-700", accent: "bg-violet-500",  text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-amber-100 dark:bg-amber-950/50",   border: "border-amber-300 dark:border-amber-700",   accent: "bg-amber-500",   text: "text-amber-700 dark:text-amber-300"   },
  { bg: "bg-emerald-100 dark:bg-emerald-950/50", border: "border-emerald-300 dark:border-emerald-700", accent: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-pink-100 dark:bg-pink-950/50",     border: "border-pink-300 dark:border-pink-700",     accent: "bg-pink-500",    text: "text-pink-700 dark:text-pink-300"     },
  { bg: "bg-teal-100 dark:bg-teal-950/50",     border: "border-teal-300 dark:border-teal-700",     accent: "bg-teal-500",    text: "text-teal-700 dark:text-teal-300"     },
  { bg: "bg-orange-100 dark:bg-orange-950/50", border: "border-orange-300 dark:border-orange-700", accent: "bg-orange-500",  text: "text-orange-700 dark:text-orange-300" },
];

const TASK_DEFAULT_SECONDS = 300;

function pad(n) { return String(n).padStart(2, "0"); }
function formatCountdown(s) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }

function deriveSignals(adjustments = []) {
  return {
    simplify: adjustments.some((adj) => adj.type === "SIMPLIFY" || adj.type === "REDUCE"),
    provideHints: adjustments.some((adj) => adj.type === "GUIDE" || adj.type === "DECOMPOSE"),
  };
}

export default function RoutineVisualizer({
  role, canManageRoutine, routines, loading,
  onAddTask, onToggleTask, onEditTask, onDeleteTask,
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const apiKey = getGeminiApiKey();

  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTime, setEditingTime] = useState("");
  const [justCompletedId, setJustCompletedId] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(TASK_DEFAULT_SECONDS);
  const timerRef = useRef(null);

  const [openBreakdownId, setOpenBreakdownId] = useState(null);
  const [breakdowns, setBreakdowns] = useState({});
  const [breakdownBusy, setBreakdownBusy] = useState(false);

  const canEditRoutine = typeof canManageRoutine === "boolean" ? canManageRoutine : role === "guardian";

  const userPreferences = useMemo(() => buildUserPreferencesFragment(user), [user]);

  const adaptation = useModuleAdaptation({
    moduleId: ROUTINE_BREAKDOWN_MODULE_ID,
    getSnapshot: useCallback(
      () => ({
        screen: "asd.routine-breakdown",
        session: {
          taskCount: routines.length,
          completedTasks: routines.filter((task) => task.is_completed).length,
        },
        userProfile: {
          accessibility: user?.accessibility ?? null,
          disorders: Array.isArray(user?.disorders) ? user.disorders : [],
        },
      }),
      [routines, user],
    ),
    userId,
    userPreferences,
  });

  const signals = useMemo(() => deriveSignals(adaptation.adjustments), [adaptation.adjustments]);

  const completion = useMemo(() => {
    if (!routines.length) return 0;
    return Math.round((routines.filter((t) => t.is_completed).length / routines.length) * 100);
  }, [routines]);

  const activeTask = useMemo(() => routines.find((t) => !t.is_completed) || null, [routines]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!activeTask) { setTimerSeconds(0); return; }
    setTimerSeconds(TASK_DEFAULT_SECONDS);
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => { if (prev <= 1) { clearInterval(timerRef.current); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [activeTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = (task) => {
    if (!task.is_completed) {
      setJustCompletedId(task.id);
      setTimeout(() => setJustCompletedId(null), 1200);
    }
    onToggleTask(task);
  };

  const timerPct = TASK_DEFAULT_SECONDS > 0 ? Math.round((timerSeconds / TASK_DEFAULT_SECONDS) * 100) : 0;
  const timerColor = timerPct > 60 ? "bg-emerald-500" : timerPct > 25 ? "bg-amber-400" : "bg-red-400";

  const handleBreakDown = useCallback(
    async (task) => {
      setOpenBreakdownId((current) => {
        if (current === task.id && breakdowns[task.id]) return null;
        return task.id;
      });
      if (breakdowns[task.id]) return;

      setBreakdownBusy(true);
      try {
        const config = buildBreakdownConfig({
          task: task.title,
          stepCount: BREAKDOWN_DEFAULT_STEP_COUNT,
          signals,
          variantSeed: 0,
        });
        const outcome = await generateRoutineBreakdown(task.title, config, { apiKey });
        setBreakdowns((current) => ({
          ...current,
          [task.id]: {
            taskId: task.id,
            breakdown: outcome.breakdown,
            source: outcome.source,
            fallbackIndex: 0,
            completedIds: [],
            aiError: outcome.aiError,
          },
        }));
      } finally {
        setBreakdownBusy(false);
      }
    },
    [breakdowns, apiKey, signals],
  );

  const handleRegenerateBreakdown = useCallback(
    async (task) => {
      const entry = breakdowns[task.id];
      const nextIndex = (entry?.fallbackIndex ?? 0) + 1;
      setBreakdownBusy(true);
      try {
        const config = buildBreakdownConfig({
          task: task.title,
          stepCount: BREAKDOWN_DEFAULT_STEP_COUNT,
          signals,
          variantSeed: nextIndex,
        });
        const outcome = await generateRoutineBreakdown(task.title, config, { apiKey });
        setBreakdowns((current) => ({
          ...current,
          [task.id]: {
            ...current[task.id],
            taskId: task.id,
            breakdown: outcome.breakdown,
            source: outcome.source,
            fallbackIndex: nextIndex,
            completedIds: [],
            aiError: outcome.aiError,
          },
        }));
      } finally {
        setBreakdownBusy(false);
      }
    },
    [breakdowns, apiKey, signals],
  );

  const handleToggleStep = useCallback((task, stepId) => {
    setBreakdowns((current) => {
      const entry = current[task.id];
      if (!entry) return current;
      const completedIds = entry.completedIds.includes(stepId)
        ? entry.completedIds.filter((id) => id !== stepId)
        : [...entry.completedIds, stepId];
      return { ...current, [task.id]: { ...entry, completedIds } };
    });
  }, []);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><Clock3 size={20} /> Routine Visualizer</CardTitle>
        <CardDescription>View your routine timeline and mark progress. Task management is guardian-only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">Completion {completion}%</Badge>
            <Badge variant="outline">{routines.length} tasks</Badge>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${completion}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
          </div>
        </div>

        {activeTask && (
          <motion.div key={activeTask.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide">Current Activity</p>
            <p className="text-lg font-bold">{activeTask.title}</p>
            {activeTask.time_label && <p className="text-sm text-muted-foreground">Scheduled: {activeTask.time_label}</p>}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Time remaining</span>
                <span className={`font-mono font-bold ${timerSeconds < 60 ? "text-red-500" : "text-foreground"}`}>{formatCountdown(timerSeconds)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <motion.div className={`h-full rounded-full ${timerColor}`} animate={{ width: `${timerPct}%` }} transition={{ duration: 0.8, ease: "linear" }} />
              </div>
            </div>
          </motion.div>
        )}

        {canEditRoutine && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="Task name" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <Input placeholder="Time (e.g., 08:30)" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} />
            <Button className="gap-2" onClick={() => { const t = taskTitle.trim(); if (!t) return; onAddTask({ title: t, timeLabel: taskTime.trim() }); setTaskTitle(""); setTaskTime(""); }}>
              <Plus size={16} /> Add Task
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading routine...</p>
        ) : (
          <div className="space-y-3">
            {routines.length === 0 && <p className="text-sm text-muted-foreground">No routine tasks yet.</p>}
            <AnimatePresence initial={false}>
              {routines.map((task, index) => {
                const color = TASK_COLORS[index % TASK_COLORS.length];
                const isActive = activeTask?.id === task.id;
                const isJustDone = justCompletedId === task.id;
                const entry = breakdowns[task.id] ?? null;
                const progress = entry ? buildBreakdownProgress(entry.breakdown?.steps, entry.completedIds) : null;
                return (
                  <motion.article
                    key={task.id} layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0, scale: isJustDone ? 1.02 : 1 }}
                    exit={{ opacity: 0, x: -30, transition: { duration: 0.25 } }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={`rounded-2xl border-2 transition-colors ${
                      task.is_completed
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-600"
                        : isJustDone ? "bg-emerald-100 dark:bg-emerald-900/50 border-emerald-500"
                        : isActive ? `${color.bg} ${color.border} ring-2 ring-offset-1 ring-blue-400/50`
                        : `${color.bg} ${color.border}`
                    }`}
                  >
                    <div className="p-4 flex items-center justify-between gap-3">
                      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white text-sm ${task.is_completed ? "bg-emerald-500" : color.accent}`}>
                        {task.is_completed ? <CheckCircle2 size={18} /> : index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingTaskId === task.id ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <Input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} placeholder="Task name" />
                            <Input value={editingTime} onChange={(e) => setEditingTime(e.target.value)} placeholder="Time" />
                          </div>
                        ) : (
                          <>
                            <p className={`font-semibold text-base ${task.is_completed ? "line-through text-muted-foreground" : color.text}`}>{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{task.time_label || "No time set"}</p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleBreakDown(task)}
                          disabled={breakdownBusy}
                          title="Break this task into steps"
                        >
                          <ListChecks size={14} />
                          {entry ? (openBreakdownId === task.id ? "Hide steps" : "Steps") : "Break down"}
                        </Button>
                        {canEditRoutine && editingTaskId === task.id ? (
                          <>
                            <Button size="sm" onClick={() => { const nt = editingTitle.trim(); if (!nt) return; onEditTask?.(task, { title: nt, time_label: editingTime.trim() || null }); setEditingTaskId(null); setEditingTitle(""); setEditingTime(""); }}>Save</Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingTaskId(null); setEditingTitle(""); setEditingTime(""); }}><X size={14} /></Button>
                          </>
                        ) : (
                          <>
                            {canEditRoutine && (
                              <Button size="sm" variant="ghost" onClick={() => { setEditingTaskId(task.id); setEditingTitle(task.title || ""); setEditingTime(task.time_label || ""); }}><Pencil size={14} /></Button>
                            )}
                            {canEditRoutine && (
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDeleteTask?.(task)}><Trash2 size={14} /></Button>
                            )}
                            <Button
                              size="sm"
                              variant={task.is_completed ? "secondary" : "default"}
                              className={`gap-1 min-w-[130px] ${task.is_completed ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300" : ""}`}
                              onClick={() => handleToggle(task)}
                            >
                              <CheckCircle2 size={14} />
                              {task.is_completed ? "✓ Completed" : "Mark Done"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {openBreakdownId === task.id && (
                      <AnimatePresence>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4 pb-4"
                        >
                          <div className="rounded-xl bg-white/60 dark:bg-slate-900/40 border border-muted p-4 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <p className="text-sm font-semibold">Steps for “{task.title}”</p>
                              {entry?.source && (
                                <Badge variant="outline" className="text-[10px]">
                                  {entry.source === "ai" ? "AI plan" : "Built-in plan"}
                                </Badge>
                              )}
                            </div>

                            {!entry ? (
                              <p className="text-sm text-muted-foreground">Building steps…</p>
                            ) : (
                              <>
                                {progress && progress.total > 0 && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span>{progress.completed} of {progress.total} done</span>
                                      <span>{Math.round(progress.completionRate * 100)}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                      <motion.div className="h-full rounded-full bg-emerald-500" animate={{ width: `${progress.completionRate * 100}%` }} />
                                    </div>
                                  </div>
                                )}

                                <ol className="space-y-2">
                                  {entry.breakdown?.steps.map((step) => {
                                    const done = entry.completedIds.includes(step.id);
                                    return (
                                      <li key={step.id}>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleStep(task, step.id)}
                                          className={`w-full rounded-xl border-2 p-3 flex items-start gap-3 text-left transition-colors ${
                                            done
                                              ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                                              : "border-muted hover:border-emerald-400/60"
                                          }`}
                                        >
                                          <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-400"}`}>
                                            {done && <CheckCircle2 size={13} />}
                                          </span>
                                          <span className="min-w-0">
                                            <span className={`block text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                                              {step.order + 1}. {step.title}
                                            </span>
                                            {step.description && (
                                              <span className="block text-xs text-muted-foreground mt-0.5">{step.description}</span>
                                            )}
                                            {step.estimatedEffort != null && (
                                              <span className="block text-[11px] text-muted-foreground mt-0.5">~{step.estimatedEffort} min</span>
                                            )}
                                          </span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ol>

                                {progress && progress.status === "completed" && (
                                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                    All steps done — you did it!
                                  </p>
                                )}

                                {entry.aiError && (
                                  <p className="text-xs text-muted-foreground">
                                    Showing a built-in plan; live steps will appear when the AI service is available.
                                  </p>
                                )}

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5"
                                  onClick={() => handleRegenerateBreakdown(task)}
                                  disabled={breakdownBusy}
                                >
                                  <RefreshCcw size={13} /> Try a different plan
                                </Button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </motion.article>
                );
              })}
            </AnimatePresence>
            {routines.length > 0 && completion === 100 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-400 p-5 text-center space-y-1">
                <p className="text-4xl">🎉</p>
                <p className="font-bold text-emerald-700 dark:text-emerald-300 text-lg">All done! Great job today!</p>
                <p className="text-sm text-muted-foreground">You completed every task. Be proud of yourself!</p>
              </motion.div>
            )}
          </div>
        )}

        {adaptation.adjustments.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {adaptation.adjustments.map((adj) => (
              <span
                key={adj.actionId ?? `${adj.target}:${adj.type}`}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground"
              >
                {adj.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
