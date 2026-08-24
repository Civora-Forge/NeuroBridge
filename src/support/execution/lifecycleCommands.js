import {
  getInterventionForUser,
  getInterventionHistory,
  recordInterventionOutcome,
  transitionIntervention,
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
    : getInterventionForUser(command.userId, command.interventionId);
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

async function runTransition(request, action, toStatus, reason, metadata = {}) {
  const parsed = await parseCommand(request, action);
  if (parsed.error) return parsed.error;

  try {
    const transition = parsed.command.moduleId === "support.focus_session"
      ? await transitionFocusSessionIntervention({
        userId: parsed.command.userId, interventionId: parsed.command.interventionId, toStatus, reason,
        metadata: commandMetadata(parsed.command, metadata),
      })
      : transitionIntervention({
      userId: parsed.command.userId,
      interventionId: parsed.command.interventionId,
      toStatus,
      reason,
      metadata: commandMetadata(parsed.command, metadata),
    });
    return result(parsed.command, {
      ok: true,
      status: executionStatusFor(toStatus),
      intervention: transition.intervention,
      lifecycleEvent: transition.lifecycleEvent,
      reasonCodes: [reason],
    });
  } catch (error) {
    return result(parsed.command, {
      error: error instanceof Error ? error.message : "Invalid lifecycle transition",
      reasonCodes: ["invalid_transition"],
    });
  }
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

  const outcome = parsed.command.outcome || {};
  const toStatus = outcome.completionStatus === "partially_completed"
    ? InterventionStatus.PARTIALLY_COMPLETED
    : InterventionStatus.COMPLETED;
  if (parsed.command.moduleId === "support.focus_session") {
    try {
      const completed = await completeFocusSessionIntervention({ userId: parsed.command.userId, interventionId: parsed.command.interventionId, outcome });
      return result(parsed.command, { ok: true, status: ExecutionStatus.COMPLETED, intervention: completed.intervention, lifecycleEvent: completed.lifecycleEvent, outcome: completed.outcome, reasonCodes: ["intervention_completed"], learning: await processFocusInterventionOutcome(completed.intervention) });
    } catch (error) {
      return result(parsed.command, { error: error instanceof Error ? error.message : "Focus Session persistence failed", reasonCodes: ["persistence_failed"] });
    }
  }
  const transition = await runTransition(parsed.command, LifecycleAction.COMPLETE, toStatus, "intervention_completed", {
    completionStatus: outcome.completionStatus,
  });
  if (!transition.ok) return transition;

  const savedOutcome = recordInterventionOutcome({
    userId: parsed.command.userId,
    interventionId: parsed.command.interventionId,
    status: toStatus,
    completed: toStatus === InterventionStatus.COMPLETED,
    durationMs: outcome.durationMs,
    rating: outcome.userRating,
    userFeedback: parsed.command.metadata.storeFeedback === true ? outcome.userFeedback : undefined,
    metrics: {
      ...outcome.metrics,
      finalConfiguration: outcome.finalConfiguration,
    },
  });

  return { ...transition, status: ExecutionStatus.COMPLETED, outcome: savedOutcome, learning: processInterventionOutcome(transition.intervention) };
}

export async function abandonSupportModule(request) {
  const parsed = await parseCommand(request, LifecycleAction.ABANDON);
  if (parsed.error) return parsed.error;
  const transition = await runTransition(parsed.command, LifecycleAction.ABANDON, InterventionStatus.ABANDONED, "intervention_abandoned");
  if (!transition.ok || !parsed.command.outcome) return transition;
  const outcome = parsed.command.outcome;
  if (parsed.command.moduleId === "support.focus_session") {
    try {
      const savedOutcome = await recordFocusSessionOutcome({ userId: parsed.command.userId, intervention: transition.intervention, status: InterventionStatus.ABANDONED, outcome });
      return { ...transition, outcome: savedOutcome, learning: await processFocusInterventionOutcome(transition.intervention) };
    } catch (error) {
      return result(parsed.command, { error: error instanceof Error ? error.message : "Focus Session persistence failed", reasonCodes: ["persistence_failed"] });
    }
  }
  const abandonment = {
    ...transition,
    outcome: recordInterventionOutcome({
      userId: parsed.command.userId,
      interventionId: parsed.command.interventionId,
      status: InterventionStatus.ABANDONED,
      completed: false,
      durationMs: outcome.durationMs,
      metrics: { ...outcome.metrics, finalConfiguration: outcome.finalConfiguration },
    }),
  };
  return { ...abandonment, learning: processInterventionOutcome(abandonment.intervention) };
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

  const history = getInterventionHistory(parsed.command.userId).find(
    (entry) => entry.intervention.id === parsed.command.interventionId,
  );
  if (history?.outcomes.some((outcome) => typeof outcome.rating === "number")) {
    return result(parsed.command, { error: "A rating has already been submitted", reasonCodes: ["rating_already_submitted"] });
  }

  const savedOutcome = recordInterventionOutcome({
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
    learning: processInterventionOutcome(parsed.intervention),
  });
}
