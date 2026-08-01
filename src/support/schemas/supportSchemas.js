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

const isoDateString = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime({ offset: false }));

const idSchema = z.string().trim().min(1);
const tagsSchema = z.array(z.string().trim().min(1)).default([]);
const recordBase = {
  schemaVersion: z.literal(ROLE4_SCHEMA_VERSION).default(ROLE4_SCHEMA_VERSION),
  id: idSchema,
  userId: idSchema,
  createdAt: isoDateString.default(() => new Date().toISOString()),
  updatedAt: isoDateString.default(() => new Date().toISOString()),
};

export const InterventionSchema = z.object({
  ...recordBase,
  moduleId: idSchema,
  interventionType: idSchema,
  category: z.nativeEnum(ModuleCategory),
  status: z.nativeEnum(InterventionStatus).default(InterventionStatus.RECOMMENDED),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  route: z.string().trim().optional(),
  source: z.nativeEnum(OutcomeSource).default(OutcomeSource.SYSTEM_INFERENCE),
  privacy: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
  tags: tagsSchema,
  parameters: z.record(z.unknown()).default({}),
  rationale: z.string().trim().optional(),
  contextSnapshot: z.record(z.unknown()).optional(),
});

export const SupportModuleDefinitionSchema = z.object({
  id: idSchema,
  // `id` remains the runtime lookup key. New need-based modules also expose
  // `moduleId` explicitly so UI ownership and routes do not define identity.
  moduleId: idSchema.optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.nativeEnum(ModuleCategory),
  interventionTypes: z.array(idSchema).min(1),
  route: z.string().trim().min(1),
  tags: tagsSchema,
  disorders: z.array(idSchema).default([]),
  expectedOutcomeMetrics: z.array(idSchema).default([]),
  privacyDefault: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
  safetyLevel: z.nativeEnum(SafetyLevel).default(SafetyLevel.STANDARD),
  repetitionLimit: z.object({
    maxCount: z.number().int().positive(),
    windowHours: z.number().positive(),
  }).default({ maxCount: 2, windowHours: 24 }),
  supportedRoles: z.array(z.enum(["user", "guardian", "support"])).default(["user"]),
  developmentDomain: idSchema.optional(),
  supportedNeeds: tagsSchema,
  potentiallyRelevantDomains: tagsSchema,
  actions: tagsSchema,
  configurableParameters: z.record(z.unknown()).default({}),
  launchPolicy: z.enum(["user_initiated", "recommendation", "confirmation_required"]).default("user_initiated"),
  lifecycleEvents: z.array(z.nativeEnum(InterventionStatus)).default([]),
  outcomeFields: tagsSchema,
  legacyIds: tagsSchema,
}).superRefine((module, context) => {
  if (module.moduleId && module.moduleId !== module.id) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "moduleId must match the runtime id",
      path: ["moduleId"],
    });
  }
});

export const InterventionLifecycleEventSchema = z.object({
  ...recordBase,
  interventionId: idSchema,
  moduleId: idSchema,
  interventionType: idSchema,
  fromStatus: z.nativeEnum(InterventionStatus).nullable(),
  toStatus: z.nativeEnum(InterventionStatus),
  source: z.nativeEnum(OutcomeSource).default(OutcomeSource.MODULE_EVENT),
  privacy: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
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
  source: z.nativeEnum(OutcomeSource).default(OutcomeSource.MODULE_EVENT),
  privacy: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
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
  outcomeSummary: z.object({
    completionStatus: z.nativeEnum(InterventionStatus).nullable().optional(),
    completionRate: z.number().min(0).max(1).optional(),
    durationMs: z.number().int().nonnegative().optional(),
    rating: z.number().int().min(1).max(5).optional(),
  }).optional(),
  insights: z.array(z.object({
    type: idSchema,
    value: z.union([z.string(), z.number(), z.boolean()]),
    confidence: z.number().min(0).max(1),
  })).default([]),
  summary: z.string().trim().min(1),
  keyInsights: z.array(z.string().trim().min(1)).default([]),
  followUpSuggestions: z.array(z.string().trim().min(1)).default([]),
  confidence: z.union([z.number().min(0).max(1), z.nativeEnum(ConfidenceLevel)]).default(ConfidenceLevel.LOW),
  metadata: z.record(z.unknown()).default({}),
  evidenceOutcomeIds: z.array(idSchema).default([]),
  privacy: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
  source: z.nativeEnum(OutcomeSource).default(OutcomeSource.SYSTEM_INFERENCE),
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
  confidence: z.union([z.number().min(0).max(1), z.nativeEnum(ConfidenceLevel)]).default(ConfidenceLevel.MODERATE),
  confidenceLevel: z.nativeEnum(ConfidenceLevel).optional(),
  firstObservedAt: isoDateString.optional(),
  lastUpdatedAt: isoDateString.optional(),
  version: z.literal(1).default(1),
  status: z.nativeEnum(MemoryStatus).default(MemoryStatus.ACTIVE),
  contradictionCount: z.number().int().nonnegative().default(0),
  metadata: z.record(z.unknown()).default({}),
  deletedAt: isoDateString.nullable().optional(),
  privacy: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
  source: z.nativeEnum(OutcomeSource).default(OutcomeSource.SYSTEM_INFERENCE),
  evidenceIds: z.array(idSchema).default([]),
  expiresAt: isoDateString.nullable().optional(),
  archivedAt: isoDateString.nullable().optional(),
});

export const PersonalizationProfileSchema = z.object({
  ...recordBase,
  profileVersion: z.literal(1).default(1),
  preferredInterventions: z.array(idSchema).default([]),
  avoidedInterventions: z.array(idSchema).default([]),
  effectiveStrategies: z.record(z.number().min(0).max(1)).default({}),
  accessibilityPreferences: z.record(z.unknown()).default({}),
  learningPreferences: z.record(z.unknown()).default({}),
  riskWindows: z.array(z.object({
    label: z.string().trim().min(1),
    score: z.number().min(0).max(1),
    evidenceIds: z.array(idSchema).default([]),
  })).default([]),
  updatedFromMemoryIds: z.array(idSchema).default([]),
  privacy: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
});

export const PersonalizationHintSchema = z.object({
  id: idSchema,
  key: idSchema,
  value: z.unknown(),
  sourceMemoryIds: z.array(idSchema).min(1),
  evidenceCount: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  advisory: z.enum(["observational", "usable", "strong"]),
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

export const Role4Schemas = {
  intervention: InterventionSchema,
  supportModuleDefinition: SupportModuleDefinitionSchema,
  lifecycleEvent: InterventionLifecycleEventSchema,
  outcome: InterventionOutcomeSchema,
  reflection: ReflectionSchema,
  memory: UserMemorySchema,
  personalizationProfile: PersonalizationProfileSchema,
  personalizationHints: PersonalizationHintsResponseSchema,
};

export function validateIntervention(data) {
  return InterventionSchema.parse(data);
}

export function validateSupportModuleDefinition(data) {
  return SupportModuleDefinitionSchema.parse(data);
}

export function validateInterventionLifecycleEvent(data) {
  return InterventionLifecycleEventSchema.parse(data);
}

export function validateInterventionOutcome(data) {
  return InterventionOutcomeSchema.parse(data);
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
