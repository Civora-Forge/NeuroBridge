import { z } from "zod";
import { ROLE4_SCHEMA_VERSION } from "./storageKeys";

export const InterventionStatus = {
  RECOMMENDED: "recommended",
  SHOWN: "shown",
  ACCEPTED: "accepted",
  STARTED: "started",
  PROGRESSED: "progressed",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
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
  summary: z.string().trim().min(1),
  keyInsights: z.array(z.string().trim().min(1)).default([]),
  followUpSuggestions: z.array(z.string().trim().min(1)).default([]),
  confidence: z.nativeEnum(ConfidenceLevel).default(ConfidenceLevel.LOW),
  evidenceOutcomeIds: z.array(idSchema).default([]),
  privacy: z.nativeEnum(PrivacyLevel).default(PrivacyLevel.PRIVATE),
  source: z.nativeEnum(OutcomeSource).default(OutcomeSource.SYSTEM_INFERENCE),
});

export const UserMemorySchema = z.object({
  ...recordBase,
  type: z.nativeEnum(MemoryType),
  key: idSchema,
  value: z.unknown(),
  confidence: z.nativeEnum(ConfidenceLevel).default(ConfidenceLevel.MODERATE),
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

export const Role4Schemas = {
  intervention: InterventionSchema,
  supportModuleDefinition: SupportModuleDefinitionSchema,
  lifecycleEvent: InterventionLifecycleEventSchema,
  outcome: InterventionOutcomeSchema,
  reflection: ReflectionSchema,
  memory: UserMemorySchema,
  personalizationProfile: PersonalizationProfileSchema,
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
