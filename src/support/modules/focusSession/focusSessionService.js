import { getRole4InterventionHistory } from "@/support/persistence/role4Repository";
import { FOCUS_SESSION_DEFAULTS, FOCUS_SESSION_MODES, FOCUS_SESSION_MODULE_ID } from "./focusSessionTypes";

export function validateFocusSessionConfiguration(configuration = {}) {
  const plannedDurationMinutes = Number.isInteger(configuration.plannedDurationMinutes) && configuration.plannedDurationMinutes > 0 ? configuration.plannedDurationMinutes : FOCUS_SESSION_DEFAULTS.plannedDurationMinutes;
  const breakDurationMinutes = Number.isInteger(configuration.breakDurationMinutes) && configuration.breakDurationMinutes >= 0 ? configuration.breakDurationMinutes : FOCUS_SESSION_DEFAULTS.breakDurationMinutes;
  const mode = FOCUS_SESSION_MODES.includes(configuration.mode) ? configuration.mode : "focus";
  return { plannedDurationMinutes, breakDurationMinutes, breakEnabled: configuration.breakEnabled ?? FOCUS_SESSION_DEFAULTS.breakEnabled, soundEnabled: configuration.soundEnabled ?? FOCUS_SESSION_DEFAULTS.soundEnabled, mode };
}
export const durationToSeconds = (minutes) => Math.max(0, Math.floor(minutes * 60));
export const elapsedSeconds = (total, remaining) => Math.max(0, total - Math.max(0, remaining));
export const completionRatio = (total, remaining) => total > 0 ? Math.min(1, elapsedSeconds(total, remaining) / total) : 0;
export function buildFocusSessionOutcome({ configuration, secondsRemaining, pauseCount = 0, resumeCount = 0, interruptions = 0, completedNaturally = false, breakStarted = false, breakCompleted = false } = {}) {
  const finalConfiguration = validateFocusSessionConfiguration(configuration);
  const totalSeconds = durationToSeconds(finalConfiguration.plannedDurationMinutes);
  const actualDurationMs = elapsedSeconds(totalSeconds, secondsRemaining) * 1000;
  const ratio = completionRatio(totalSeconds, secondsRemaining);
  return { completionStatus: completedNaturally ? "completed" : "partially_completed", durationMs: actualDurationMs, metrics: { plannedDurationMinutes: finalConfiguration.plannedDurationMinutes, breakDurationMinutes: finalConfiguration.breakDurationMinutes, mode: finalConfiguration.mode, actualDurationMs, secondsRemaining: Math.max(0, Number(secondsRemaining) || 0), pauseCount, resumeCount, completionRatio: ratio, interruptions, completedNaturally, breakStarted, breakCompleted }, finalConfiguration };
}

