const supportedModuleIds = [
  "support.task_breakdown",
  "support.focus_session",
  "support.visual_timeline",
  "support.mood_checkin",
  "support.accountability_session",
  "support.gentle_activity",
  "support.grounding",
  "support.social_connection",
  "support.cognitive_reframing",
];

export const DEFERRED_MODULE_IDS = new Set([
  "support.soundscape",
  "support.evidence_journal",
]);

async function startPlaceholderExecutor() {
  return { ok: true, status: "started" };
}

export const MODULE_EXECUTORS = Object.freeze(
  Object.fromEntries(supportedModuleIds.map((moduleId) => [moduleId, startPlaceholderExecutor])),
);

export function getModuleExecutor(moduleId) {
  return MODULE_EXECUTORS[moduleId] ?? null;
}
