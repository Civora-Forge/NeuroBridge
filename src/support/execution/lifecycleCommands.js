import {
  getInterventionForUserAsync,
  recordInterventionOutcomeAsync,
  transitionInterventionAsync,
} from "@/support/lifecycle/interventionLifecycle";
import { completeFocusSessionIntervention, rateFocusSessionIntervention, recordFocusSessionOutcome, transitionFocusSessionIntervention } from "@/support/lifecycle/focusSessionLifecycle";
import { getRole4Repository } from "@/support/persistence/role4Repository";
import { InterventionStatus } from "@/support/schemas/supportSchemas";
import {
  ExecutionStatus,
  LifecycleAction,
  LifecycleCommandRequestSchema,
} from "./executionTypes";
import { processFocusInterventionOutcome, processInterventionOutcome } from "@/support/learning/processInterventionOutcome";
import { normalizeUserId } from "@/support/schemas/storageKeys";

const lifecycleLocks = new Map();

function withLifecycleLock(userId, interventionId, work) {
  const key = `${normalizeUserId(userId)}:${interventionId}`;
  const next = (lifecycleLocks.get(key) ?? Promise.resolve()).catch(() => {}).then(work);
  lifecycleLocks.set(key, next);
  return next;
}

const RATING_STATUSES = new Set([
  InterventionStatus.COMPLETED,
  InterventionStatus.PARTIALLY_COMPLETED,
  InterventionStatus.ABANDONED,
  InterventionStatus.CANCELLED,
]);

function result(request, overrides = {}) {
  return {
    ok: false,
    status: ExecutionStatus.FAILED,
    interventionId: request?.interventionId ?? null,
    moduleId: request?.moduleId ?? null,
    userId: request?.userId ?? null,
    intervention: null,
    lifecycleEvent: null,
    outcome: null,
    error: null,
    reasonCodes: [],
    ...overrides,
  };
}

async function parseCommand(request, action) {
  const parsed = LifecycleCommandRequestSchema.safeParse({ ...request, action });
  if (!parsed.success) {
    return { error: result(request, { error: "Invalid lifecycle command", reasonCodes: ["invalid_command"] }) };
  }

  const command = parsed.data;
  const intervention = command.moduleId === "support.focus_session"
    ? await (await getRole4Repository(command.userId)).getIntervention(command.userId, command.interventionId)
    : await getInterventionForUserAsync(command.userId, command.interventionId);
  if (!intervention) {
    return { error: result(command, { error: "Intervention not found for user", reasonCodes: ["intervention_not_found"] }) };
  }
  if (intervention.moduleId !== command.moduleId) {
    return { error: result(command, { error: "Module does not match intervention", reasonCodes: ["module_mismatch"] }) };
  }
  return { command, intervention };
}

function commandMetadata(command, extra = {}) {
  return {
    ...command.metadata,
    ...extra,
    commandTimestamp: command.timestamp || new Date().toISOString(),
  };
}

async function executeTransition(command, toStatus, reason, metadata = {}) {
  try {
    const transition = command.moduleId === "support.focus_session"
      ? await transitionFocusSessionIntervention({
        userId: command.userId, interventionId: command.interventionId, toStatus, reason,
        metadata: commandMetadata(command, metadata),
      })
      : await transitionInterventionAsync({
      userId: command.userId,
      interventionId: command.interventionId,
      toStatus,
      reason,
      metadata: commandMetadata(command, metadata),
    });
    return result(command, {
      ok: true,
      status: executionStatusFor(toStatus),
      intervention: transition.intervention,
      lifecycleEvent: transition.lifecycleEvent,
      reasonCodes: [reason],
    });
  } catch (error) {
    return result(command, {
      error: error instanceof Error ? error.message : "Invalid lifecycle transition",
      reasonCodes: ["invalid_transition"],
    });
  }
}

async function runTransition(request, action, toStatus, reason, metadata = {}) {
  const parsed = await parseCommand(request, action);
  if (parsed.error) return parsed.error;

  return withLifecycleLock(parsed.command.userId, parsed.command.interventionId, async () => {
    const current = await parseCommand(parsed.command, action);
    if (current.error) return current.error;
    return executeTransition(current.command, toStatus, reason, metadata);
  });
}

