import { z } from "zod";
import { ROLE4_SCHEMA_VERSION } from "./storageKeys";

export const InterventionStatus = {
  RECOMMENDED: "recommended",
  SHOWN: "shown",
  ACCEPTED: "accepted",
  STARTED: "started",
  PROGRESSED: "progressed",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  COMPLETED: "completed",
  PARTIALLY_COMPLETED: "partially_completed",
  ABANDONED: "abandoned",
  CANCELLED: "cancelled",
  FAILED: "failed",
  BLOCKED: "blocked",
  DISMISSED: "dismissed",
  RATED: "rated",
  ESCALATED: "escalated",
  FOLLOW_UP_CREATED: "follow_up_created",
};

export const ModuleCategory = {
  EXECUTIVE: "executive",
  EMOTIONAL: "emotional",
  LEARNING: "learning",
  SENSORY: "sensory",
  MOTOR: "motor",
  SPECIALIZED: "specialized",
  CARE_SYNC: "care_sync",
};

export const PrivacyLevel = {
  PRIVATE: "private",
  GUARDIAN: "guardian",
  SUPPORT: "support",
  CARE_TEAM: "care_team",
  ANONYMOUS_AGGREGATE: "anonymous_aggregate",
};

export const OutcomeSource = {
  USER_REPORT: "user_report",
  MODULE_EVENT: "module_event",
  CARE_TEAM: "care_team",
  SYSTEM_INFERENCE: "system_inference",
  IMPORTED_LEGACY: "imported_legacy",
};

export const ConfidenceLevel = {
  LOW: "low",
  MODERATE: "moderate",
  HIGH: "high",
};

export const MemoryType = {
  PREFERENCE: "preference",
  SUCCESSFUL_STRATEGY: "successful_strategy",
  INEFFECTIVE_STRATEGY: "ineffective_strategy",
  ACCESSIBILITY_PREFERENCE: "accessibility_preference",
  LEARNING_PATTERN: "learning_pattern",
  TRIGGER_PATTERN: "trigger_pattern",
  SUPPORT_BOUNDARY: "support_boundary",
  CARE_TEAM_PREFERENCE: "care_team_preference",
  INTERACTION_PATTERN: "interaction_pattern",
};

export const MemoryCategory = {
  PREFERRED_CONFIGURATION: "preferred_configuration",
  SUCCESSFUL_STRATEGY: "successful_strategy",
  UNSUCCESSFUL_CONFIGURATION: "unsuccessful_configuration",
  COMPLETION_PATTERN: "completion_pattern",
  FEEDBACK_PATTERN: "feedback_pattern",
};

export const MemoryStatus = {
  ACTIVE: "active",
  SUPERSEDED: "superseded",
  DELETED: "deleted",
};

export const SafetyLevel = {
  STANDARD: "standard",
  CAUTION: "caution",
  ESCALATE: "escalate",
};

export const AdaptationDimension = {
  CONTENT: "CONTENT",
  TASK: "TASK",
  INTERACTION: "INTERACTION",
  UI: "UI",
  TIMING: "TIMING",
  NOTIFICATIONS: "NOTIFICATIONS",
  ASSISTANCE: "ASSISTANCE",
  PACING: "PACING",
};

export const AdaptationActionType = {
  MODIFY: "MODIFY",
  INCREASE: "INCREASE",
  DECREASE: "DECREASE",
  SIMPLIFY: "SIMPLIFY",
  EXPAND: "EXPAND",
  REDUCE: "REDUCE",
  REORDER: "REORDER",
  DECOMPOSE: "DECOMPOSE",
  GUIDE: "GUIDE",
  PROMPT: "PROMPT",
  PAUSE: "PAUSE",
  RESUME: "RESUME",
  DELAY: "DELAY",
  ACCELERATE: "ACCELERATE",
  RESTORE: "RESTORE",
  ESCALATE: "ESCALATE",
  ENABLE: "ENABLE",
  DISABLE: "DISABLE",
  RECOMMEND: "RECOMMEND",
  SUPPRESS: "SUPPRESS",
};

