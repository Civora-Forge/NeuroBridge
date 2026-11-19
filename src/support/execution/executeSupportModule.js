import { assessSupportInput } from "@/support/safety";
import { getSupportModuleById } from "@/support/framework/supportModuleRegistry";
import {
  deliverInterventionAsync,
  transitionInterventionAsync,
} from "@/support/lifecycle/interventionLifecycle";
import { getRole4Repository } from "@/support/persistence/role4Repository";
import { InterventionStatus } from "@/support/schemas/supportSchemas";
import {
  ExecutionRequestSchema,
  ExecutionResultSchema,
  ExecutionStatus,
  SelectionMode,
  TriggerSource,
} from "./executionTypes";
import { DEFERRED_MODULE_IDS, getModuleExecutor } from "./moduleExecutors";
import { startFocusSessionIntervention, transitionFocusSessionIntervention } from "@/support/lifecycle/focusSessionLifecycle";

const startLocks = new Map();

function withStartLock(lockKey, work) {
  const next = (startLocks.get(lockKey) ?? Promise.resolve()).catch(() => {}).then(work);
  startLocks.set(lockKey, next);
  return next;
}

function now() {
  return new Date().toISOString();
}

function makeInterventionId() {
  return `intervention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function appendState(lifecycle, status, reason) {
  return [...lifecycle, { status, timestamp: now(), ...(reason ? { reason } : {}) }];
}

function createResult(request, lifecycle, overrides = {}) {
  const validTriggerSource = Object.values(TriggerSource).includes(request?.triggerSource)
    ? request.triggerSource
    : null;
  const validSelectionMode = Object.values(SelectionMode).includes(request?.selectionMode)
    ? request.selectionMode
    : null;
  return ExecutionResultSchema.parse({
    ok: false,
    status: ExecutionStatus.FAILED,
    interventionId: null,
    moduleId: typeof request?.moduleId === "string" && request.moduleId.trim() ? request.moduleId : "unknown",
    userId: typeof request?.userId === "string" && request.userId.trim() ? request.userId : null,
    contextSnapshotId: typeof request?.contextSnapshotId === "string" ? request.contextSnapshotId : null,
    triggerSource: validTriggerSource,
    selectionMode: validSelectionMode,
    configuration: request?.configuration && typeof request.configuration === "object" && !Array.isArray(request.configuration)
      ? request.configuration
      : {},
    lifecycle,
    error: null,
    reasonCodes: [],
    launch: null,
    ...overrides,
  });
}

/**
 * Validates and starts a support module through a domain-neutral boundary.
 * It intentionally does not render UI, choose a module, reflect, or write memory.
 *
 * @param {unknown} request
 * @returns {Promise<import("./executionTypes").ExecutionResult>}
 */
export async function executeSupportModule(request) {
  let lifecycle = appendState([], ExecutionStatus.CREATED);
  const parsed = ExecutionRequestSchema.safeParse(request);

  if (!parsed.success) {
    return createResult(request, appendState(lifecycle, ExecutionStatus.FAILED, "invalid_request"), {
      status: ExecutionStatus.FAILED,
      error: "Invalid execution request",
      reasonCodes: ["invalid_request"],
    });
  }

  const executionRequest = parsed.data;
  lifecycle = appendState(lifecycle, ExecutionStatus.VALIDATED);

  if (DEFERRED_MODULE_IDS.has(executionRequest.moduleId)) {
    return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.BLOCKED, "module_unavailable"), {
      status: ExecutionStatus.BLOCKED,
      reasonCodes: ["module_unavailable"],
    });
  }

  const module = getSupportModuleById(executionRequest.moduleId);
  if (!module || module.id !== executionRequest.moduleId) {
    return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.FAILED, "invalid_module_id"), {
      status: ExecutionStatus.FAILED,
      error: "Unknown canonical support module",
      reasonCodes: ["invalid_module_id"],
    });
  }

  const moduleExecutor = getModuleExecutor(module.id);
  if (!moduleExecutor) {
    return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.BLOCKED, "module_unavailable"), {
      status: ExecutionStatus.BLOCKED,
      reasonCodes: ["module_unavailable"],
    });
  }

  const safety = assessSupportInput({ userId: executionRequest.userId, moduleId: module.id, action: 'start', inputType: executionRequest.metadata.explicitRequest ? 'explicit_command' : 'structured_input', text: executionRequest.metadata.explicitRequest, metadata: executionRequest.metadata });
  if (!safety.allowed) {
    return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.BLOCKED, "safety_blocked"), {
      status: ExecutionStatus.BLOCKED,
      reasonCodes: safety.reasonCodes,
    });
  }

  const idempotencyKey = executionRequest.metadata.idempotencyKey;
  const lockKey = typeof idempotencyKey === "string" && idempotencyKey.trim()
    ? `${executionRequest.userId}:${module.id}:${idempotencyKey.trim()}`
    : null;

  const startModule = async () => {
  if (typeof idempotencyKey === "string" && idempotencyKey.trim()) {
    if (module.id === "support.focus_session") {
      const repository = await getRole4Repository(executionRequest.userId);
      const existing = (await repository.listInterventionsByModule(executionRequest.userId, module.id)).find(
        (item) => item.parameters?.execution?.metadata?.idempotencyKey === idempotencyKey,
      );
      if (existing) {
        return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.RUNNING, "duplicate_start"), {
          ok: true,
          status: ExecutionStatus.RUNNING,
          interventionId: existing.id,
          reasonCodes: ["duplicate_start"],
        });
      }
    } else {
      const repository = await getRole4Repository(executionRequest.userId);
      const existing = (await repository.listInterventionsByModule(executionRequest.userId, module.id)).find(
        (item) => item.parameters?.execution?.metadata?.idempotencyKey === idempotencyKey,
      );
      if (existing) {
        return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.RUNNING, "duplicate_start"), {
          ok: true,
          status: ExecutionStatus.RUNNING,
          interventionId: existing.id,
          reasonCodes: ["duplicate_start"],
        });
      }
    }
  }

  const interventionId = makeInterventionId();
  lifecycle = appendState(lifecycle, ExecutionStatus.STARTING);

  if (module.id === "support.focus_session") {
    try {
      await startFocusSessionIntervention({
        userId: executionRequest.userId,
        interventionId,
        parameters: {
          ...executionRequest.configuration,
          execution: { contextSnapshotId: executionRequest.contextSnapshotId, triggerSource: executionRequest.triggerSource, selectionMode: executionRequest.selectionMode, metadata: executionRequest.metadata, startTimestamp: now() },
        },
      });
      const launchResult = await moduleExecutor({
        interventionId,
        moduleId: module.id,
        userId: executionRequest.userId,
        planId: executionRequest.metadata.planId ?? null,
        contextSnapshotId: executionRequest.contextSnapshotId,
        configuration: executionRequest.configuration,
      });
      return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.RUNNING), {
        ok: launchResult.ok,
        status: ExecutionStatus.RUNNING,
        interventionId,
        launch: launchResult.launch ?? null,
        reasonCodes: ["execution_started"],
      });
    } catch (error) {
      return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.FAILED, "persistence_failed"), { status: ExecutionStatus.FAILED, interventionId, error: error instanceof Error ? error.message : "Focus Session persistence failed", reasonCodes: ["persistence_failed"] });
    }
  }

  const delivered = await deliverInterventionAsync({
    userId: executionRequest.userId,
    module,
    interventionId,
    parameters: {
      ...executionRequest.configuration,
      execution: {
        contextSnapshotId: executionRequest.contextSnapshotId,
        triggerSource: executionRequest.triggerSource,
        selectionMode: executionRequest.selectionMode,
        metadata: executionRequest.metadata,
        startTimestamp: now(),
      },
    },
  });

  if (delivered.status !== "delivered") {
    return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.BLOCKED, "delivery_blocked"), {
      status: ExecutionStatus.BLOCKED,
      interventionId,
      reasonCodes: delivered.reasonCodes ?? ["delivery_blocked"],
    });
  }

  await transitionInterventionAsync({
    userId: executionRequest.userId,
    interventionId,
    toStatus: InterventionStatus.STARTED,
    reason: "execution_started",
    metadata: {
      contextSnapshotId: executionRequest.contextSnapshotId,
      triggerSource: executionRequest.triggerSource,
      selectionMode: executionRequest.selectionMode,
      configuration: executionRequest.configuration,
    },
  });

  try {
    const launchResult = await moduleExecutor({
      interventionId,
      moduleId: module.id,
      userId: executionRequest.userId,
      planId: executionRequest.metadata.planId ?? null,
      contextSnapshotId: executionRequest.contextSnapshotId,
      configuration: executionRequest.configuration,
    });
    lifecycle = appendState(lifecycle, ExecutionStatus.RUNNING);
    return createResult(executionRequest, lifecycle, {
      ok: launchResult.ok,
      status: ExecutionStatus.RUNNING,
      interventionId,
      reasonCodes: ["execution_started"],
    });
  } catch (error) {
    await transitionInterventionAsync({
      userId: executionRequest.userId,
      interventionId,
      toStatus: InterventionStatus.FAILED,
      reason: "executor_failed",
    });
    return createResult(executionRequest, appendState(lifecycle, ExecutionStatus.FAILED, "executor_failed"), {
      status: ExecutionStatus.FAILED,
      interventionId,
      error: error instanceof Error ? error.message : "Module executor failed",
      reasonCodes: ["executor_failed"],
    });
  }
  };

  return lockKey ? withStartLock(lockKey, startModule) : startModule();
}
