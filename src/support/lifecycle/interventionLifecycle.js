import {
  getRole4Record,
  listInterventionLifecycleEvents,
  listInterventionOutcomes,
  listInterventions,
  saveIntervention,
  saveInterventionLifecycleEvent,
  saveInterventionOutcome,
} from "@/support/persistence/role4Store";
import { getSupportModuleById } from "@/support/framework/supportModuleRegistry";
import { selectIntervention } from "@/support/framework/interventionSelection";
import { ROLE4_COLLECTIONS, ROLE4_SCHEMA_VERSION, normalizeUserId } from "@/support/schemas/storageKeys";
import {
  InterventionStatus,
  OutcomeSource,
  PrivacyLevel,
} from "@/support/schemas/supportSchemas";

const ALLOWED_TRANSITIONS = {
  [InterventionStatus.RECOMMENDED]: [
    InterventionStatus.SHOWN,
    InterventionStatus.ACCEPTED,
    InterventionStatus.DISMISSED,
    InterventionStatus.ESCALATED,
  ],
  [InterventionStatus.SHOWN]: [
    InterventionStatus.ACCEPTED,
    InterventionStatus.STARTED,
    InterventionStatus.DISMISSED,
    InterventionStatus.CANCELLED,
    InterventionStatus.BLOCKED,
    InterventionStatus.ESCALATED,
  ],
  [InterventionStatus.ACCEPTED]: [
    InterventionStatus.STARTED,
    InterventionStatus.DISMISSED,
    InterventionStatus.CANCELLED,
    InterventionStatus.BLOCKED,
    InterventionStatus.ESCALATED,
  ],
  [InterventionStatus.STARTED]: [
    InterventionStatus.PROGRESSED,
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.PAUSED,
    InterventionStatus.COMPLETED,
    InterventionStatus.PARTIALLY_COMPLETED,
    InterventionStatus.ABANDONED,
    InterventionStatus.CANCELLED,
    InterventionStatus.FAILED,
    InterventionStatus.ESCALATED,
  ],
  [InterventionStatus.PROGRESSED]: [
    InterventionStatus.PROGRESSED,
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.PAUSED,
    InterventionStatus.COMPLETED,
    InterventionStatus.PARTIALLY_COMPLETED,
    InterventionStatus.ABANDONED,
    InterventionStatus.CANCELLED,
    InterventionStatus.FAILED,
    InterventionStatus.ESCALATED,
  ],
  [InterventionStatus.IN_PROGRESS]: [
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.PROGRESSED,
    InterventionStatus.PAUSED,
    InterventionStatus.COMPLETED,
    InterventionStatus.PARTIALLY_COMPLETED,
    InterventionStatus.ABANDONED,
    InterventionStatus.CANCELLED,
    InterventionStatus.FAILED,
    InterventionStatus.ESCALATED,
  ],
  [InterventionStatus.PAUSED]: [
    InterventionStatus.IN_PROGRESS,
    InterventionStatus.COMPLETED,
    InterventionStatus.PARTIALLY_COMPLETED,
    InterventionStatus.ABANDONED,
    InterventionStatus.CANCELLED,
    InterventionStatus.FAILED,
    InterventionStatus.ESCALATED,
  ],
  [InterventionStatus.COMPLETED]: [
    InterventionStatus.RATED,
    InterventionStatus.FOLLOW_UP_CREATED,
  ],
  [InterventionStatus.PARTIALLY_COMPLETED]: [
    InterventionStatus.RATED,
    InterventionStatus.FOLLOW_UP_CREATED,
  ],
  [InterventionStatus.ABANDONED]: [
    InterventionStatus.RATED,
    InterventionStatus.FOLLOW_UP_CREATED,
  ],
  [InterventionStatus.CANCELLED]: [
    InterventionStatus.RATED,
    InterventionStatus.FOLLOW_UP_CREATED,
  ],
  [InterventionStatus.FAILED]: [
    InterventionStatus.FOLLOW_UP_CREATED,
  ],
  [InterventionStatus.BLOCKED]: [],
  [InterventionStatus.RATED]: [
    InterventionStatus.FOLLOW_UP_CREATED,
  ],
  [InterventionStatus.DISMISSED]: [],
  [InterventionStatus.ESCALATED]: [],
  [InterventionStatus.FOLLOW_UP_CREATED]: [],
};

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function assertTransitionAllowed(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw new Error(`Invalid intervention transition: ${fromStatus} -> ${toStatus}`);
  }
}