function executionStatusFor(interventionStatus) {
  if (interventionStatus === InterventionStatus.COMPLETED || interventionStatus === InterventionStatus.PARTIALLY_COMPLETED) {
    return ExecutionStatus.COMPLETED;
  }
  if (interventionStatus === InterventionStatus.ABANDONED) return ExecutionStatus.ABANDONED;
  if (interventionStatus === InterventionStatus.CANCELLED) return ExecutionStatus.CANCELLED;
  if (interventionStatus === InterventionStatus.FAILED) return ExecutionStatus.FAILED;
  if (interventionStatus === InterventionStatus.BLOCKED) return ExecutionStatus.BLOCKED;
  return ExecutionStatus.RUNNING;
}

export async function progressSupportModule(request) {
  const parsed = await parseCommand(request, LifecycleAction.PROGRESS);
  if (parsed.error) return parsed.error;
  return runTransition(parsed.command, LifecycleAction.PROGRESS, InterventionStatus.IN_PROGRESS, "intervention_progressed", {
    progress: parsed.command.progress || {},
  });
}

export async function pauseSupportModule(request) {
  return runTransition(request, LifecycleAction.PAUSE, InterventionStatus.PAUSED, "intervention_paused");
}

export async function resumeSupportModule(request) {
  return runTransition(request, LifecycleAction.RESUME, InterventionStatus.IN_PROGRESS, "intervention_resumed");
}

export async function completeSupportModule(request) {
  const parsed = await parseCommand(request, LifecycleAction.COMPLETE);
  if (parsed.error) return parsed.error;

  return withLifecycleLock(parsed.command.userId, parsed.command.interventionId, async () => {
    const current = await parseCommand(parsed.command, LifecycleAction.COMPLETE);
    if (current.error) return current.error;
    const outcome = current.command.outcome || {};
    const toStatus = outcome.completionStatus === "partially_completed"
      ? InterventionStatus.PARTIALLY_COMPLETED
      : InterventionStatus.COMPLETED;
    if (current.command.moduleId === "support.focus_session") {
      try {
        const completed = await completeFocusSessionIntervention({ userId: current.command.userId, interventionId: current.command.interventionId, outcome });
        try {
          const { recordWellbeingInteraction, WELLBEING_INTERACTION_TYPES } = await import("@/services/wellbeingService.js");
          recordWellbeingInteraction({
            userId: current.command.userId,
            interactionType: WELLBEING_INTERACTION_TYPES.FOCUS_SESSION_COMPLETED,
            source: "support.focus_session",
            metadata: { interventionId: current.command.interventionId, outcome },
          });
        } catch (e) {
          // Safe fallback
        }
        return result(current.command, { ok: true, status: ExecutionStatus.COMPLETED, intervention: completed.intervention, lifecycleEvent: completed.lifecycleEvent, outcome: completed.outcome, reasonCodes: ["intervention_completed"], learning: await processFocusInterventionOutcome(completed.intervention) });
      } catch (error) {
        return result(current.command, { error: error instanceof Error ? error.message : "Focus Session persistence failed", reasonCodes: ["persistence_failed"] });
      }
    }
    const transition = await executeTransition(current.command, toStatus, "intervention_completed", {
      completionStatus: outcome.completionStatus,
    });
    if (!transition.ok) return transition;

    const savedOutcome = await recordInterventionOutcomeAsync({
      userId: current.command.userId,
      interventionId: current.command.interventionId,
      status: toStatus,
      completed: toStatus === InterventionStatus.COMPLETED,
      durationMs: outcome.durationMs,
      rating: outcome.userRating,
      userFeedback: current.command.metadata?.storeFeedback === true ? outcome.userFeedback : undefined,
      metrics: {
        ...outcome.metrics,
        finalConfiguration: outcome.finalConfiguration,
      },
    });

    try {
      const { recordWellbeingInteraction, WELLBEING_INTERACTION_TYPES } = await import("@/services/wellbeingService.js");
      recordWellbeingInteraction({
        userId: current.command.userId,
        interactionType: WELLBEING_INTERACTION_TYPES.SUPPORT_MODULE_COMPLETED,
        source: current.command.moduleId || "support_toolkit",
        metadata: { interventionId: current.command.interventionId, outcome: savedOutcome },
      });
    } catch (e) {
      // Safe fallback
    }

    return { ...transition, status: ExecutionStatus.COMPLETED, outcome: savedOutcome, learning: await processInterventionOutcome(transition.intervention) };
  });
}