export const PriorityTier = {
  SAFETY: 1,
  EXPLICIT_USER_REQUEST: 2,
  EXPLICIT_RESTRICTION: 3,
  EXPLICIT_PREFERENCE: 4,
  CORE_USER_GOAL: 5,
  MODULE_CONSTRAINT: 6,
  CURRENT_TASK: 7,
  CURRENT_STATE: 8,
  LEARNED_PERSONALIZATION: 9,
  CONVENIENCE: 10,
};

export const PolicyScope = {
  GENERIC: "generic",
  USER: "user",
  MODULE: "module",
  TASK: "task",
};

export const TriggerCondition = {
  GTE: ">=",
  LTE: "<=",
  EQ: "==",
  IN: "in",
  NOT_IN: "not_in",
};

export const TriggerGroupOperator = {
  AND: "AND",
};

export const AdaptationOutcomeStatus = {
  APPLIED: "applied",
  PARTIALLY_APPLIED: "partially_applied",
  NOT_APPLIED: "not_applied",
  REVERTED: "reverted",
  EXPIRED: "expired",
};

const isoDateString = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime({ offset: false }));

const idSchema = z.string().trim().min(1);
const tagsSchema = z.array(z.string().trim().min(1)).default([]);
const confidenceRange = z.number().min(0).max(1);
const epochNumber = z.number().int().nonnegative();

const recordBase = {
  schemaVersion: z
    .literal(ROLE4_SCHEMA_VERSION)
    .default(ROLE4_SCHEMA_VERSION),
  id: idSchema,
  userId: idSchema,
  createdAt: isoDateString.default(() => new Date().toISOString()),
  updatedAt: isoDateString.default(() => new Date().toISOString()),
};

export const EvidenceJournalEntrySchema = z.object({
  ...recordBase,
  moduleId: z.literal("support.evidence_journal"),
  category: z.enum([
    "survival",
    "growth",
    "social",
    "achievement",
    "selfworth",
  ]),
  content: z.string().trim().min(1),
  starred: z.boolean(),
  retentionMode: z.literal("user_scoped"),
  safetyLevel: z.literal("sensitive"),
});

export const InterventionSchema = z.object({
  ...recordBase,
  moduleId: idSchema,
  interventionType: idSchema,
  category: z.nativeEnum(ModuleCategory),
  status: z
    .nativeEnum(InterventionStatus)
    .default(InterventionStatus.RECOMMENDED),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  route: z.string().trim().optional(),
  source: z
    .nativeEnum(OutcomeSource)
    .default(OutcomeSource.SYSTEM_INFERENCE),
  privacy: z
    .nativeEnum(PrivacyLevel)
    .default(PrivacyLevel.PRIVATE),
  tags: tagsSchema,
  parameters: z.record(z.unknown()).default({}),
  rationale: z.string().trim().optional(),
  contextSnapshot: z.record(z.unknown()).optional(),
});

export const InterventionLifecycleEventSchema = z.object({
  ...recordBase,
  interventionId: idSchema,
  moduleId: idSchema,
  interventionType: idSchema,
  fromStatus: z.nativeEnum(InterventionStatus).nullable(),
  toStatus: z.nativeEnum(InterventionStatus),
  source: z
    .nativeEnum(OutcomeSource)
    .default(OutcomeSource.MODULE_EVENT),
  privacy: z
    .nativeEnum(PrivacyLevel)
    .default(PrivacyLevel.PRIVATE),
  reason: z.string().trim().optional(),
  metadata: z.record(z.unknown()).default({}),
  contextSnapshot: z.record(z.unknown()).optional(),
});

export const InterventionOutcomeSchema = z.object({
  ...recordBase,
  interventionId: idSchema,
  moduleId: idSchema,
  interventionType: idSchema,
  category: z.nativeEnum(ModuleCategory),
  status: z.nativeEnum(InterventionStatus),
  source: z
    .nativeEnum(OutcomeSource)
    .default(OutcomeSource.MODULE_EVENT),
  privacy: z
    .nativeEnum(PrivacyLevel)
    .default(PrivacyLevel.PRIVATE),
  accepted: z.boolean().optional(),
  completed: z.boolean().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  rating: z.number().min(1).max(5).optional(),
  userFeedback: z.string().trim().optional(),
  metrics: z.record(z.unknown()).default({}),
  contextSnapshot: z.record(z.unknown()).optional(),
});

