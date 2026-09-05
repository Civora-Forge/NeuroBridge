import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useAgentVoice from "@/hooks/useAgentVoice";

class FakeSpeechRecognition {
  constructor() {
    FakeSpeechRecognition.instances.push(this);
    this.continuous = false;
    this.interimResults = false;
    this.lang = "";
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
}
FakeSpeechRecognition.instances = [];

function stubMediaDevices(resolves = true) {
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: resolves
        ? vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] })
        : vi.fn().mockRejectedValue({ name: "NotAllowedError" }),
    },
    configurable: true,
  });
}

beforeEach(() => {
  FakeSpeechRecognition.instances = [];
  localStorage.clear();
  vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    function (text) {
      this.text = text;
    }
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAgentVoice — unsupported browser", () => {
  it("reports voice input as unsupported and errors on startListening", async () => {
    // no SpeechRecognition stubbed on window/global for this block
    const { result } = renderHook(() => useAgentVoice());
    expect(result.current.voiceSupported).toBe(false);

    await act(async () => {
      await result.current.startListening();
    });
    expect(result.current.voiceError).toMatch(/isn't supported/i);
  });
});

describe("useAgentVoice — supported browser", () => {
  beforeEach(() => {
    vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
    vi.stubGlobal("webkitSpeechRecognition", FakeSpeechRecognition);
    stubMediaDevices(true);
  });

  it("starts listening after the microphone permission check succeeds", async () => {
    const { result } = renderHook(() => useAgentVoice());

    await act(async () => {
      await result.current.startListening();
    });

    await waitFor(() => expect(result.current.isListening).toBe(true));
  });

  it("does not start listening when microphone permission is denied", async () => {
    stubMediaDevices(false);
    const { result } = renderHook(() => useAgentVoice());

    await act(async () => {
      await result.current.startListening();
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.voiceError).toMatch(/permission denied/i);
  });

  it("captures a final transcript from a recognition result event", async () => {
    const { result } = renderHook(() => useAgentVoice());

    await act(async () => {
      await result.current.startListening();
    });

    const instance = FakeSpeechRecognition.instances.at(-1);
    act(() => {
      instance.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: "start my focus session" }, isFinal: true, length: 1 }],
      });
    });

    expect(result.current.transcript).toBe("start my focus session");
  });

  it("stopListening ends the session", async () => {
    const { result } = renderHook(() => useAgentVoice());
    await act(async () => {
      await result.current.startListening();
    });
    act(() => result.current.stopListening());
    expect(result.current.isListening).toBe(false);
  });

  it("cancelListening aborts the session and discards any partial transcript", async () => {
    const { result } = renderHook(() => useAgentVoice());
    await act(async () => {
      await result.current.startListening();
    });

    const instance = FakeSpeechRecognition.instances.at(-1);
    act(() => {
      instance.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript: "never mind" }, isFinal: false, length: 1 }],
      });
    });
    expect(result.current.interimTranscript).toBe("never mind");

    act(() => result.current.cancelListening());

    expect(result.current.isListening).toBe(false);
    expect(result.current.transcript).toBe("");
    expect(result.current.interimTranscript).toBe("");
  });

  it("surfaces a friendly error and stops listening when recognition itself fails", async () => {
    const { result } = renderHook(() => useAgentVoice());
    await act(async () => {
      await result.current.startListening();
    });

    const instance = FakeSpeechRecognition.instances.at(-1);
    act(() => {
      instance.onerror({ error: "audio-capture" });
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.voiceError).toMatch(/no microphone found/i);
  });

  it("treats 'no-speech' as silence, not an error the user needs to see", async () => {
    const { result } = renderHook(() => useAgentVoice());
    await act(async () => {
      await result.current.startListening();
    });

    const instance = FakeSpeechRecognition.instances.at(-1);
    act(() => {
      instance.onerror({ error: "no-speech" });
    });

    expect(result.current.voiceError).toBeNull();
  });

  it("toggleVoiceResponses flips state and persists the preference", () => {
    const { result } = renderHook(() => useAgentVoice());
    expect(result.current.voiceResponsesEnabled).toBe(false);

    act(() => result.current.toggleVoiceResponses());
    expect(result.current.voiceResponsesEnabled).toBe(true);
    expect(localStorage.getItem("nb_agent_voice_responses_enabled")).toBe("true");

    act(() => result.current.toggleVoiceResponses());
    expect(result.current.voiceResponsesEnabled).toBe(false);
  });

  it("speak() invokes speechSynthesis when supported", () => {
    const { result } = renderHook(() => useAgentVoice());
    act(() => result.current.speak("Here is your update"));
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });
});
