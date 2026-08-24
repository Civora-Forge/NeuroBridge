import { getSupportModuleById } from "@/support/framework/supportModuleRegistry";
import { getRole4InterventionHistory, getRole4Repository } from "@/support/persistence/role4Repository";
import { InterventionStatus, OutcomeSource, PrivacyLevel } from "@/support/schemas/supportSchemas";
import { ROLE4_SCHEMA_VERSION, normalizeUserId } from "@/support/schemas/storageKeys";
import { getAllowedTransitions } from "./interventionLifecycle";

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assertTransitionAllowed(fromStatus, toStatus) {
  if (!getAllowedTransitions(fromStatus).includes(toStatus)) {
    throw new Error(`Invalid intervention transition: ${fromStatus} -> ${toStatus}`);
  }
}

function eventFor(userId, intervention, toStatus, options = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: ROLE4_SCHEMA_VERSION, id: options.id || makeId("lifecycle"), userId, interventionId: intervention.id,
    moduleId: intervention.moduleId, interventionType: intervention.interventionType, fromStatus: options.fromStatus ?? intervention.status ?? null,
    toStatus, source: options.source || OutcomeSource.MODULE_EVENT, privacy: options.privacy || intervention.privacy || PrivacyLevel.PRIVATE,
    reason: options.reason, metadata: options.metadata || {}, contextSnapshot: options.contextSnapshot || intervention.contextSnapshot,
    createdAt: now, updatedAt: now,
  };
}

export async function startFocusSessionIntervention({ userId, interventionId, parameters = {}, contextSnapshot, repository: suppliedRepository } = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const repository = suppliedRepository || await getRole4Repository(normalizedUserId);
  const module = getSupportModuleById("support.focus_session");
  const now = new Date().toISOString();
  const shown = await repository.createIntervention({
    schemaVersion: ROLE4_SCHEMA_VERSION, id: interventionId || makeId("intervention"), userId: normalizedUserId,
    moduleId: module.id, interventionType: module.interventionTypes[0], category: module.category, status: InterventionStatus.SHOWN,
    title: module.title, description: module.description, route: module.route, source: OutcomeSource.SYSTEM_INFERENCE,
    privacy: module.privacyDefault || PrivacyLevel.PRIVATE, tags: module.tags, parameters, rationale: "explicit_module_delivery",
    contextSnapshot, createdAt: now, updatedAt: now,
  });
  await repository.appendLifecycleEvent(eventFor(normalizedUserId, shown, InterventionStatus.SHOWN, { fromStatus: null, source: OutcomeSource.SYSTEM_INFERENCE, reason: "intervention_delivered" }));
  const started = await repository.updateIntervention({ ...shown, status: InterventionStatus.STARTED, updatedAt: new Date().toISOString() });
  const lifecycleEvent = await repository.appendLifecycleEvent(eventFor(normalizedUserId, started, InterventionStatus.STARTED, { fromStatus: InterventionStatus.SHOWN, reason: "execution_started" }));
  return { intervention: started, lifecycleEvent, repositoryKind: repository.kind };
}

export async function transitionFocusSessionIntervention({ userId, interventionId, toStatus, reason, metadata = {}, contextSnapshot, repository: suppliedRepository } = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const repository = suppliedRepository || await getRole4Repository(normalizedUserId);
  const intervention = await repository.getIntervention(normalizedUserId, interventionId);
  if (!intervention) throw new Error("Intervention not found for user");
  assertTransitionAllowed(intervention.status, toStatus);
  const updated = await repository.updateIntervention({ ...intervention, status: toStatus, updatedAt: new Date().toISOString() });
  const lifecycleEvent = await repository.appendLifecycleEvent(eventFor(normalizedUserId, updated, toStatus, { fromStatus: intervention.status, reason, metadata, contextSnapshot }));
  return { intervention: updated, lifecycleEvent };
}

export async function completeFocusSessionIntervention({ userId, interventionId, outcome = {}, repository: suppliedRepository } = {}) {
  const completionStatus = outcome.completionStatus === "partially_completed" ? InterventionStatus.PARTIALLY_COMPLETED : InterventionStatus.COMPLETED;
  const repository = suppliedRepository || await getRole4Repository(normalizeUserId(userId));
  const transition = await transitionFocusSessionIntervention({ userId, interventionId, toStatus: completionStatus, reason: "intervention_completed", metadata: { completionStatus }, repository });
  const savedOutcome = await recordFocusSessionOutcome({ userId, intervention: transition.intervention, status: completionStatus, outcome, repository });
  return { ...transition, outcome: savedOutcome };
}

export async function recordFocusSessionOutcome({ userId, intervention, status, outcome = {}, repository: suppliedRepository } = {}) {
  const repository = suppliedRepository || await getRole4Repository(normalizeUserId(userId));
  const now = new Date().toISOString();
  return repository.appendOutcome({
    schemaVersion: ROLE4_SCHEMA_VERSION, id: makeId("outcome"), userId: normalizeUserId(userId), interventionId: intervention.id,
    moduleId: intervention.moduleId, interventionType: intervention.interventionType, category: intervention.category,
    status, source: OutcomeSource.MODULE_EVENT, privacy: intervention.privacy, completed: status === InterventionStatus.COMPLETED,
    durationMs: outcome.durationMs, rating: outcome.userRating, metrics: { ...outcome.metrics, finalConfiguration: outcome.finalConfiguration },
    contextSnapshot: intervention.contextSnapshot, createdAt: now, updatedAt: now,
  });
}

export async function rateFocusSessionIntervention({ userId, interventionId, rating, feedback, repository: suppliedRepository } = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const repository = suppliedRepository || await getRole4Repository(normalizedUserId);
  const intervention = await repository.getIntervention(normalizedUserId, interventionId);
  if (!intervention) throw new Error("Intervention not found for user");
  if (!getAllowedTransitions(intervention.status).includes(InterventionStatus.RATED)) {
    throw new Error("Rating is not available for this intervention state");
  }
  const outcomes = await repository.listOutcomes(normalizedUserId, interventionId);
  const terminalOutcome = outcomes.find((outcome) => [InterventionStatus.COMPLETED, InterventionStatus.PARTIALLY_COMPLETED, InterventionStatus.ABANDONED].includes(outcome.status));
  if (!terminalOutcome) throw new Error("A terminal outcome is required before rating");
  if (Number.isFinite(terminalOutcome.rating)) throw new Error("A rating has already been submitted");
  const outcome = await repository.updateOutcome({
    ...terminalOutcome,
    rating,
    ...(feedback ? { userFeedback: feedback } : {}),
    updatedAt: new Date().toISOString(),
  });
  const transition = await transitionFocusSessionIntervention({
    userId: normalizedUserId,
    interventionId,
    toStatus: InterventionStatus.RATED,
    reason: "intervention_rated",
    metadata: { rating },
    repository,
  });
  return { ...transition, outcome };
}

export async function getFocusSessionHistory(userId) {
  return getRole4InterventionHistory(userId, { moduleId: "support.focus_session" });
}