export const ReflectionSchema = z.object({
  ...recordBase,
  sessionId: idSchema.optional(),
  interventionId: idSchema.optional(),
  moduleId: idSchema.optional(),
  reflectionId: idSchema.optional(),
  timestamp: isoDateString.optional(),
  version: z.literal(1).default(1),
  reflectionVersion: z.literal(1).default(1),

  outcomeSummary: z
    .object({
      completionStatus: z
        .nativeEnum(InterventionStatus)
        .nullable()
        .optional(),
      completionRate: z.number().min(0).max(1).optional(),
      durationMs: z.number().int().nonnegative().optional(),
      rating: z.number().int().min(1).max(5).optional(),
    })
    .optional(),

  insights: z
    .array(
      z.object({
        type: idSchema,
        value: z.union([
          z.string(),
          z.number(),
          z.boolean(),
        ]),
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),

  summary: z.string().trim().min(1),
  keyInsights: z
    .array(z.string().trim().min(1))
    .default([]),
  followUpSuggestions: z
    .array(z.string().trim().min(1))
    .default([]),

  confidence: z
    .union([
      z.number().min(0).max(1),
      z.nativeEnum(ConfidenceLevel),
    ])
    .default(ConfidenceLevel.LOW),

  metadata: z.record(z.unknown()).default({}),
  evidenceOutcomeIds: z.array(idSchema).default([]),

  privacy: z
    .nativeEnum(PrivacyLevel)
    .default(PrivacyLevel.PRIVATE),

  source: z
    .nativeEnum(OutcomeSource)
    .default(OutcomeSource.SYSTEM_INFERENCE),
});

export const UserMemorySchema = z.object({
  ...recordBase,
  memoryId: idSchema.optional(),
  moduleId: idSchema.optional(),
  category: z.nativeEnum(MemoryCategory).optional(),
  type: z.nativeEnum(MemoryType),
  key: idSchema,
  value: z.unknown(),

  evidenceCount: z.number().int().nonnegative().optional(),
  supportingReflectionIds: z.array(idSchema).default([]),

  confidence: z
    .union([
      z.number().min(0).max(1),
      z.nativeEnum(ConfidenceLevel),
    ])
    .default(ConfidenceLevel.MODERATE),

  confidenceLevel: z.nativeEnum(ConfidenceLevel).optional(),

  firstObservedAt: isoDateString.optional(),
  lastUpdatedAt: isoDateString.optional(),

  version: z.literal(1).default(1),
  status: z
    .nativeEnum(MemoryStatus)
    .default(MemoryStatus.ACTIVE),

  contradictionCount: z
    .number()
    .int()
    .nonnegative()
    .default(0),

  metadata: z.record(z.unknown()).default({}),
  deletedAt: isoDateString.nullable().optional(),

  privacy: z
    .nativeEnum(PrivacyLevel)
    .default(PrivacyLevel.PRIVATE),

  source: z
    .nativeEnum(OutcomeSource)
    .default(OutcomeSource.SYSTEM_INFERENCE),

  evidenceIds: z.array(idSchema).default([]),
  expiresAt: isoDateString.nullable().optional(),
  archivedAt: isoDateString.nullable().optional(),
});

export const PersonalizationProfileSchema = z.object({
  ...recordBase,
  profileVersion: z.literal(1).default(1),

  preferredInterventions: z.array(idSchema).default([]),
  avoidedInterventions: z.array(idSchema).default([]),

  effectiveStrategies: z
    .record(z.number().min(0).max(1))
    .default({}),

  accessibilityPreferences: z
    .record(z.unknown())
    .default({}),

  learningPreferences: z
    .record(z.unknown())
    .default({}),

  riskWindows: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        score: z.number().min(0).max(1),
        evidenceIds: z.array(idSchema).default([]),
      }),
    )
    .default([]),

  updatedFromMemoryIds: z.array(idSchema).default([]),

  privacy: z
    .nativeEnum(PrivacyLevel)
    .default(PrivacyLevel.PRIVATE),
});

