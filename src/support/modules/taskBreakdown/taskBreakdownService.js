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
    { text: "Review, then decide whether to continue or park it.", time: 5 },
  ],
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
  timerUsed,
  stepEdits,
  stepReorders,
  durationMs,
} = {}) {
  const configuration = validateTaskBreakdownConfiguration({ selectedStyle, priority });
  const progress = getTaskBreakdownProgress(steps, completedStepIds);
  const timerEnabled = Boolean(timerUsed);

  return {
    completionStatus: progress.completionRate === 1 ? "completed" : "partially_completed",
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : undefined,
    metrics: {
      stepsCreated: progress.totalUnits,
      stepsCompleted: progress.completedUnits,
      completionRate: progress.completionRate,
      selectedStyle: configuration.selectedStyle,
      priority: configuration.priority,
      timerUsed: timerEnabled,
      stepEdits: Number.isInteger(stepEdits) && stepEdits >= 0 ? stepEdits : 0,
      stepReorders: Number.isInteger(stepReorders) && stepReorders >= 0 ? stepReorders : 0,
    },
    finalConfiguration: {
      selectedStyle: configuration.selectedStyle,
      priority: configuration.priority,
      requestedStepCount: Number.isInteger(requestedStepCount) && requestedStepCount >= 0
        ? requestedStepCount
        : progress.totalUnits,
      timerEnabled,
    },
  };
}
