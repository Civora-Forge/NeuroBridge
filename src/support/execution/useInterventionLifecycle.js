import { useCallback, useEffect, useRef, useState } from "react";
import {
  abandonSupportModule,
  cancelSupportModule,
  completeSupportModule,
  executeSupportModule,
  failSupportModule,
  pauseSupportModule,
  progressSupportModule,
  rateSupportModule,
  resumeSupportModule,
} from "./executionApi";

const TERMINAL_STATUSES = new Set([
  "completed",
  "partially_completed",
  "abandoned",
  "cancelled",
  "failed",
  "blocked",
]);

function initialState() {
  return {
    interventionId: null,
    status: null,
    isStarting: false,
    isUpdating: false,
    error: null,
  };
}

function clientFailure(message, reasonCode) {
  return {
    ok: false,
    status: "failed",
    error: message,
    reasonCodes: [reasonCode],
  };
}

/**
 * Generic UI adapter for the public Role 4 execution API.
 * It intentionally owns no persistence, module behavior, or unmount cleanup.
 */
export function useInterventionLifecycle({
  userId,
  moduleId,
  planId = null,
  contextSnapshotId = null,
  triggerSource = "manual",
  selectionMode = "explicit_request",
  configuration = {},
} = {}) {
  const [state, setState] = useState(initialState);
  const operationRef = useRef(false);
  const terminalRef = useRef(false);
  const activeUserRef = useRef(userId);
  const interventionIdRef = useRef(null);

  useEffect(() => {
    if (activeUserRef.current !== userId) {
      activeUserRef.current = userId;
      operationRef.current = false;
      terminalRef.current = false;
      interventionIdRef.current = null;
      setState(initialState());
    }
  }, [userId]);

  const applyResult = useCallback((result) => {
    const status = result.intervention?.status ?? result.status;
    terminalRef.current = TERMINAL_STATUSES.has(status);
    interventionIdRef.current = result.interventionId ?? interventionIdRef.current;
    setState((current) => ({
      ...current,
      interventionId: result.interventionId ?? current.interventionId,
      status,
      isStarting: false,
      isUpdating: false,
      error: result.ok ? null : result.error || result.reasonCodes?.[0] || "Lifecycle action failed",
    }));
    return result;
  }, []);

  const start = useCallback(async (metadata = {}) => {
    if (operationRef.current || interventionIdRef.current) {
      return clientFailure("An intervention has already been started", "duplicate_start");
    }
    if (!userId || !moduleId) {
      return clientFailure("A userId and moduleId are required", "missing_start_identity");
    }

    operationRef.current = true;
    setState((current) => ({ ...current, isStarting: true, error: null }));
    try {
      const result = await executeSupportModule({
        userId,
        moduleId,
        contextSnapshotId,
        triggerSource,
        selectionMode,
        configuration,
        metadata: { ...metadata, planId },
      });
      return applyResult(result);
    } finally {
      operationRef.current = false;
    }
  }, [applyResult, configuration, contextSnapshotId, moduleId, planId, selectionMode, triggerSource, userId]);

  const runCommand = useCallback(async (command, options = {}) => {
    if (!interventionIdRef.current) {
      return clientFailure("Start an intervention before updating it", "intervention_not_started");
    }
    if (operationRef.current) {
      return clientFailure("Another lifecycle action is in progress", "operation_in_progress");
    }
    if (terminalRef.current && command !== rateSupportModule) {
      return clientFailure("This intervention is already terminal", "terminal_intervention");
    }

    operationRef.current = true;
    setState((current) => ({ ...current, isUpdating: true, error: null }));
    try {
      const result = await command({
        userId,
        interventionId: interventionIdRef.current,
        moduleId,
        ...options,
      });
      return applyResult(result);
    } finally {
      operationRef.current = false;
    }
  }, [applyResult, moduleId, userId]);

  const progress = useCallback((metadata = {}) => runCommand(progressSupportModule, { progress: metadata }), [runCommand]);
  const pause = useCallback((metadata = {}) => runCommand(pauseSupportModule, { metadata }), [runCommand]);
  const resume = useCallback((metadata = {}) => runCommand(resumeSupportModule, { metadata }), [runCommand]);
  const complete = useCallback((outcome = {}) => runCommand(completeSupportModule, { outcome }), [runCommand]);
  const abandon = useCallback((reason, metadata = {}) => runCommand(abandonSupportModule, {
    metadata: { ...metadata, reason },
  }), [runCommand]);
  const cancel = useCallback((reason, metadata = {}) => runCommand(cancelSupportModule, {
    metadata: { ...metadata, reason },
  }), [runCommand]);
  const fail = useCallback((error, metadata = {}) => runCommand(failSupportModule, {
    metadata: { ...metadata, error: String(error ?? "") },
  }), [runCommand]);
  const rate = useCallback(({ rating, feedback, storeFeedback = false } = {}) => runCommand(rateSupportModule, {
    metadata: { storeFeedback },
    outcome: { userRating: rating, userFeedback: feedback },
  }), [runCommand]);

  const reset = useCallback(() => {
    operationRef.current = false;
    terminalRef.current = false;
    interventionIdRef.current = null;
    setState(initialState());
  }, []);

  return {
    ...state,
    hasStarted: Boolean(state.interventionId),
    isTerminal: TERMINAL_STATUSES.has(state.status),
    start,
    progress,
    pause,
    resume,
    complete,
    abandon,
    cancel,
    fail,
    rate,
    reset,
  };
}