export const PersonalizationHintSchema = z.object({
  id: idSchema,
  key: idSchema,
  value: z.unknown(),
  sourceMemoryIds: z.array(idSchema).min(1),
  evidenceCount: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  advisory: z.enum([
    "observational",
    "usable",
    "strong",
  ]),
  reasonCode: idSchema,
});

export const PersonalizationHintsResponseSchema = z.object({
  userId: idSchema,
  moduleId: idSchema,
  hints: z.array(PersonalizationHintSchema),
  generatedAt: isoDateString.nullable(),
  evidenceCount: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  version: z.literal(1),
});

export const UnsuccessfulConfigurationEvidenceSchema =
  z.object({
    key: idSchema,
    value: z.unknown(),
    evidenceCount: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
    reasonCode: idSchema,
  });

export const PreferredConfigurationEvidenceSchema =
  z.object({
    values: z.record(z.unknown()),
    sourceHintIds: z.array(idSchema).min(1),
    confidence: z.number().min(0).max(1),
    advisory: z.literal(true),
  });

export const SupportEvidenceEntrySchema = z.object({
  moduleId: idSchema,
  evidenceCount: z.number().int().nonnegative(),
  startedCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  partiallyCompletedCount: z
    .number()
    .int()
    .nonnegative(),
  abandonedCount: z.number().int().nonnegative(),

  completionRate: z
    .number()
    .min(0)
    .max(1)
    .nullable(),

  effectivenessRate: z
    .number()
    .min(0)
    .max(1)
    .nullable(),

  averageUserRating: z
    .number()
    .min(1)
    .max(5)
    .nullable(),

  recentOutcomeTrend: z.enum([
    "improving",
    "stable",
    "declining",
    "mixed",
    "insufficient_evidence",
  ]),

  preferredConfiguration:
    PreferredConfigurationEvidenceSchema.nullable(),

  unsuccessfulConfigurations: z.array(
    UnsuccessfulConfigurationEvidenceSchema,
  ),

  personalizationHints: z.array(
    PersonalizationHintSchema,
  ),

  lastUsedAt: isoDateString.nullable(),
  confidence: z.number().min(0).max(1),
  reasonCodes: z.array(idSchema),
  version: z.literal(1),
});

export const SupportEvidenceResponseSchema = z.object({
  userId: idSchema.nullable(),
  generatedAt: isoDateString.nullable(),
  modules: z.array(SupportEvidenceEntrySchema),
  version: z.literal(1),
  reasonCodes: z.array(idSchema),
});

const ReasoningFactorSchema = z.object({
  factor: idSchema,
  value: z.unknown(),
  contribution: z.enum([
    "strong",
    "moderate",
    "weak",
    "supporting",
    "conflicting",
  ]),
});

const reasoningListSchema = z
  .array(
    z.union([
      ReasoningFactorSchema,
      z.string().trim().min(1),
    ]),
  )
  .default([]);

export const PolicyActionSchema = z.object({
  type: z.nativeEnum(AdaptationActionType),
  target: z.nativeEnum(AdaptationDimension),
  parameters: z.record(z.unknown()).default({}),
});

export const SafetyResultSchema = z.object({
  level: z.nativeEnum(SafetyLevel),

  disposition: z.enum([
    "ALLOW",
    "MODIFY",
    "BLOCK",
    "ESCALATE",
  ]),

  reasons: tagsSchema,
  suggestedAction: z.string().trim().optional(),
  guardrails: z.record(z.unknown()).default({}),
});

export const AdaptationActionSchema = z.object({
  actionId: idSchema,
  type: z.nativeEnum(AdaptationActionType),
  target: z.nativeEnum(AdaptationDimension),
  parameters: z.record(z.unknown()).default({}),

  tier: z.number().int().min(1).max(10),
  numericPriority: z.number().int().optional(),

  confidence: confidenceRange,
  reason: z.string().trim().optional(),
  evidence: tagsSchema,

  durationMs: z.number().int().nonnegative().optional(),
  expiry: epochNumber.optional(),
  reversible: z.boolean(),

  safety: SafetyResultSchema.optional(),
});

