import { validateFocusSessionConfiguration } from "@/support/modules/focusSession/focusSessionService";

const supportedModuleIds = [
  "support.task_breakdown",
  "support.focus_session",
  "support.gentle_activity",
  "support.grounding",
  "support.social_connection",
  "support.cognitive_reframing",
  "support.evidence_journal",
];

export const DEFERRED_MODULE_IDS = new Set([
  "support.visual_timeline",
  "support.mood_checkin",
  "support.accountability_session",
  "support.soundscape",
  "asd.social-scenarios",
]);

async function startPlaceholderExecutor() {
  return { ok: true, status: "started" };
}

async function startFocusSessionExecutor({ interventionId, moduleId, planId = null, contextSnapshotId = null, configuration = {} }) {
  const focusConfiguration = validateFocusSessionConfiguration(configuration);
  return {
    ok: true,
    status: "started",
    launch: {
      route: "/adhd/focus",
      state: {
        interventionId,
        moduleId,
        planId,
        contextSnapshotId,
        configuration: {
          plannedDurationMinutes: focusConfiguration.plannedDurationMinutes,
          breakDurationMinutes: focusConfiguration.breakDurationMinutes,
        },
      },
    },
  };
}

export const MODULE_EXECUTORS = Object.freeze(
  Object.fromEntries(supportedModuleIds.map((moduleId) => [
    moduleId,
    moduleId === "support.focus_session" ? startFocusSessionExecutor : startPlaceholderExecutor,
  ])),
);

export function getModuleExecutor(moduleId) {
  return MODULE_EXECUTORS[moduleId] ?? null;
}
