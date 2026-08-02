import { z } from "zod";

export const ExecutionStatus = Object.freeze({
  CREATED: "created",
  VALIDATED: "validated",
  STARTING: "starting",
  RUNNING: "running",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
  CANCELLED: "cancelled",
  FAILED: "failed",
  BLOCKED: "blocked",
});

export const TriggerSource = Object.freeze({
  MANUAL: "manual",
  VOICE: "voice",
  CHAT: "chat",
  CONTEXT: "context",
  SYSTEM: "system",
});

export const SelectionMode = Object.freeze({
  EXPLICIT_REQUEST: "explicit_request",
  ADAPTIVE_RANKING: "adaptive_ranking",
  FALLBACK: "fallback",
});

const idSchema = z.string().trim().min(1);

export const ExecutionRequestSchema = z.object({
  moduleId: idSchema,
  userId: idSchema,
  contextSnapshotId: idSchema.nullable().default(null),
  triggerSource: z.nativeEnum(TriggerSource).default(TriggerSource.MANUAL),
  selectionMode: z.nativeEnum(SelectionMode).default(SelectionMode.EXPLICIT_REQUEST),
  configuration: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
});

export const ExecutionLifecycleEventSchema = z.object({
  status: z.nativeEnum(ExecutionStatus),
  timestamp: z.string().datetime(),
  reason: z.string().optional(),
});

export const ExecutionResultSchema = z.object({
  ok: z.boolean(),
  status: z.nativeEnum(ExecutionStatus),
  interventionId: idSchema.nullable(),
  moduleId: idSchema,
  userId: idSchema.nullable(),
  contextSnapshotId: idSchema.nullable(),
  triggerSource: z.nativeEnum(TriggerSource).nullable(),
  selectionMode: z.nativeEnum(SelectionMode).nullable(),
  configuration: z.record(z.unknown()),
  lifecycle: z.array(ExecutionLifecycleEventSchema),
  error: z.string().nullable(),
  reasonCodes: z.array(z.string()),
});

export const LifecycleAction = Object.freeze({
  PROGRESS: "progress",
  PAUSE: "pause",
  RESUME: "resume",
  COMPLETE: "complete",
  ABANDON: "abandon",
  CANCEL: "cancel",
  FAIL: "fail",
  RATE: "rate",
});

export const ProgressMetadataSchema = z.object({
  progressType: z.string().trim().min(1).optional(),
  completedUnits: z.number().nonnegative().optional(),
  totalUnits: z.number().positive().optional(),
  progressRatio: z.number().min(0).max(1).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  details: z.record(z.unknown()).default({}),
}).default({});

export const CompletionOutcomeSchema = z.object({
  completionStatus: z.enum(["completed", "partially_completed"]).default("completed"),
  durationMs: z.number().int().nonnegative().optional(),
  metrics: z.record(z.unknown()).default({}),
  finalConfiguration: z.record(z.unknown()).default({}),
  userRating: z.number().int().min(1).max(5).optional(),
  userFeedback: z.string().trim().max(500).optional(),
}).default({});

export const LifecycleCommandRequestSchema = z.object({
  userId: idSchema,
  interventionId: idSchema,
  moduleId: idSchema,
  action: z.nativeEnum(LifecycleAction),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
  progress: ProgressMetadataSchema.optional(),
  outcome: CompletionOutcomeSchema.optional(),
});

/**
 * @typedef {z.infer<typeof ExecutionRequestSchema>} ExecutionRequest
 * @typedef {z.infer<typeof ExecutionResultSchema>} ExecutionResult
 * @typedef {z.infer<typeof ExecutionLifecycleEventSchema>} LifecycleEvent
 * @typedef {import("@/support/schemas/supportSchemas").InterventionSchema} InterventionRecord
 * @typedef {(input: { interventionId: string, moduleId: string, userId: string, configuration: Record<string, unknown> }) => Promise<{ ok: boolean, status: string }>} ModuleExecutor
 */