export const AdaptationPlanSchema = z
  .object({
    planId: idSchema,
    timestamp: epochNumber,
    decisionTraceId: idSchema,

    situation: idSchema,
    primaryNeed: idSchema,
    secondaryNeeds: z.array(idSchema).default([]),

    reasoning: reasoningListSchema,
    actions: z.array(AdaptationActionSchema).default([]),

    overallConfidence: confidenceRange,
    sources: tagsSchema,

    userStateReference: z.record(z.unknown()),
    reEvaluateAt: epochNumber.optional(),

    priorityOrder: z.array(idSchema).default([]),
  })
  .superRefine((plan, ctx) => {
    const actionIds = new Set(
      plan.actions.map((action) => action.actionId),
    );

    if (
      actionIds.size === 0 &&
      plan.priorityOrder.length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priorityOrder"],
        message:
          "priorityOrder must be empty when the plan has no actions",
      });
    }

    const seen = new Set();

    plan.priorityOrder.forEach((actionId, index) => {
      if (seen.has(actionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["priorityOrder", index],
          message: `duplicate actionId in priorityOrder: ${actionId}`,
        });
      }

      seen.add(actionId);

      if (
        actionIds.size > 0 &&
        !actionIds.has(actionId)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["priorityOrder", index],
          message:
            `priorityOrder references unknown actionId: ${actionId}`,
        });
      }
    });
  });

export const TriggerSchema = z
  .object({
    dimension: idSchema,

    condition: z.nativeEnum(TriggerCondition),

    value: z.union([
      z.number(),
      z.string().trim().min(1),
      z.array(z.string().trim().min(1)).min(1),
    ]),
  })
  .superRefine((trigger, ctx) => {
    const isListCondition =
      trigger.condition === TriggerCondition.IN ||
      trigger.condition === TriggerCondition.NOT_IN;

    if (
      isListCondition &&
      !Array.isArray(trigger.value)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message:
          "in/not_in conditions require a non-empty array value",
      });
    }

    if (
      !isListCondition &&
      Array.isArray(trigger.value)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message:
          "comparison conditions require a scalar value",
      });
    }
  });

export const TriggerGroupSchema = z.object({
  operator: z.literal(TriggerGroupOperator.AND),
  triggers: z.array(TriggerSchema).min(1),
});

export const HysteresisSchema = z
  .object({
    activationThreshold: confidenceRange,
    deactivationThreshold: confidenceRange,
    cooldownMs: z.number().int().nonnegative(),
    minDurationMs: z.number().int().nonnegative(),
  })
  .superRefine((hysteresis, ctx) => {
    if (
      hysteresis.deactivationThreshold >
      hysteresis.activationThreshold
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deactivationThreshold"],
        message:
          "deactivationThreshold must not exceed activationThreshold",
      });
    }
  });

export const PolicyRuleSchema = z.object({
  id: idSchema,
  version: z.number().int().positive().default(1),
  scope: z.nativeEnum(PolicyScope),

  moduleId: idSchema.optional(),

  tier: z.number().int().min(1).max(10),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),

  triggerGroups: z.array(TriggerGroupSchema).min(1),
  confidenceThreshold: confidenceRange.optional(),

  action: PolicyActionSchema,
  hysteresis: HysteresisSchema.optional(),

  durationMs: z.number().int().nonnegative().optional(),

  reversal: z
    .enum(["auto", "none"])
    .default("none"),
});

export const TriggeredRuleSchema = z.object({
  ruleId: idSchema,
  ruleVersion: z.number().int().positive(),
  scope: z.nativeEnum(PolicyScope),
  tier: z.number().int().min(1).max(10),

  matchedTriggers: z
    .array(TriggerSchema)
    .default([]),

  confidence: confidenceRange.optional(),
});

