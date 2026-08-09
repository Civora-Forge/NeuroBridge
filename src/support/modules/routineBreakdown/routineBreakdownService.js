/**
 * routineBreakdownService.js — Routine Visualizer decomposition logic.
 *
 * The Routine Visualizer's "Break into steps" layer reuses the shared
 * taskBreakdown templates (Bare Minimum / Standard / Hero Mode) for its
 * deterministic fallback, and prefers the Gemini provider through the single
 * AI facade for richer, task-specific steps. Either path always returns a
 * validated, ordered sequence of completable steps. Performance signals are
 * built for the adaptive interfaces; this module never talks to the engine.
 */

import { generateRoutineBreakdown as callAiRoutineBreakdown } from "@/features/socialCommunication/services/aiService";
import { generateTaskBreakdown } from "@/support/modules/taskBreakdown/taskBreakdownService";
import {
  BREAKDOWN_DEFAULT_STEP_COUNT,
  BREAKDOWN_MAX_STEP_COUNT,
  BREAKDOWN_MIN_STEP_COUNT,
  BREAKDOWN_SOURCE,
  RoutineBreakdownSchema,
} from "./routineBreakdownTypes";

// ─────────────────────────────────────────────
//  Config + deterministic fallback
// ─────────────────────────────────────────────
export function buildBreakdownConfig({
  task = "",
  stepCount = BREAKDOWN_DEFAULT_STEP_COUNT,
  selectedStyle = "Standard",
  signals = {},
  variantSeed = 0,
} = {}) {
  const requestedCount = Number.isInteger(stepCount)
    ? Math.min(BREAKDOWN_MAX_STEP_COUNT, Math.max(BREAKDOWN_MIN_STEP_COUNT, stepCount))
    : BREAKDOWN_DEFAULT_STEP_COUNT;

  return {
    task: String(task ?? "").trim(),
    stepCount: requestedCount,
    selectedStyle,
    signals,
    variantSeed,
    aiEnabled: true,
  };
}

function slugify(value) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `step`;
}

function ensureUniqueId(baseId, usedIds) {
  let candidate = baseId;
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

/**
 * Normalize a breakdown's steps to a deterministic, validated shape: ordered
 * by `order`, unique ids, non-empty titles, `completed` defaulting to false.
 */
export function normalizeBreakdown(breakdown = {}) {
  const title = String(breakdown.title ?? breakdown.task ?? "").trim();
  const rawSteps = Array.isArray(breakdown.steps) ? breakdown.steps : [];

  const usedIds = new Set();
  const steps = rawSteps
    .map((step, index) => {
      const stepTitle = String(step.title ?? step.text ?? "").trim();
      if (!stepTitle) return null;
      const baseId = String(step.id ?? slugify(stepTitle));
      return {
        id: ensureUniqueId(baseId, usedIds),
        order: Number.isInteger(step.order) && step.order >= 0 ? step.order : index,
        title: stepTitle,
        description: step.description ? String(step.description).trim() : undefined,
        estimatedEffort:
          Number.isFinite(step.estimatedEffort) && step.estimatedEffort > 0
            ? Math.floor(step.estimatedEffort)
            : step.time && Number.isFinite(step.time) && step.time > 0
              ? Math.floor(step.time)
              : undefined,
        completed: step.completed === true,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  return {
    taskId: String(breakdown.taskId ?? (slugify(title) || "task")),
    title,
    description: breakdown.description ? String(breakdown.description).trim() : undefined,
    steps,
  };
}

export function getFallbackRoutineBreakdown(task, config = {}) {
  const resolved = buildBreakdownConfig({ task, ...config });
  const templateSteps = generateTaskBreakdown(resolved.task, {
    selectedStyle: resolved.selectedStyle,
  });
  const trimmed = templateSteps.slice(0, resolved.stepCount);

  return normalizeBreakdown({
    taskId: slugify(resolved.task),
    title: resolved.task,
    steps: trimmed.map((step) => ({
      id: step.id,
      title: step.text,
      estimatedEffort: step.time,
    })),
  });
}

/**
 * Generate a routine breakdown, preferring the AI provider and always degrading
 * to the deterministic fallback. Returns `{ breakdown, source, aiAvailable,
 * aiError }`. Never throws.
 */
export async function generateRoutineBreakdown(task, config = {}, { apiKey } = {}) {
  const resolved = buildBreakdownConfig({ task, ...config });

  let aiBreakdown = null;
  let aiError = null;
  if (resolved.aiEnabled && resolved.task && apiKey) {
    try {
      aiBreakdown = await callAiRoutineBreakdown({
        task: resolved.task,
        config: {
          stepCount: resolved.stepCount,
        },
        apiKey,
      });
    } catch (error) {
      aiError = error?.message ?? String(error);
    }
  }

  if (aiBreakdown && typeof aiBreakdown === "object" && RoutineBreakdownSchema.safeParse(aiBreakdown).success) {
    const normalized = normalizeBreakdown(aiBreakdown);
    if (normalized.steps.length > 0) {
      return {
        breakdown: normalized,
        source: BREAKDOWN_SOURCE.AI,
        aiAvailable: true,
        aiError: null,
      };
    }
  }

  return {
    breakdown: getFallbackRoutineBreakdown(resolved.task, resolved),
    source: BREAKDOWN_SOURCE.FALLBACK,
    aiAvailable: false,
    aiError,
  };
}

// ─────────────────────────────────────────────
//  Progress + structured performance signal
// ─────────────────────────────────────────────
export function buildBreakdownProgress(steps = [], completedStepIds = []) {
  const normalized = normalizeBreakdown({ steps });
  const validIds = new Set(normalized.steps.map((step) => step.id));
  const completedIds = new Set(
    [...completedStepIds].map(String).filter((id) => validIds.has(id)),
  );
  const total = normalized.steps.length;
  const completed = completedIds.size;

  return {
    total,
    completed,
    completionRate: total > 0 ? completed / total : 0,
    status:
      total > 0 && completed === total ? "completed" : completed > 0 ? "partially_completed" : "not_started",
  };
}

export function buildRoutineBreakdownPerformance({
  steps,
  completedStepIds,
  selectedStyle,
  requestedStepCount,
  stepEdits,
  stepReorders,
  durationMs,
} = {}) {
  const progress = buildBreakdownProgress(steps, completedStepIds);

  return {
    completionStatus: progress.status,
    durationMs: Number.isFinite(durationMs) && durationMs >= 0 ? Math.floor(durationMs) : undefined,
    metrics: {
      stepsCreated: progress.total,
      stepsCompleted: progress.completed,
      completionRate: progress.completionRate,
      selectedStyle,
      requestedStepCount:
        Number.isInteger(requestedStepCount) && requestedStepCount >= 0
          ? Math.min(BREAKDOWN_MAX_STEP_COUNT, Math.max(BREAKDOWN_MIN_STEP_COUNT, requestedStepCount))
          : progress.total,
      stepEdits: Number.isInteger(stepEdits) && stepEdits >= 0 ? stepEdits : 0,
      stepReorders: Number.isInteger(stepReorders) && stepReorders >= 0 ? stepReorders : 0,
    },
  };
}
