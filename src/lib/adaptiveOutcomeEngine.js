const ANXIETY_LOG_PREFIX = "anxiety-tracker-logs-v2_";
const REFRAME_PREFIX = "anxiety-reframe-history-v1_";
const ACTIVITY_PREFIX = "nb_sync_activity_";
const ALERT_PREFIX = "nb_sync_alerts_";
const NOTES_PREFIX = "nb_sync_notes_";
const TASKS_KEY = "nb_guardian_ward_tasks";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function toTimestamp(value) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function withinDays(value, days = 7) {
  const ts = toTimestamp(value);
  if (!ts) return false;
  return ts >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function toTimeWindow(value) {
  const ts = toTimestamp(value);
  if (!ts) return "Unknown";
  const hour = new Date(ts).getHours();
  if (hour >= 5 && hour <= 11) return "Morning";
  if (hour >= 12 && hour <= 16) return "Afternoon";
  if (hour >= 17 && hour <= 21) return "Evening";
  return "Night";
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function analyzeAnxiety(targetId) {
  const logs = readJson(`${ANXIETY_LOG_PREFIX}${targetId}`, []).filter((entry) => entry && typeof entry === "object");
  const reframes = readJson(`${REFRAME_PREFIX}${targetId}`, []).filter((entry) => entry && typeof entry === "object");

  const recentLogs = logs.filter((entry) => withinDays(entry.loggedAt || entry.createdAt, 7));
  const sortedRecent = [...recentLogs].sort(
    (left, right) => toTimestamp(right.loggedAt || right.createdAt) - toTimestamp(left.loggedAt || left.createdAt),
  );

  const latest3 = sortedRecent.slice(0, 3).map((entry) => Number(entry.level || 0));
  const previous3 = sortedRecent.slice(3, 6).map((entry) => Number(entry.level || 0));
  const trendDelta = Number((average(latest3) - average(previous3)).toFixed(2));

  const windowCounts = recentLogs.reduce(
    (acc, entry) => {
      const key = toTimeWindow(entry.loggedAt || entry.createdAt);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { Morning: 0, Afternoon: 0, Evening: 0, Night: 0, Unknown: 0 },
  );

  const highestWindow = Object.entries(windowCounts)
    .sort((left, right) => right[1] - left[1])[0]?.[0] || "Unknown";

  const topTrigger = Object.entries(
    recentLogs.reduce((acc, entry) => {
      const key = String(entry.trigger || "").trim().toLowerCase();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  ).sort((left, right) => right[1] - left[1])[0]?.[0] || "n/a";

  const recentReframes = reframes.filter((entry) => withinDays(entry.createdAt, 7));
  const matchedReframes = recentReframes.filter(
    (entry) => entry.matchLabel && entry.matchLabel !== "No keyword match",
  ).length;
  const reframeMatchRate = recentReframes.length
    ? Number((matchedReframes / recentReframes.length).toFixed(2))
    : 0;

  return {
    logCount7d: recentLogs.length,
    avgLevel7d: Number(average(recentLogs.map((entry) => Number(entry.level || 0))).toFixed(2)),
    trendDelta,
    highestWindow,
    topTrigger,
    reframeCount7d: recentReframes.length,
    reframeMatchRate,
    unmatchedReframes: Math.max(0, recentReframes.length - matchedReframes),
  };
}

function analyzeCareSync(targetId) {
  const activities = readJson(`${ACTIVITY_PREFIX}${targetId}`, []).filter((entry) => entry && typeof entry === "object");
  const alerts = readJson(`${ALERT_PREFIX}${targetId}`, []).filter((entry) => entry && typeof entry === "object");
  const notes = readJson(`${NOTES_PREFIX}${targetId}`, []).filter((entry) => entry && typeof entry === "object");

  const recentActivities = activities.filter((entry) => withinDays(entry.created_at, 7));
  const recentAlerts = alerts.filter((entry) => withinDays(entry.created_at, 7));
  const recentNotes = notes.filter((entry) => withinDays(entry.created_at, 7));

  const panicEvents = recentActivities.filter((entry) => /panic/i.test(String(entry.event || ""))).length;
  const unresolvedAlerts = recentAlerts.filter((entry) => !entry.resolved).length;
  const guardianSupportRequests = recentAlerts.filter(
    (entry) => entry.kind === "guardian-support" || /guardian support/i.test(String(entry.message || "")),
  ).length;

  return {
    activityCount7d: recentActivities.length,
    alertCount7d: recentAlerts.length,
    noteCount7d: recentNotes.length,
    panicEvents,
    unresolvedAlerts,
    guardianSupportRequests,
  };
}

function analyzeRoutine(targetId) {
  const allTasks = readJson(TASKS_KEY, {});
  const tasks = Array.isArray(allTasks?.[targetId]) ? allTasks[targetId] : [];
  const doneCount = tasks.filter((task) => Boolean(task.done)).length;
  const completionRate = tasks.length ? Number((doneCount / tasks.length).toFixed(2)) : 0;

  return {
    taskCount: tasks.length,
    doneCount,
    completionRate,
  };
}

function createPredictions(signals) {
  const outcomes = [];

  if (signals.anxiety.logCount7d >= 3) {
    if (signals.anxiety.trendDelta >= 0.8) {
      outcomes.push({
        title: `Heightened anxiety episode likely in ${signals.anxiety.highestWindow}`,
        probability: "High",
        horizon: "Next 24 hours",
        rationale: `Recent anxiety trend is rising (+${signals.anxiety.trendDelta}) with repeated trigger pattern "${signals.anxiety.topTrigger}".`,
      });
    } else if (signals.anxiety.trendDelta <= -0.8) {
      outcomes.push({
        title: "Improved regulation likely to continue",
        probability: "Moderate",
        horizon: "Next 2-3 days",
        rationale: `Recent anxiety trend is improving (${signals.anxiety.trendDelta}). Current interventions appear effective.`,
      });
    } else {
      outcomes.push({
        title: "Stable but recurring anxiety window expected",
        probability: "Moderate",
        horizon: "This week",
        rationale: `Episodes cluster in ${signals.anxiety.highestWindow}, suggesting predictable recurrence.`,
      });
    }
  }

  if (signals.care.unresolvedAlerts >= 2 || signals.care.panicEvents >= 2) {
    outcomes.push({
      title: "Dysregulation spike risk remains elevated",
      probability: "High",
      horizon: "Next 48 hours",
      rationale: `${signals.care.unresolvedAlerts} unresolved alerts and ${signals.care.panicEvents} panic-linked events detected in recent records.`,
    });
  }

  if (signals.routine.taskCount >= 2 && signals.routine.completionRate >= 0.7) {
    outcomes.push({
      title: "Routine adherence likely to buffer symptom spikes",
      probability: "Moderate",
      horizon: "This week",
      rationale: `Task completion is ${Math.round(signals.routine.completionRate * 100)}%, which typically supports emotional stability.`,
    });
  }

  if (signals.anxiety.unmatchedReframes >= 2 || signals.care.guardianSupportRequests >= 1) {
    outcomes.push({
      title: "Personalized caregiver input needed for thought reframing",
      probability: "Moderate",
      horizon: "Immediate",
      rationale: "Multiple unclassified thoughts suggest current automatic reframing is insufficient for some contexts.",
    });
  }

  return outcomes.slice(0, 3);
}

function createAdaptiveActions(signals) {
  const actions = [];

  if (signals.anxiety.highestWindow && signals.anxiety.highestWindow !== "Unknown") {
    actions.push(`Schedule a proactive grounding block 15 minutes before ${signals.anxiety.highestWindow}.`);
  }

  if (signals.anxiety.topTrigger !== "n/a") {
    actions.push(`Create a trigger plan for "${signals.anxiety.topTrigger}" with one coping script and one exit strategy.`);
  }

  if (signals.anxiety.reframeMatchRate < 0.6) {
    actions.push("Increase guided reframing support and route unmatched thoughts to guardian review.");
  }

  if (signals.routine.taskCount > 0 && signals.routine.completionRate < 0.5) {
    actions.push("Reduce daily task load to 1-2 high-value routines until adherence recovers.");
  }

  if (signals.care.unresolvedAlerts > 0) {
    actions.push("Prioritize unresolved alerts first and attach one follow-up action to each alert.");
  }

  if (actions.length === 0) {
    actions.push("Maintain current routine and continue collecting daily records for stronger predictions.");
  }

  return actions.slice(0, 4);
}

function calculateRiskScore(signals) {
  const anxietyRisk = signals.anxiety.avgLevel7d * 7;
  const trendRisk = Math.max(0, signals.anxiety.trendDelta) * 12;
  const alertRisk = signals.care.unresolvedAlerts * 10;
  const panicRisk = signals.care.panicEvents * 8;
  const protectionByRoutine = signals.routine.completionRate * 18;
  const protectionByReframes = signals.anxiety.reframeMatchRate * 10;

  const raw = anxietyRisk + trendRisk + alertRisk + panicRisk - protectionByRoutine - protectionByReframes;
  return Math.round(clamp(raw, 5, 95));
}

function riskBand(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Moderate";
  return "Low";
}

export function buildAdaptiveOutcomeModel({ targetId }) {
  if (!targetId) {
    return {
      hasData: false,
      message: "No user context available for adaptive modeling.",
    };
  }

  const anxiety = analyzeAnxiety(targetId);
  const care = analyzeCareSync(targetId);
  const routine = analyzeRoutine(targetId);

  const recordsUsed =
    anxiety.logCount7d + anxiety.reframeCount7d + care.activityCount7d + care.alertCount7d + care.noteCount7d + routine.taskCount;

  if (recordsUsed === 0) {
    return {
      hasData: false,
      message: "Not enough records yet. Log activity for a day to unlock adaptive prediction.",
      updatedAt: new Date().toISOString(),
    };
  }

  const signals = { anxiety, care, routine };
  const score = calculateRiskScore(signals);
  const outcomes = createPredictions(signals);
  const adaptiveActions = createAdaptiveActions(signals);

  const confidence = clamp(Math.round(25 + recordsUsed * 3.5), 25, 96);

  return {
    hasData: true,
    targetId,
    score,
    riskLevel: riskBand(score),
    confidence,
    recordsUsed,
    outcomes,
    adaptiveActions,
    signals,
    updatedAt: new Date().toISOString(),
  };
}