const TERMINAL_STATUSES = new Set(["completed", "partially_completed", "abandoned"]);

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function localDay(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfLocalWeek(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export function normalizeFocusSessionHistory(entries = []) {
  return entries.map((entry) => {
    const intervention = entry?.intervention ?? {};
    const lifecycleEvents = Array.isArray(entry?.lifecycleEvents) ? entry.lifecycleEvents : [];
    const outcomes = Array.isArray(entry?.outcomes) ? entry.outcomes : [];
    const outcome = outcomes.find((item) => TERMINAL_STATUSES.has(item?.status)) ?? null;
    const finalConfiguration = outcome?.metrics?.finalConfiguration ?? {};
    const parameters = intervention.parameters ?? {};
    const metrics = outcome?.metrics ?? {};
    const startedAt = lifecycleEvents.find((event) => event?.toStatus === "started")?.createdAt ?? intervention.createdAt ?? null;
    const endedAt = outcome?.createdAt ?? lifecycleEvents.find((event) => TERMINAL_STATUSES.has(event?.toStatus))?.createdAt ?? null;
    const plannedDurationMinutes = finiteNumber(finalConfiguration.plannedDurationMinutes ?? metrics.plannedDurationMinutes ?? parameters.plannedDurationMinutes, 0);
    const actualDurationMs = finiteNumber(outcome?.durationMs ?? metrics.actualDurationMs, 0);
    const completionRatio = Math.max(0, Math.min(1, finiteNumber(metrics.completionRatio, outcome?.status === "completed" ? 1 : 0)));
    return {
      id: intervention.id,
      userId: intervention.userId,
      timestamp: endedAt ?? startedAt,
      startedAt,
      endedAt,
      plannedDurationMinutes,
      breakDurationMinutes: finiteNumber(finalConfiguration.breakDurationMinutes ?? metrics.breakDurationMinutes ?? parameters.breakDurationMinutes, 0),
      mode: finalConfiguration.mode ?? metrics.mode ?? parameters.mode ?? "focus",
      actualDurationMs,
      secondsRemaining: Math.max(0, finiteNumber(metrics.secondsRemaining, Math.max(0, plannedDurationMinutes * 60 - Math.floor(actualDurationMs / 1000)))),
      completionRatio,
      status: outcome?.status ?? intervention.status ?? null,
      completedNaturally: metrics.completedNaturally === true,
      pauseCount: Math.max(0, finiteNumber(metrics.pauseCount)),
      resumeCount: Math.max(0, finiteNumber(metrics.resumeCount)),
      triggerSource: parameters.execution?.triggerSource ?? null,
      selectionMode: parameters.execution?.selectionMode ?? null,
      rating: outcome?.rating ?? null,
    };
  });
}

export async function getFocusSessionHistory(userId, options = {}) {
  const entries = await getRole4InterventionHistory(userId, { moduleId: FOCUS_SESSION_MODULE_ID }, options);
  return normalizeFocusSessionHistory(entries);
}

export function deriveFocusSessionStats(history = [], now = new Date()) {
  const terminalFocusSessions = history.filter((record) => TERMINAL_STATUSES.has(record.status) && record.mode === "focus");
  const qualifying = terminalFocusSessions.filter((record) => record.status === "completed" || record.completionRatio >= 0.9);
  const today = localDay(now);
  const weekStart = startOfLocalWeek(now).getTime();
  const focusedMinutes = (records) => Math.round(records.reduce((sum, record) => sum + record.actualDurationMs, 0) / 60000);
  const todayRecords = qualifying.filter((record) => localDay(record.timestamp) === today);
  const weekRecords = qualifying.filter((record) => {
    const timestamp = new Date(record.timestamp).getTime();
    return Number.isFinite(timestamp) && timestamp >= weekStart && timestamp <= now.getTime();
  });
  const days = new Set(qualifying.map((record) => localDay(record.timestamp)).filter(Boolean));
  const latestDay = [...days].filter((day) => day <= today).sort().at(-1) ?? null;
  let streak = 0;
  if (latestDay) {
    const cursor = new Date(`${latestDay}T00:00:00`);
    while (days.has(localDay(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  return {
    terminalFocusSessions,
    qualifying,
    todaySessions: todayRecords.length,
    todayFocusedMinutes: focusedMinutes(todayRecords),
    weeklyFocusedMinutes: focusedMinutes(weekRecords),
    streak,
  };
}

export function deriveFocusDurationTrends(history = []) {
  const groups = new Map([15, 25, 45].map((minutes) => [minutes, { minutes, sessions: 0, completed: 0, completionTotal: 0 }]));
  for (const record of history) {
    if (!TERMINAL_STATUSES.has(record.status) || record.mode !== "focus") continue;
    const group = groups.get(record.plannedDurationMinutes);
    if (!group) continue;
    group.sessions += 1;
    group.completionTotal += record.completionRatio;
    if (record.completionRatio >= 0.9) group.completed += 1;
  }
  const rows = [...groups.values()].map((group) => ({
    ...group,
    completionRate: group.sessions ? group.completed / group.sessions : 0,
    averageCompletion: group.sessions ? group.completionTotal / group.sessions : 0,
  }));
  const eligible = rows.filter((row) => row.sessions >= 2).sort((left, right) => right.completionRate - left.completionRate || right.averageCompletion - left.averageCompletion || right.sessions - left.sessions);
  const best = eligible[0] ?? null;
  const secondBest = eligible[1] ?? null;
  return {
    rows,
    best: best && (!secondBest || best.completionRate - secondBest.completionRate >= 0.15) ? best : null,
    hasEvidence: eligible.length > 0,
  };
}

export async function seedFocusSessionDemoHistory(userId) {
  if (!import.meta.env.DEV) throw new Error("Focus Session demo seeding is only available in development");
  const { abandonSupportModule, completeSupportModule, executeSupportModule } = await import("@/support/execution");
  const plan = [
    ...Array.from({ length: 5 }, (_, index) => ({ minutes: 15, completed: index < 2 })),
    ...Array.from({ length: 10 }, (_, index) => ({ minutes: 25, completed: index < 8 })),
    ...Array.from({ length: 4 }, (_, index) => ({ minutes: 45, completed: index === 0 })),
  ];
  const results = [];
  for (const item of plan) {
    const configuration = { plannedDurationMinutes: item.minutes, breakDurationMinutes: 5, mode: "focus" };
    const started = await executeSupportModule({ userId, moduleId: FOCUS_SESSION_MODULE_ID, contextSnapshotId: null, triggerSource: "manual", selectionMode: "explicit_request", configuration, metadata: { developmentSeed: true } });
    const outcome = buildFocusSessionOutcome({ configuration, secondsRemaining: item.completed ? 0 : Math.ceil(item.minutes * 60 * 0.75), completedNaturally: item.completed });
    results.push(item.completed
      ? await completeSupportModule({ userId, interventionId: started.interventionId, moduleId: FOCUS_SESSION_MODULE_ID, outcome })
      : await abandonSupportModule({ userId, interventionId: started.interventionId, moduleId: FOCUS_SESSION_MODULE_ID, outcome }));
  }
  return results;
}
