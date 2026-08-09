/**
 * useVoiceInput.js — Voice capture for the Social Communication Simulator,
 * built on the Web Speech API. Text input remains the always-available
 * fallback (handled by the UI). Errors are human-readable and always point the
 * user to the text option. Raw audio is never stored.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export const SPEECH_ERROR_MESSAGES = {
  "not-allowed": "Microphone permission was not granted. You can type your reply instead.",
  "service-not-allowed": "Speech recognition is blocked. You can type your reply instead.",
  "permission-denied": "Microphone permission was not granted. You can type your reply instead.",
  "no-speech": "No speech was detected. Try speaking again, or type your reply.",
  network: "Speech recognition is unavailable right now. You can type your reply instead.",
  "audio-capture": "The microphone could not be started. You can type your reply instead.",
  start_failed: "Speech recognition could not start. You can type your reply instead.",
};

export function resolveSpeechErrorMessage(code) {
  return SPEECH_ERROR_MESSAGES[code] ?? SPEECH_ERROR_MESSAGES.start_failed;
}

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createSpeechRecognition() {
  if (!isSpeechRecognitionSupported()) return null;
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  return new Ctor();
}

/**
 * Wire a recognition instance to the hook contract. Pure enough to unit test
 * with a fake recognition object. Never throws.
 */
export function createSpeechController(recognition, handlers = {}) {
  const { onFinal, onInterim, onError, onDone } = handlers;
  let startedAt = null;
  let firstResultAt = null;
  let finalText = "";
  let pendingInterim = "";
  let cancelled = false;

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";
    const results = event?.results ?? [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const transcript = result?.[0]?.transcript ?? "";
      if (result?.isFinal) final += transcript;
      else interim += transcript;
    }
    if (final) {
      if (firstResultAt === null) firstResultAt = Date.now();
      finalText = `${finalText} ${pendingInterim} ${final}`.replace(/\s{2,}/g, " ").trim();
      pendingInterim = "";
      onFinal?.(finalText);
    } else if (interim) {
      pendingInterim = interim;
      onInterim?.(interim);
    }
  };

  recognition.onerror = (event) => {
    onError?.(resolveSpeechErrorMessage(event?.error ?? "unknown"));
  };

  recognition.onend = () => {
    const durationMs = startedAt ? Date.now() - startedAt : null;
    const latencyMs = firstResultAt && startedAt ? firstResultAt - startedAt : null;
    if (!cancelled) {
      onDone?.({ transcript: finalText || pendingInterim, durationMs, latencyMs });
    }
    cancelled = false;
    firstResultAt = null;
  };

  return {
    start() {
      finalText = "";
      pendingInterim = "";
      firstResultAt = null;
      startedAt = Date.now();
      cancelled = false;
      try {
        recognition.start();
      } catch {
        onError?.(resolveSpeechErrorMessage("start_failed"));
      }
    },
    stop() {
      try {
        recognition.stop();
      } catch {
        // already stopped — onend still fires for a clean final state.
      }
    },
    cancel() {
      cancelled = true;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    },
  };
}

/**
 * @returns {{
 *   supported: boolean,
 *   listening: boolean,
 *   transcript: string,
 *   interimTranscript: string,
 *   error: string | null,
 *   capture: { transcript: string, durationMs: number | null, latencyMs: number | null } | null,
 *   start: () => void,
 *   stop: () => void,
 *   cancel: () => void,
 *   clearError: () => void,
 * }}
 */
export function useVoiceInput() {
  const supported = isSpeechRecognitionSupported();
  const recognitionRef = useRef(null);
  const controllerRef = useRef(null);

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);
  const [capture, setCapture] = useState(null);

  useEffect(() => {
    if (!supported) return undefined;
    const recognition = createSpeechRecognition();
    if (!recognition) return undefined;
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;

    const controller = createSpeechController(recognition, {
      onFinal: (text) => setTranscript(text),
      onInterim: (text) => setInterimTranscript(text),
      onError: (message) => setError(message),
      onDone: (nextCapture) => {
        setCapture(nextCapture);
        setListening(false);
      },
    });
    controllerRef.current = controller;

    return () => {
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    };
  }, [supported]);

  const start = useCallback(() => {
    if (!controllerRef.current) return;
    setTranscript("");
    setInterimTranscript("");
    setCapture(null);
    setError(null);
    setListening(true);
    controllerRef.current.start();
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
    setListening(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    supported,
    listening,
    transcript,
    interimTranscript,
    error,
    capture,
    start,
    stop,
    cancel,
    clearError,
  };
}