function loadInterventionForUser(userId, interventionId) {
  const intervention = getRole4Record(userId, ROLE4_COLLECTIONS.INTERVENTIONS, interventionId);
  if (!intervention) {
    throw new Error("Intervention not found for user");
  }
  return intervention;
}

function createLifecycleEvent(userId, intervention, toStatus, options = {}) {
  return saveInterventionLifecycleEvent(userId, {
    id: options.id || makeId("lifecycle"),
    userId,
    interventionId: intervention.id,
    moduleId: intervention.moduleId,
    interventionType: intervention.interventionType,
    fromStatus: options.fromStatus ?? intervention.status ?? null,
    toStatus,
    source: options.source || OutcomeSource.MODULE_EVENT,
    privacy: options.privacy || intervention.privacy || PrivacyLevel.PRIVATE,
    reason: options.reason,
    metadata: options.metadata || {},
    contextSnapshot: options.contextSnapshot || intervention.contextSnapshot,
  });
}

export function getAllowedTransitions(status) {
  return [...(ALLOWED_TRANSITIONS[status] || [])];
}

export function getInterventionForUser(userId, interventionId) {
  try {
    return loadInterventionForUser(normalizeUserId(userId), interventionId);
  } catch {
    return null;
  }
}

export function deliverIntervention(options = {}) {
  const userId = normalizeUserId(options.userId);
  const selection = options.module
    ? {
        selectedModule: options.module,
        rankedModules: [],
        fallbackUsed: false,
        safety: { allowed: true, reasonCodes: [] },
        reasonCodes: ["explicit_module_delivery"],
      }
    : selectIntervention(options);

  if (!selection.selectedModule) {
    return {
      status: "blocked",
      intervention: null,
      delivery: null,
      selection,
      reasonCodes: selection.reasonCodes,
      safety: selection.safety,
    };
  }

  if (selection.safety?.allowed === false) {
    return {
      status: "blocked",
      intervention: null,
      delivery: null,
      selection,
      reasonCodes: selection.safety.reasonCodes,
      safety: selection.safety,
    };
  }

  const module = getSupportModuleById(selection.selectedModule.id) || selection.selectedModule;
  const interventionType = options.interventionType || module.interventionTypes[0];
  const now = new Date().toISOString();
  const intervention = saveIntervention(userId, {
    schemaVersion: ROLE4_SCHEMA_VERSION,
    id: options.interventionId || makeId("intervention"),
    userId,
    moduleId: module.id,
    interventionType,
    category: module.category,
    status: InterventionStatus.SHOWN,
    title: module.title,
    description: module.description,
    route: module.route,
    source: OutcomeSource.SYSTEM_INFERENCE,
    privacy: module.privacyDefault || PrivacyLevel.PRIVATE,
    tags: module.tags,
    parameters: options.parameters || {},
    rationale: selection.reasonCodes.join(", "),
    contextSnapshot: options.currentContext,
    createdAt: now,
    updatedAt: now,
  });

  const event = createLifecycleEvent(userId, intervention, InterventionStatus.SHOWN, {
    fromStatus: null,
    source: OutcomeSource.SYSTEM_INFERENCE,
    reason: "intervention_delivered",
    metadata: {
      fallbackUsed: selection.fallbackUsed,
      reasonCodes: selection.reasonCodes,
      safety: selection.safety,
    },
  });

  return {
    status: "delivered",
    intervention,
    lifecycleEvent: event,
    selection,
    delivery: {
      route: module.route,
      title: module.title,
      moduleId: module.id,
      interventionType,
      safetyMessage: selection.safety?.message,
    },
  };
}

