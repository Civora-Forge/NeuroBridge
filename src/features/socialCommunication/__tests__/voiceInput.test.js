import { describe, expect, it } from "vitest";
import { createSpeechController, isSpeechRecognitionSupported, resolveSpeechErrorMessage } from "../hooks/useVoiceInput";

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

  it("concatenates interim results into a single final transcript", () => {
    const recognition = makeFakeRecognition();
    let finalText = "";
    const controller = createSpeechController(recognition, { onFinal: (text) => { finalText = text; } });

    controller.start();
    recognition.onresult({ results: [{ isFinal: false, 0: { transcript: "hello " } }] });
    recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "world" } }] });

    expect(finalText).toBe("hello world");
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
