/**
 * routineBreakdownTypes.js — Shared constants and Zod schemas for the Routine
 * Visualizer's task-decomposition layer.
 *
 * The Routine Visualizer keeps its existing timeline of daily tasks and gains
 * a decomposition layer: any task can be broken into ordered, completable
 * steps. The step shape mirrors the shared support taskBreakdown module so the
 * two stay consistent, while remaining a deterministic, validated contract.
 *
 * AI decomposition is optional; a deterministic fallback always runs.
 */

import { z } from "zod";

export const ROUTINE_BREAKDOWN_MODULE_ID = "asd.routine-breakdown";

export const BREAKDOWN_SOURCE = Object.freeze({
  AI: "ai",
  FALLBACK: "fallback",
});

export const BREAKDOWN_DEFAULT_STEP_COUNT = 5;
export const BREAKDOWN_MIN_STEP_COUNT = 2;
export const BREAKDOWN_MAX_STEP_COUNT = 8;

export const RoutineBreakdownStepSchema = z.object({
  id: z.string().trim().min(1),
  order: z.number().int().nonnegative(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  estimatedEffort: z.number().int().nonnegative().optional(),
  completed: z.boolean().default(false),
});

export const RoutineBreakdownSchema = z.object({
  taskId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  steps: z.array(RoutineBreakdownStepSchema).min(1),
});
