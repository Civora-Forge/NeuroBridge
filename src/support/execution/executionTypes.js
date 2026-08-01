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

/**
 * @typedef {z.infer<typeof ExecutionRequestSchema>} ExecutionRequest
 * @typedef {z.infer<typeof ExecutionResultSchema>} ExecutionResult
 * @typedef {z.infer<typeof ExecutionLifecycleEventSchema>} LifecycleEvent
 * @typedef {import("@/support/schemas/supportSchemas").InterventionSchema} InterventionRecord
 * @typedef {(input: { interventionId: string, moduleId: string, userId: string, configuration: Record<string, unknown> }) => Promise<{ ok: boolean, status: string }>} ModuleExecutor
 */
