/**
 * useAgentVoice
 *
 * Voice input/output for the NeuroBridge Agent chat. Reuses the same
 * browser-native Web Speech API approach as useVoiceRecording.js (no backend
 * transcription endpoint, no API key exposure) but scoped to a single
 * capture-a-command flow rather than continuous dictation, plus optional
 * text-to-speech for agent responses via the browser's SpeechSynthesis API.
 *
 * Kept behind this hook's small interface (start/stop/cancel/speak) so a
 * server-side STT/TTS provider could replace the implementation later
 * without changing any component that uses it.
 */

import { useState, useRef, useCallback, useEffect } from "react";

const TTS_PREF_KEY = "nb_agent_voice_responses_enabled";

const useAgentVoice = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [voiceResponsesEnabled, setVoiceResponsesEnabled] = useState(() => {
    try {
      return localStorage.getItem(TTS_PREF_KEY) === "true";
    } catch {
      return false;
    }
  });

  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }
    if (!window.speechSynthesis) {
      setTtsSupported(false);
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
      finalTranscriptRef.current = "";
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = finalTranscriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += chunk;
        } else {
          interim += chunk;
        }
      }
      finalTranscriptRef.current = final;
      setTranscript(final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return; // not a real error, just silence
      const messages = {
        "not-allowed": "Microphone permission denied. Enable microphone access in your browser settings.",
        "audio-capture": "No microphone found. Please connect a microphone.",
        network: "Voice recognition needs an internet connection.",
        "service-not-allowed": "Voice recognition isn't available (requires HTTPS).",
      };
      setVoiceError(messages[event.error] || `Voice recognition error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current) {
      setVoiceError("Voice input isn't supported in this browser. Try Chrome, Edge, or Safari.");
      return false;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop()); // just a permission probe
      });
    } catch (error) {
      setVoiceError(
        error?.name === "NotAllowedError"
          ? "Microphone permission denied. Enable microphone access in your browser settings."
          : "Couldn't access the microphone."
      );
      return false;
    }

    setTranscript("");
    setInterimTranscript("");
    setVoiceError(null);
    try {
      recognitionRef.current.start();
      return true;
    } catch {
      setVoiceError("Could not start listening. Please try again.");
      return false;
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, []);

  const cancelListening = useCallback(() => {
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
    setTranscript("");
    setInterimTranscript("");
    setIsListening(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text) => {
      if (!ttsSupported || !text) return;
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [ttsSupported, stopSpeaking]
  );

  const toggleVoiceResponses = useCallback(() => {
    setVoiceResponsesEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TTS_PREF_KEY, String(next));
      } catch {
        // best-effort only
      }
      if (!next) stopSpeaking();
      return next;
    });
  }, [stopSpeaking]);

  return {
    // input
    isListening,
    transcript,
    interimTranscript,
    voiceError,
    voiceSupported,
    startListening,
    stopListening,
    cancelListening,
    // output
    isSpeaking,
    ttsSupported,
    voiceResponsesEnabled,
    toggleVoiceResponses,
    speak,
    stopSpeaking,
  };
};

export default useAgentVoice;
