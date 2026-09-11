import { useEffect, useRef, useState } from "react";

const SUCCESS_DURATION_MS = 1800;
const ERROR_DURATION_MS = 2500;

/**
 * Maps the REAL agent execution state (agentStore's `executionState`,
 * `pendingConfirmation`) plus the REAL voice state (useAgentVoice's
 * `isListening`/`isSpeaking`) to Bri's single visual state. This is a pure
 * projection, not a second state machine — every input already exists and is
 * driven by the backend's actual ExecutionState enum
 * (backend/services/agent_state.py) or the browser's real
 * SpeechRecognition/SpeechSynthesis state. Nothing here is inferred or faked.
 *
 * The only local state this hook owns is a short-lived "success"/"error"
 * flash right after a real terminal event, so Bri gives visible feedback
 * before settling back to idle — mirroring how the chat bubble itself
 * finalizes at that same moment.
 */
export default function useBriState({ executionState, pendingConfirmation, isListening, isSpeaking }) {
  const [transient, setTransient] = useState(null); // 'success' | 'error' | null
  const timeoutRef = useRef(null);
  const lastExecutionStateRef = useRef(executionState);

  useEffect(() => {
    if (executionState === lastExecutionStateRef.current) return;
    lastExecutionStateRef.current = executionState;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (executionState === "COMPLETED") {
      setTransient("success");
      timeoutRef.current = setTimeout(() => setTransient(null), SUCCESS_DURATION_MS);
    } else if (executionState === "FAILED") {
      setTransient("error");
      timeoutRef.current = setTimeout(() => setTransient(null), ERROR_DURATION_MS);
    } else {
      setTransient(null);
    }
  }, [executionState]);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  if (isListening) return { state: "listening", speaking: false };
  if (transient) return { state: transient, speaking: false };
  if (pendingConfirmation) return { state: "confirming", speaking: !!isSpeaking };
  if (executionState === "UNDERSTANDING") return { state: "thinking", speaking: false };
  if (executionState === "PLANNING") return { state: "planning", speaking: false };
  if (executionState === "EXECUTING" || executionState === "WAITING_FOR_TOOL") {
    return { state: "acting", speaking: false };
  }
  return { state: "idle", speaking: !!isSpeaking };
}

export const BRI_STATE_LABELS = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  planning: "Planning",
  acting: "Working on it",
  confirming: "Waiting for your confirmation",
  success: "Done",
  error: "Something went wrong",
};
