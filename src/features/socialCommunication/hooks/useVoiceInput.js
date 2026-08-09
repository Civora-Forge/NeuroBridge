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
  "no-audio-received": "No audio was received. Check that your microphone is allowed and try again, or type your reply.",
  network: "Speech recognition is unavailable right now. You can type your reply instead.",
  "audio-capture": "The microphone could not be started. You can type your reply instead.",
  start_failed: "Speech recognition could not start. You can type your reply instead.",
};

/** How long to wait for the first audio/result before reporting a no-audio error. */
export const SILENCE_TIMEOUT_MS = 8000;

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
  let silenceTimer = null;
  let lastFinalizedIndex = -1;

  const clearSilenceTimer = () => {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };

  const armSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      silenceTimer = null;
      if (cancelled) return;
      onError?.(resolveSpeechErrorMessage("no-audio-received"));
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    }, SILENCE_TIMEOUT_MS);
  };

  recognition.onresult = (event) => {
    clearSilenceTimer();
    // The Web Speech API sends the CUMULATIVE result list on every event:
    // finalized results stay in it and are never revised. Only read results
    // we have not incorporated yet, so each utterance is captured exactly once.
    let interim = "";
    let final = "";
    const results = event?.results ?? [];
    for (let index = lastFinalizedIndex + 1; index < results.length; index += 1) {
      const result = results[index];
      const transcript = result?.[0]?.transcript ?? "";
      if (result?.isFinal) {
        final += transcript;
        lastFinalizedIndex = index;
      } else {
        interim += transcript;
      }
    }
    if (final) {
      if (firstResultAt === null) firstResultAt = Date.now();
      finalText = `${finalText} ${final}`.replace(/\s{2,}/g, " ").trim();
      onFinal?.(finalText);
    }
    if (interim) {
      pendingInterim = interim;
      onInterim?.(interim);
    } else if (final) {
      // Everything pending was just incorporated into the final text.
      pendingInterim = "";
    }
  };

  recognition.onerror = (event) => {
    clearSilenceTimer();
    onError?.(resolveSpeechErrorMessage(event?.error ?? "unknown"));
  };

  recognition.onend = () => {
    clearSilenceTimer();
    const durationMs = startedAt ? Date.now() - startedAt : null;
    const latencyMs = firstResultAt && startedAt ? firstResultAt - startedAt : null;
    if (!cancelled) {
      onDone?.({
        transcript: [finalText, pendingInterim].filter(Boolean).join(" ").trim(),
        durationMs,
        latencyMs,
      });
    }
    cancelled = false;
    firstResultAt = null;
  };

  return {
    start() {
      finalText = "";
      pendingInterim = "";
      firstResultAt = null;
      lastFinalizedIndex = -1;
      startedAt = Date.now();
      cancelled = false;
      let ok = true;
      try {
        recognition.start();
      } catch {
        ok = false;
        onError?.(resolveSpeechErrorMessage("start_failed"));
      }
      if (ok) armSilenceTimer();
    },
    stop() {
      clearSilenceTimer();
      try {
        recognition.stop();
      } catch {
        // already stopped — onend still fires for a clean final state.
      }
    },
    cancel() {
      cancelled = true;
      clearSilenceTimer();
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
 *   listeningFor: number,
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
  const [listeningFor, setListeningFor] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);
  const [capture, setCapture] = useState(null);

  const stopListening = useCallback(() => {
    setListening(false);
    setListeningFor(0);
  }, []);

  useEffect(() => {
    if (!listening) return undefined;
    const id = window.setInterval(() => {
      setListeningFor((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [listening]);

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
        stopListening();
        if (!nextCapture.transcript || !nextCapture.transcript.trim()) {
          setError((current) => current ?? resolveSpeechErrorMessage("no-speech"));
        }
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
  }, [supported, stopListening]);

  const start = useCallback(() => {
    if (!controllerRef.current) return;
    setTranscript("");
    setInterimTranscript("");
    setCapture(null);
    setError(null);
    setListening(true);
    setListeningFor(0);
    controllerRef.current.start();
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.cancel();
    stopListening();
  }, [stopListening]);

  const clearError = useCallback(() => setError(null), []);

  return {
    supported,
    listening,
    listeningFor,
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