export const ConflictRecordSchema = z.object({
  target: z.nativeEnum(AdaptationDimension),
  winnerActionId: idSchema,
  loserActionIds: z.array(idSchema).default([]),
  reason: z.string().trim().optional(),
});

export const OverrideRecordSchema = z.object({
  kind: z.enum(["preference", "safety", "hysteresis"]),
  actionId: idSchema.optional(),
  applied: z.boolean(),
  detail: z.string().trim().optional(),
});

export const PreferenceResultSchema = z.object({
  appliedRequests: z.array(idSchema).default([]),
  honoredRestrictions: z.array(idSchema).default([]),
  learnedSignalsUsed: z.array(idSchema).default([]),
});

export const DecisionTraceSchema = z.object({
  decisionId: idSchema,
  timestamp: epochNumber,
  userId: idSchema.optional(),
  moduleId: idSchema,

  inputRef: z.object({
    snapshotAt: epochNumber,
    userStateRef: idSchema.optional(),
  }),

  situation: idSchema,
  primaryNeed: idSchema,
  reasoning: reasoningListSchema,

  triggeredConditions: z
    .array(TriggeredRuleSchema)
    .default([]),

  rejectedConditions: z
    .array(TriggeredRuleSchema)
    .default([]),

  conflicts: z
    .array(ConflictRecordSchema)
    .default([]),

  overrides: z
    .array(OverrideRecordSchema)
    .default([]),

  safetyResult: SafetyResultSchema,

  preferenceResult: PreferenceResultSchema.default(
    () => ({
      appliedRequests: [],
      honoredRestrictions: [],
      learnedSignalsUsed: [],
    }),
  ),

  policyIds: z.array(idSchema).default([]),

  policyVersions: z
    .array(z.number().int().positive())
    .default([]),

  finalActions: z
    .array(AdaptationActionSchema)
    .default([]),

  confidence: confidenceRange,
  reEvaluateAt: epochNumber.optional(),
  sources: tagsSchema,
});

export const AdaptiveEngineInputSchema = z.object({
  contextSnapshot: z.record(z.unknown()),
  userState: z.record(z.unknown()),

  role4Signals: z
    .record(z.unknown())
    .optional(),

  userPreferences: z
    .record(z.unknown())
    .optional(),

  moduleContext: z.record(z.unknown()),

  currentTask: z
    .record(z.unknown())
    .optional(),

  currentGoal: z
    .record(z.unknown())
    .optional(),
});

export const AdaptationOutcomeEffectivenessSchema =
  z.object({
    observed: confidenceRange.optional(),
    confidence: confidenceRange.optional(),
    correlational: z.literal(true),
  });

/**
 * EffectivenessSignalSchema — Reflection Engine output (Phase 5).
 *
 * One signal aggregates historical Role 4 outcome evidence for a single
 * deterministic strategy identity (`moduleId:interventionType`). The signal
 * is strictly OBSERVATIONAL: `correlational` is a literal `true` and
 * `source` is the literal `observational_outcomes`, so reflection output can
 * never be mistaken for a causal claim.
 *
 * `actionType` holds the Role 4 execution vocabulary value
 * (`interventionType`); engine action verbs are not recorded on outcomes
 * (D1 vocabulary separation). `target` is intentionally absent: Role 4
 * outcome contracts do not record an adaptation target dimension, so none is
 * invented.
 *
 * `effectivenessScore` is omitted (not `0`) when evidence is insufficient —
 * zero evidence must never become a fabricated 0% or 100% claim.
 */
export const EffectivenessSignalSchema = z.object({
  userId: idSchema.optional(),
  moduleId: idSchema,
  actionType: idSchema,
  strategyId: idSchema,

  sampleSize: z.number().int().nonnegative(),
  positiveOutcomes: z.number().int().nonnegative(),
  negativeOutcomes: z.number().int().nonnegative(),

  effectivenessScore: confidenceRange.optional(),

  confidence: confidenceRange,

  evidenceCount: z.number().int().nonnegative(),

  source: z.literal("observational_outcomes"),
  correlational: z.literal(true),

  generatedAt: epochNumber,
});

