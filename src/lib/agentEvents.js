/**
 * Pure helpers for translating backend agent execution events into
 * user-facing labels. No state here — agentStore.js owns the actual state
 * machine; this module just maps codes to friendly text so that logic isn't
 * duplicated between the store and any component that wants to render it.
 *
 * Never expose raw tool_args, database ids, internal prompts, or error
 * internals here — every label is a fixed, safe, human string.
 */

const TOOL_FRIENDLY_LABELS = {
  get_ocd_progress: "Checking your OCD progress",
  get_exposure_hierarchy: "Looking up your exposure hierarchy",
  create_exposure: "Adding a new exposure",
  start_erp_session: "Starting your ERP session",
  record_suds: "Recording your SUDS reading",
  complete_erp_session: "Wrapping up your ERP session",
  get_recent_tasks: "Checking your recent tasks",
  create_task_breakdown: "Breaking down your task",
  start_focus_session: "Starting your focus session",
  get_anxiety_history: "Checking your anxiety history",
  start_grounding_activity: "Starting a grounding exercise",
  get_reading_preferences: "Checking your reading preferences",
  start_social_scenario: "Preparing your social scenario",
  navigate_to_feature: "Getting that ready for you",
};

export function friendlyToolLabel(toolName) {
  if (!toolName) return null;
  return TOOL_FRIENDLY_LABELS[toolName] || "Working on it...";
}

const STATE_LABELS = {
  IDLE: "",
  UNDERSTANDING: "Understanding your request...",
  PLANNING: "Planning next step...",
  EXECUTING: "Working on it...",
  WAITING_FOR_TOOL: "Running a task...",
  WAITING_FOR_USER: "Waiting for your input...",
  CONFIRMATION_REQUIRED: "Waiting for your confirmation...",
  COMPLETED: "Completed",
  FAILED: "Something went wrong",
};

export function stateLabel(state) {
  return STATE_LABELS[state] ?? "Working on it...";
}

/**
 * The single label to show for "what is the agent doing right now" — prefers
 * the specific tool's friendly name over the generic state label, since it's
 * more concrete and useful to the user.
 */
export function currentStatusLabel(executionState, currentTool) {
  if (currentTool && (executionState === "EXECUTING" || executionState === "WAITING_FOR_TOOL")) {
    return friendlyToolLabel(currentTool);
  }
  return stateLabel(executionState);
}

export const AGENT_EXECUTION_STATES = [
  "IDLE", "UNDERSTANDING", "PLANNING", "EXECUTING", "WAITING_FOR_TOOL",
  "WAITING_FOR_USER", "CONFIRMATION_REQUIRED", "COMPLETED", "FAILED",
];
