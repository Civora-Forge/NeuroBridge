import {
  TASK_BREAKDOWN_PRIORITIES,
  TASK_BREAKDOWN_STYLES,
} from "./taskBreakdownTypes";

const templates = {
  "Bare Minimum": (task) => [
    { text: `Define the absolute minimum for "${task}".`, time: 2 },
    { text: "Set a five-minute timer and start.", time: 5 },
    { text: "Complete one tiny chunk.", time: 5 },
    { text: "Write where to continue next time.", time: 2 },
  ],
  Standard: (task) => [
    { text: `Clarify what "${task}" means in one sentence.`, time: 3 },
    { text: "Gather materials and clear your workspace.", time: 5 },
    { text: "Start the first micro-step.", time: 10 },
    { text: "Do one focused block.", time: 10 },
    { text: "Pause, check progress, and adjust the next step.", time: 5 },
  ],
  "Hero Mode": (task) => [
    { text: `Write the ideal outcome for "${task}".`, time: 5 },
    { text: "Break work into three or four phases.", time: 5 },
    { text: "List concrete actions for the first phase.", time: 5 },
    { text: "Run a 25-minute focused block.", time: 25 },
    { text: "Check the first phase against the outcome.", time: 5 },
    { text: "Set up the next phase before you stop.", time: 5 },
    { text: "Review, then decide whether to continue or park it.", time: 5 },
  ],
};

export const TASK_BREAKDOWN_PLAN_BUCKETS = {
  smaller: { minimum: 3, maximum: 4, label: "3-4 steps" },
  detailed: { minimum: 5, label: "5+ steps" },
};

export function validateTaskBreakdownConfiguration(configuration = {}) {
  const selectedStyle = TASK_BREAKDOWN_STYLES.includes(configuration.selectedStyle)
    ? configuration.selectedStyle
    : "Standard";
  const priority = TASK_BREAKDOWN_PRIORITIES.includes(configuration.priority)
    ? configuration.priority
    : "Important";
  return { selectedStyle, priority };
}

export function normalizeTaskBreakdownSteps(steps = []) {
  return steps
    .filter((step) => typeof step?.text === "string" && step.text.trim())
    .map((step, index) => ({
      id: String(step.id ?? `step-${index + 1}`),
      text: step.text.trim(),
      time: Number.isFinite(step.time) && step.time > 0 ? step.time : 5,
    }));
}

export function generateTaskBreakdown(task, configuration = {}) {
  const normalizedTask = String(task ?? "").trim();
  const validatedConfiguration = validateTaskBreakdownConfiguration(configuration);
  if (!normalizedTask) return [];
  return normalizeTaskBreakdownSteps(templates[validatedConfiguration.selectedStyle](normalizedTask));
}

export function getTaskBreakdownProgress(steps = [], completedStepIds = new Set()) {
  const normalizedSteps = normalizeTaskBreakdownSteps(steps);
  const validIds = new Set(normalizedSteps.map((step) => step.id));
  const completedIds = new Set([...completedStepIds].map(String).filter((id) => validIds.has(id)));
  const totalUnits = normalizedSteps.length;
  const completedUnits = completedIds.size;
  return {
    totalUnits,
    completedUnits,
    completionRate: totalUnits > 0 ? completedUnits / totalUnits : 0,
    completedStepIds: completedIds,
  };
}

export function buildTaskBreakdownOutcome({
  steps,
  completedStepIds,
  selectedStyle,
  priority,
  requestedStepCount,
  actualGeneratedConfiguration,
  timerUsed,
  stepEdits,
  stepReorders,
  durationMs,
} = {}) {
  const configuration = validateTaskBreakdownConfiguration({
    selectedStyle: actualGeneratedConfiguration?.actualGeneratedStyle ?? actualGeneratedConfiguration?.style ?? selectedStyle,
    priority: actualGeneratedConfiguration?.priority ?? priority,
  });
  const progress = getTaskBreakdownProgress(steps, completedStepIds);
  const actualStepCount = Number.isInteger(actualGeneratedConfiguration?.actualGeneratedStepCount)
    ? actualGeneratedConfiguration.actualGeneratedStepCount
    : Number.isInteger(actualGeneratedConfiguration?.stepCount)
      ? actualGeneratedConfiguration.stepCount
    : Number.isInteger(requestedStepCount) ? requestedStepCount : progress.totalUnits;

  return {
    completionStatus: progress.completionRate === 1 ? "completed" : "partially_completed",
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : undefined,
    metrics: {
      stepsCreated: progress.totalUnits,
      stepsCompleted: progress.completedUnits,
      completionRate: progress.completionRate,
      selectedStyle: configuration.selectedStyle,
      priority: configuration.priority,
      timerUsed: Boolean(timerUsed),
      stepEdits: Number.isInteger(stepEdits) && stepEdits >= 0 ? stepEdits : 0,
      stepReorders: Number.isInteger(stepReorders) && stepReorders >= 0 ? stepReorders : 0,
    },
    finalConfiguration: {
      actualGeneratedStyle: configuration.selectedStyle,
      priority: configuration.priority,
      actualGeneratedStepCount: actualStepCount,
      timerUsed: Boolean(timerUsed),
    },
  };
}

