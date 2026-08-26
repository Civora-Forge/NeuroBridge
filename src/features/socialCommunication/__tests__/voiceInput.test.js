import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  createSpeechController,
  isSpeechRecognitionSupported,
  resolveSpeechErrorMessage,
  useVoiceInput,
  SILENCE_TIMEOUT_MS,
} from "../hooks/useVoiceInput";

function makeFakeRecognition() {
  return {
    started: false,
    aborted: false,
    start() {
      this.started = true;
    },
    stop() {
      this.started = false;
    },
    abort() {
      this.started = false;
      this.aborted = true;
    },
  };
}

describe("createSpeechController", () => {
  it("reports a final transcript with timing on done", () => {
    const recognition = makeFakeRecognition();
    const done = [];
    const controller = createSpeechController(recognition, { onDone: (capture) => done.push(capture) });

    controller.start();
    expect(recognition.started).toBe(true);

    recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "hello there" } }] });
    recognition.onend();

    expect(done).toHaveLength(1);
    expect(done[0].transcript).toBe("hello there");
    expect(done[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("converts an interim utterance into a single final transcript", () => {
    const recognition = makeFakeRecognition();
    let finalText = "";
    const controller = createSpeechController(recognition, { onFinal: (text) => { finalText = text; } });

    controller.start();
    recognition.onresult({ results: [{ isFinal: false, 0: { transcript: "hello " } }] });
    recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "hello " } }] });

    expect(finalText).toBe("hello");
  });

  it("never duplicates an utterance across cumulative result events", () => {
    const recognition = makeFakeRecognition();
    const finals = [];
    const controller = createSpeechController(recognition, { onFinal: (text) => finals.push(text) });

    controller.start();
    // Chrome sends the full cumulative list every event; finalized entries stay in it.
    recognition.onresult({ results: [{ isFinal: false, 0: { transcript: "hello" } }] });
    recognition.onresult({ results: [{ isFinal: false, 0: { transcript: "hello world" } }] });
    recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "hello world" } }] });
    recognition.onresult({ results: [
      { isFinal: true, 0: { transcript: "hello world" } },
      { isFinal: false, 0: { transcript: "again" } },
    ] });

    expect(finals[finals.length - 1]).toBe("hello world");
  });

  it("keeps multiple spoken sentences unique in the final transcript", () => {
    const recognition = makeFakeRecognition();
    const finals = [];
    const done = [];
    const controller = createSpeechController(recognition, {
      onFinal: (text) => finals.push(text),
      onDone: (capture) => done.push(capture),
    });

    controller.start();
    recognition.onresult({ results: [{ isFinal: false, 0: { transcript: "hello" } }] });
    recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "hello" } }] });
    recognition.onresult({ results: [
      { isFinal: true, 0: { transcript: "hello" } },
      { isFinal: false, 0: { transcript: "world" } },
    ] });
    recognition.onresult({ results: [
      { isFinal: true, 0: { transcript: "hello" } },
      { isFinal: true, 0: { transcript: "world" } },
    ] });
    recognition.onend();

    expect(finals[finals.length - 1]).toBe("hello world");
    expect(done[0].transcript).toBe("hello world");
  });

  it("keeps trailing unfinalized speech in the capture without duplicating", () => {
    const recognition = makeFakeRecognition();
    const done = [];
    const controller = createSpeechController(recognition, { onDone: (capture) => done.push(capture) });

    controller.start();
    recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "hello" } }] });
    recognition.onresult({ results: [
      { isFinal: true, 0: { transcript: "hello" } },
      { isFinal: false, 0: { transcript: "and then" } },
    ] });
    recognition.onend();

    expect(done[0].transcript).toBe("hello and then");
  });

  it("does not report a capture after cancel", () => {
    const recognition = makeFakeRecognition();
    const done = [];
    const controller = createSpeechController(recognition, { onDone: (capture) => done.push(capture) });

    controller.start();
    controller.cancel();
    recognition.onend();

    expect(done).toHaveLength(0);
    expect(recognition.aborted).toBe(true);
  });

  it("surfaces a human-readable error on recognition failure", () => {
    const recognition = makeFakeRecognition();
    const errors = [];
    const controller = createSpeechController(recognition, { onError: (message) => errors.push(message) });

    controller.start();
    recognition.onerror({ error: "not-allowed" });

    expect(errors[0]).toContain("type your reply");
  });

  it("reports a no-audio error when no result arrives within the silence window", () => {
    vi.useFakeTimers();
    try {
      const recognition = makeFakeRecognition();
      const errors = [];
      const controller = createSpeechController(recognition, { onError: (message) => errors.push(message) });

      controller.start();
      vi.advanceTimersByTime(SILENCE_TIMEOUT_MS + 100);

      expect(errors[0]).toContain("No audio");
      expect(recognition.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fire the silence timeout once a result arrives", () => {
    vi.useFakeTimers();
    try {
      const recognition = makeFakeRecognition();
      const errors = [];
      const controller = createSpeechController(recognition, { onError: (message) => errors.push(message) });

      controller.start();
      recognition.onresult({ results: [{ isFinal: false, 0: { transcript: "hello" } }] });
      vi.advanceTimersByTime(SILENCE_TIMEOUT_MS + 100);

      expect(errors).toHaveLength(0);
      expect(recognition.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("error messaging", () => {
  it("always points the user to the text fallback", () => {
    expect(resolveSpeechErrorMessage("no-speech")).toContain("type your reply");
    expect(resolveSpeechErrorMessage("network")).toContain("type your reply");
    expect(resolveSpeechErrorMessage("unknown-code")).toContain("type your reply");
  });
});

describe("isSpeechRecognitionSupported", () => {
  it("returns false in an environment without the API", () => {
    const original = window.SpeechRecognition;
    const originalWebkit = window.webkitSpeechRecognition;
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    expect(isSpeechRecognitionSupported()).toBe(false);
    if (original) window.SpeechRecognition = original;
    if (originalWebkit) window.webkitSpeechRecognition = originalWebkit;
  });
});

describe("useVoiceInput", () => {
  let lastRecognition = null;

  function installFakeSpeechRecognition() {
    lastRecognition = null;
    window.SpeechRecognition = function FakeSpeechRecognition() {
      const instance = {
        continuous: false,
        interimResults: true,
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        onresult: null,
        onerror: null,
        onend: null,
      };
      lastRecognition = instance;
      return instance;
    };
  }

  afterEach(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    vi.useRealTimers();
  });

  it("marks listening while recognition runs and surfaces a no-speech error on an empty capture", () => {
    installFakeSpeechRecognition();
    const { result } = renderHook(() => useVoiceInput());

    act(() => {
      result.current.start();
    });
    expect(result.current.listening).toBe(true);
    expect(lastRecognition.start).toHaveBeenCalled();

    act(() => {
      lastRecognition.onend();
    });
    expect(result.current.listening).toBe(false);
    expect(result.current.listeningFor).toBe(0);
    expect(result.current.error).toContain("No speech");
  });

  it("delivers a final transcript capture and stops listening", () => {
    installFakeSpeechRecognition();
    const { result } = renderHook(() => useVoiceInput());

    act(() => {
      result.current.start();
    });
    act(() => {
      lastRecognition.onresult({ results: [{ isFinal: true, 0: { transcript: "hello" } }] });
      lastRecognition.onend();
    });

    expect(result.current.listening).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.capture.transcript).toBe("hello");
  });

  it("counts listening seconds while no result arrives", () => {
    vi.useFakeTimers();
    installFakeSpeechRecognition();
    const { result } = renderHook(() => useVoiceInput());

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.listeningFor).toBe(3);

    act(() => {
      lastRecognition.onend();
    });
    expect(result.current.listeningFor).toBe(0);
  });

  it("surfaces a no-audio error when the silence window elapses", () => {
    vi.useFakeTimers();
    installFakeSpeechRecognition();
    const { result } = renderHook(() => useVoiceInput());

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(SILENCE_TIMEOUT_MS + 100);
    });

    expect(result.current.error).toContain("No audio");
  });

  it("cancel stops listening without capturing", () => {
    installFakeSpeechRecognition();
    const { result } = renderHook(() => useVoiceInput());

    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.cancel();
    });

    expect(lastRecognition.abort).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
    expect(result.current.capture).toBeNull();
  });
});