export const AdaptationOutcomeSchema = z.object({
  ...recordBase,
  decisionId: idSchema,
  interventionId: idSchema.optional(),
  moduleId: idSchema,

  adaptationActions: z
    .array(AdaptationActionSchema)
    .default([]),

  beforeContextSnapshot: z
    .record(z.unknown())
    .optional(),

  afterContextSnapshot: z
    .record(z.unknown())
    .optional(),

  beforeUserState: z
    .record(z.unknown())
    .optional(),

  afterUserState: z
    .record(z.unknown())
    .optional(),

  outcomeMetrics: z
    .record(z.unknown())
    .default({}),

  userFeedback: z.string().trim().optional(),

  status: z
    .nativeEnum(AdaptationOutcomeStatus)
    .default(AdaptationOutcomeStatus.APPLIED),

  effectiveness:
    AdaptationOutcomeEffectivenessSchema.optional(),

  timestamp: epochNumber,
});

export const AdaptationDecisionRecordSchema = z
  .object({
    ...recordBase,
    decisionId: idSchema,
    moduleId: idSchema,
    timestamp: epochNumber,
    plan: AdaptationPlanSchema,
    trace: DecisionTraceSchema,
  })
  .superRefine((record, ctx) => {
    if (
      record.trace.decisionId !== record.decisionId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trace", "decisionId"],
        message:
          "trace.decisionId must match the record decisionId",
      });
    }
  });

export const ModuleConstraintSchema = z.object({
  type: idSchema,
  value: z.unknown(),
  description: z.string().trim().optional(),
});

export const ModuleGoalSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  metric: z.string().trim().optional(),
});

export const TaskReferenceSchema = z.object({
  kind: z.literal("derived"),
  source: idSchema,
  description: z.string().trim().optional(),
});

export const GoalReferenceSchema = z.object({
  kind: z.literal("derived"),
  source: idSchema,
  description: z.string().trim().optional(),
});

export const ModuleContextSchema = z.object({
  moduleId: idSchema,
  title: z.string().trim().min(1),
  category: z.nativeEnum(ModuleCategory),
  interventionTypes: z.array(idSchema).min(1),
  route: z.string().trim().optional(),

  tags: tagsSchema,
  disorders: z.array(idSchema).default([]),

  expectedOutcomeMetrics: z
    .array(idSchema)
    .default([]),

  safetyLevel: z.nativeEnum(SafetyLevel),

  repetitionLimit: z
    .number()
    .int()
    .positive()
    .optional(),

  supportedRoles: z
    .array(
      z.enum(["user", "guardian", "support"]),
    )
    .default(["user"]),

  coreFeatures: z.array(idSchema).default([]),

  supportedAdaptationDimensions: z
    .array(z.nativeEnum(AdaptationDimension))
    .default([]),

  restrictedDimensions: z
    .array(z.nativeEnum(AdaptationDimension))
    .default([]),

  constraints: z
    .array(ModuleConstraintSchema)
    .default([]),

  goals: z
    .array(ModuleGoalSchema)
    .default([]),

  modulePolicies: z
    .array(PolicyRuleSchema)
    .default([]),

  moduleState: z.unknown().optional(),
  currentTask: TaskReferenceSchema.optional(),
  currentGoal: GoalReferenceSchema.optional(),
});

