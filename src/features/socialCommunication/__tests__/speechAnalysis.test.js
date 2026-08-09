import { describe, expect, it } from "vitest";
import {
  countFillers,
  countWords,
  estimateSilenceMs,
  extractSpeechFeatures,
  isEmptyTranscript,
} from "../services/speechAnalysis";

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("hello there world")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
  });

  it("ignores punctuation when counting", () => {
    expect(countWords("Could you help, please?")).toBe(4);
  });
});

describe("countFillers", () => {
  it("counts common filler tokens", () => {
    expect(countFillers("um, I think uh maybe three")).toBe(2);
  });

  it("does not count fillers inside other words", () => {
    expect(countFillers("I like you")).toBe(0);
  });
});

describe("estimateSilenceMs", () => {
  it("returns zero when there are no words", () => {
    expect(estimateSilenceMs({ durationMs: 5000, wordCount: 0 })).toBe(0);
  });

  it("estimates notable pauses when duration exceeds word baseline", () => {
    const silence = estimateSilenceMs({ durationMs: 10000, wordCount: 5 });
    expect(silence).toBeGreaterThan(4000);
  });
});

describe("extractSpeechFeatures", () => {
  it("computes wpm from duration and word count", () => {
    const features = extractSpeechFeatures({ transcript: "one two three four", durationMs: 2000, latencyMs: 500 });
    expect(features.wordCount).toBe(4);
    expect(features.wpm).toBe(120);
    expect(features.latencyMs).toBe(500);
  });

  it("returns null measurements for missing inputs without throwing", () => {
    const features = extractSpeechFeatures({ transcript: "hi" });
    expect(features.wpm).toBeNull();
    expect(features.durationMs).toBeNull();
    expect(features.fillerCount).toBe(0);
  });
});

describe("isEmptyTranscript", () => {
  it("detects empty transcripts", () => {
    expect(isEmptyTranscript("")).toBe(true);
    expect(isEmptyTranscript("   ")).toBe(true);
    expect(isEmptyTranscript(null)).toBe(true);
    expect(isEmptyTranscript("hi")).toBe(false);
  });
});