function terminalOutcome(entry) {
  return entry.outcomes?.find((outcome) => ["completed", "partially_completed", "abandoned"].includes(outcome.status)) ?? null;
}

function sessionFromHistory(entry) {
  const outcome = terminalOutcome(entry);
  if (!outcome) return null;
  const configuration = outcome.metrics?.finalConfiguration ?? entry.intervention?.parameters ?? {};
  const stepCount = Number(
    configuration.actualGeneratedStepCount
    ?? configuration.requestedStepCount
    ?? outcome.metrics?.stepsCreated,
  );
  if (!Number.isInteger(stepCount) || stepCount < TASK_BREAKDOWN_PLAN_BUCKETS.smaller.minimum) return null;
  return {
    id: entry.intervention?.id,
    timestamp: outcome.updatedAt ?? outcome.createdAt ?? entry.intervention?.createdAt,
    style: configuration.actualGeneratedStyle ?? configuration.selectedStyle ?? outcome.metrics?.selectedStyle ?? "Standard",
    stepCount,
    completionRatio: Number(outcome.metrics?.completionRate ?? 0),
    status: outcome.status,
    rating: entry.outcomes?.find((item) => Number.isFinite(item.rating))?.rating ?? null,
  };
}

function createBucket(definition, sessions) {
  const completed = sessions.filter((session) => session.status === "completed").length;
  const partiallyCompleted = sessions.filter((session) => session.status === "partially_completed").length;
  const abandoned = sessions.filter((session) => session.status === "abandoned").length;
  const ratings = sessions.map((session) => session.rating).filter(Number.isFinite);
  return {
    ...definition,
    sessions: sessions.length,
    terminalSessions: sessions.length,
    completed,
    partiallyCompleted,
    abandoned,
    fullCompletionRate: sessions.length ? completed / sessions.length : null,
    averageCompletionRatio: sessions.length ? sessions.reduce((sum, session) => sum + session.completionRatio, 0) / sessions.length : null,
    averageHelpfulnessRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    averageStepCount: sessions.length ? sessions.reduce((sum, session) => sum + session.stepCount, 0) / sessions.length : null,
  };
}

export function calculateTaskBreakdownEvidence(history = []) {
  const sessions = history
    .map(sessionFromHistory)
    .filter(Boolean)
    .sort((left, right) => String(right.timestamp ?? "").localeCompare(String(left.timestamp ?? "")))
    .slice(0, 20);
  const smaller = createBucket(
    TASK_BREAKDOWN_PLAN_BUCKETS.smaller,
    sessions.filter((session) => session.stepCount <= TASK_BREAKDOWN_PLAN_BUCKETS.smaller.maximum),
  );
  const detailed = createBucket(
    TASK_BREAKDOWN_PLAN_BUCKETS.detailed,
    sessions.filter((session) => session.stepCount >= TASK_BREAKDOWN_PLAN_BUCKETS.detailed.minimum),
  );
  const comparable = smaller.terminalSessions >= 2 && detailed.terminalSessions >= 2;
  const difference = comparable ? smaller.fullCompletionRate - detailed.fullCompletionRate : null;
  const meaningfulDifference = difference !== null && Math.abs(difference) >= 0.2;
  let recommendation = null;

  if (meaningfulDifference && difference > 0) {
    recommendation = {
      direction: "smaller",
      recommendedStyle: "Bare Minimum",
      recommendedStepCount: 4,
      title: "Smaller plans tend to work better",
      description: "You complete shorter breakdowns more consistently, so we'll suggest around 3-4 steps.",
      explanation: "Your recent task breakdowns with fewer steps have had a higher completion rate. Starting smaller can help you make steady progress.",
    };
  } else if (meaningfulDifference && difference < 0) {
    recommendation = {
      direction: "detailed",
      recommendedStyle: "Hero Mode",
      recommendedStepCount: 7,
      title: "More detailed plans seem to work well for you",
      description: "Your longer breakdowns have been completed more consistently, so we'll keep more structure in this plan.",
      explanation: "Your recent task breakdowns with more steps have had a higher completion rate. Keeping more structure can support your progress.",
    };
  }

  return {
    sessions,
    smaller,
    detailed,
    hasComparableEvidence: comparable,
    recommendation,
    minimumEvidenceRemaining: Math.max(0, 2 - Math.min(smaller.terminalSessions, detailed.terminalSessions)),
  };
}