export const SupportModuleDefinitionSchema = z
  .object({
    id: idSchema,

    // Stable canonical module identity.
    moduleId: idSchema.optional(),

    title: z.string().trim().min(1),
    description: z.string().trim().min(1),
    category: z.nativeEnum(ModuleCategory),
    interventionTypes: z.array(idSchema).min(1),
    route: z.string().trim().min(1),

    tags: tagsSchema,
    disorders: z.array(idSchema).default([]),

    expectedOutcomeMetrics: z
      .array(idSchema)
      .default([]),

    privacyDefault: z
      .nativeEnum(PrivacyLevel)
      .default(PrivacyLevel.PRIVATE),

    safetyLevel: z
      .nativeEnum(SafetyLevel)
      .default(SafetyLevel.STANDARD),

    repetitionLimit: z
      .object({
        maxCount: z.number().int().positive(),
        windowHours: z.number().positive(),
      })
      .default({
        maxCount: 2,
        windowHours: 24,
      }),

    supportedRoles: z
      .array(
        z.enum(["user", "guardian", "support"]),
      )
      .default(["user"]),

    // Role 4 metadata.
    developmentDomain: idSchema.optional(),
    supportedNeeds: tagsSchema,
    potentiallyRelevantDomains: tagsSchema,
    actions: tagsSchema,

    configurableParameters: z
      .record(z.unknown())
      .default({}),

    launchPolicy: z
      .enum([
        "user_initiated",
        "recommendation",
        "confirmation_required",
      ])
      .default("user_initiated"),

    lifecycleEvents: z
      .array(z.nativeEnum(InterventionStatus))
      .default([]),

    outcomeFields: tagsSchema,
    legacyIds: tagsSchema,

    // Adaptive-engine metadata.
    coreFeatures: z.array(idSchema).default([]),

    supportedAdaptationDimensions: z
      .array(z.nativeEnum(AdaptationDimension))
      .default([]),

    restrictedDimensions: z
      .array(z.nativeEnum(AdaptationDimension))
      .default([]),

    constraints: z
      .array(ModuleConstraintSchema)
      .default([]),

    goals: z
      .array(ModuleGoalSchema)
      .default([]),

    modulePolicies: z
      .array(PolicyRuleSchema)
      .default([]),
  })
  .superRefine((module, context) => {
    if (
      module.moduleId &&
      module.moduleId !== module.id
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "moduleId must match the runtime id",
        path: ["moduleId"],
      });
    }
  });

export const Role4Schemas = {
  intervention: InterventionSchema,
  supportModuleDefinition:
    SupportModuleDefinitionSchema,
  lifecycleEvent:
    InterventionLifecycleEventSchema,
  outcome: InterventionOutcomeSchema,
  reflection: ReflectionSchema,
  memory: UserMemorySchema,
  personalizationProfile:
    PersonalizationProfileSchema,
  personalizationHints:
    PersonalizationHintsResponseSchema,
  supportEvidence:
    SupportEvidenceResponseSchema,
  adaptationDecision:
    AdaptationDecisionRecordSchema,
};

export function validateIntervention(data) {
  return InterventionSchema.parse(data);
}

export function validateSupportModuleDefinition(data) {
  return SupportModuleDefinitionSchema.parse(data);
}

export function validateInterventionLifecycleEvent(
  data,
) {
  return InterventionLifecycleEventSchema.parse(data);
}

export function validateInterventionOutcome(data) {
  return InterventionOutcomeSchema.parse(data);
}

export function validateEffectivenessSignal(data) {
  return EffectivenessSignalSchema.parse(data);
}

export function validateReflection(data) {
  return ReflectionSchema.parse(data);
}

export function validateUserMemory(data) {
  return UserMemorySchema.parse(data);
}

export function validatePersonalizationProfile(data) {
  return PersonalizationProfileSchema.parse(data);
}

export function validatePersonalizationHints(data) {
  return PersonalizationHintsResponseSchema.parse(data);
}

export function validateSupportEvidenceResponse(
  data,
) {
  return SupportEvidenceResponseSchema.parse(data);
}

export function validateAdaptationAction(data) {
  return AdaptationActionSchema.parse(data);
}

export function validateAdaptationPlan(data) {
  return AdaptationPlanSchema.parse(data);
}

export function validatePolicyRule(data) {
  return PolicyRuleSchema.parse(data);
}

export function validateDecisionTrace(data) {
  return DecisionTraceSchema.parse(data);
}

export function validateAdaptiveEngineInput(data) {
  return AdaptiveEngineInputSchema.parse(data);
}

export function validateAdaptationOutcome(data) {
  return AdaptationOutcomeSchema.parse(data);
}

export function validateAdaptationDecisionRecord(
  data,
) {
  return AdaptationDecisionRecordSchema.parse(data);
}

export function validateModuleContext(data) {
  return ModuleContextSchema.parse(data);
}