export function transitionIntervention(options = {}) {
  const userId = normalizeUserId(options.userId);
  const intervention = loadInterventionForUser(userId, options.interventionId);
  assertTransitionAllowed(intervention.status, options.toStatus);

  const now = new Date().toISOString();
  const updated = saveIntervention(userId, {
    ...intervention,
    status: options.toStatus,
    updatedAt: now,
  });
  const event = createLifecycleEvent(userId, updated, options.toStatus, {
    fromStatus: intervention.status,
    source: options.source || OutcomeSource.MODULE_EVENT,
    privacy: options.privacy || updated.privacy,
    reason: options.reason,
    metadata: options.metadata || {},
    contextSnapshot: options.contextSnapshot || updated.contextSnapshot,
  });

  return {
    intervention: updated,
    lifecycleEvent: event,
    allowedNextStatuses: getAllowedTransitions(updated.status),
  };
}

export function recordInterventionOutcome(options = {}) {
  const userId = normalizeUserId(options.userId);
  const intervention = loadInterventionForUser(userId, options.interventionId);
  const status = options.status || intervention.status;
  const now = new Date().toISOString();

  return saveInterventionOutcome(userId, {
    schemaVersion: ROLE4_SCHEMA_VERSION,
    id: options.outcomeId || makeId("outcome"),
    userId,
    interventionId: intervention.id,
    moduleId: intervention.moduleId,
    interventionType: intervention.interventionType,
    category: intervention.category,
    status,
    source: options.source || OutcomeSource.MODULE_EVENT,
    privacy: options.privacy || intervention.privacy || PrivacyLevel.PRIVATE,
    accepted: options.accepted,
    completed: options.completed,
    durationMs: options.durationMs,
    rating: options.rating,
    userFeedback: options.userFeedback,
    metrics: options.metrics || {},
    contextSnapshot: options.contextSnapshot || intervention.contextSnapshot,
    createdAt: now,
    updatedAt: now,
  });
}

export function recordInterventionFeedback(options = {}) {
  const userId = normalizeUserId(options.userId);
  const intervention = loadInterventionForUser(userId, options.interventionId);
  const shouldRate = typeof options.rating === "number";
  let updatedIntervention = intervention;

  if (shouldRate && getAllowedTransitions(intervention.status).includes(InterventionStatus.RATED)) {
    updatedIntervention = transitionIntervention({
      userId,
      interventionId: intervention.id,
      toStatus: InterventionStatus.RATED,
      source: OutcomeSource.USER_REPORT,
      reason: "user_feedback_recorded",
      metadata: { rating: options.rating },
    }).intervention;
  }

  const outcome = recordInterventionOutcome({
    ...options,
    userId,
    interventionId: updatedIntervention.id,
    status: shouldRate ? InterventionStatus.RATED : updatedIntervention.status,
    source: OutcomeSource.USER_REPORT,
  });

  return {
    intervention: updatedIntervention,
    outcome,
  };
}

export function getInterventionHistory(userId, filters = {}) {
  const normalizedUserId = normalizeUserId(userId);
  const interventions = listInterventions(normalizedUserId);
  const events = listInterventionLifecycleEvents(normalizedUserId);
  const outcomes = listInterventionOutcomes(normalizedUserId);

  return interventions
    .filter((intervention) => {
      if (filters.moduleId && intervention.moduleId !== filters.moduleId) return false;
      if (filters.interventionType && intervention.interventionType !== filters.interventionType) return false;
      if (filters.status && intervention.status !== filters.status) return false;
      return true;
    })
    .map((intervention) => ({
      intervention,
      lifecycleEvents: events.filter((event) => event.interventionId === intervention.id),
      outcomes: outcomes.filter((outcome) => outcome.interventionId === intervention.id),
    }));
}