export async function abandonSupportModule(request) {
  const parsed = await parseCommand(request, LifecycleAction.ABANDON);
  if (parsed.error) return parsed.error;

  return withLifecycleLock(parsed.command.userId, parsed.command.interventionId, async () => {
    const current = await parseCommand(parsed.command, LifecycleAction.ABANDON);
    if (current.error) return current.error;

    const transition = await executeTransition(current.command, InterventionStatus.ABANDONED, "intervention_abandoned");
    if (!transition.ok || !current.command.outcome) return transition;
    const outcome = current.command.outcome;
    if (current.command.moduleId === "support.focus_session") {
      try {
        const savedOutcome = await recordFocusSessionOutcome({ userId: current.command.userId, intervention: transition.intervention, status: InterventionStatus.ABANDONED, outcome });
        return { ...transition, outcome: savedOutcome, learning: await processFocusInterventionOutcome(transition.intervention) };
      } catch (error) {
        return result(current.command, { error: error instanceof Error ? error.message : "Focus Session persistence failed", reasonCodes: ["persistence_failed"] });
      }
    }
    const abandonment = {
      ...transition,
      outcome: await recordInterventionOutcomeAsync({
        userId: current.command.userId,
        interventionId: current.command.interventionId,
        status: InterventionStatus.ABANDONED,
        completed: false,
        durationMs: outcome.durationMs,
        metrics: { ...outcome.metrics, finalConfiguration: outcome.finalConfiguration },
      }),
    };
    return { ...abandonment, learning: await processInterventionOutcome(abandonment.intervention) };
  });
}

export async function cancelSupportModule(request) {
  return runTransition(request, LifecycleAction.CANCEL, InterventionStatus.CANCELLED, "intervention_cancelled");
}

export async function failSupportModule(request) {
  return runTransition(request, LifecycleAction.FAIL, InterventionStatus.FAILED, "intervention_failed");
}

export async function rateSupportModule(request) {
  const parsed = await parseCommand(request, LifecycleAction.RATE);
  if (parsed.error) return parsed.error;

  const rating = parsed.command.outcome?.userRating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return result(parsed.command, { error: "Rating must be an integer from 1 through 5", reasonCodes: ["invalid_rating"] });
  }
  if (!RATING_STATUSES.has(parsed.intervention.status)) {
    return result(parsed.command, { error: "Rating is not available for this intervention state", reasonCodes: ["rating_not_allowed"] });
  }

  if (parsed.command.moduleId === "support.focus_session") {
    try {
      const rated = await rateFocusSessionIntervention({
        userId: parsed.command.userId,
        interventionId: parsed.command.interventionId,
        rating,
        feedback: parsed.command.metadata.storeFeedback === true ? parsed.command.outcome.userFeedback : undefined,
      });
      return result(parsed.command, {
        ok: true,
        status: ExecutionStatus.COMPLETED,
        intervention: rated.intervention,
        lifecycleEvent: rated.lifecycleEvent,
        outcome: rated.outcome,
        reasonCodes: ["rating_recorded"],
        learning: await processFocusInterventionOutcome(rated.intervention),
      });
    } catch (error) {
      return result(parsed.command, { error: error instanceof Error ? error.message : "Focus Session rating failed", reasonCodes: ["rating_failed"] });
    }
  }

  const repository = await getRole4Repository(parsed.command.userId);
  const history = await repository.listOutcomes(parsed.command.userId, parsed.command.interventionId);
  if (history.some((outcome) => typeof outcome.rating === "number")) {
    return result(parsed.command, { error: "A rating has already been submitted", reasonCodes: ["rating_already_submitted"] });
  }

  const savedOutcome = await recordInterventionOutcomeAsync({
    userId: parsed.command.userId,
    interventionId: parsed.command.interventionId,
    status: parsed.intervention.status,
    rating,
    userFeedback: parsed.command.metadata.storeFeedback === true ? parsed.command.outcome.userFeedback : undefined,
    metrics: { ratingSource: "user" },
  });
  return result(parsed.command, {
    ok: true,
    status: ExecutionStatus.COMPLETED,
    intervention: parsed.intervention,
    outcome: savedOutcome,
    reasonCodes: ["rating_recorded"],
    learning: await processInterventionOutcome(parsed.intervention),
  });
}
