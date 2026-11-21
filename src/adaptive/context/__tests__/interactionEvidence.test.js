/**
 * interactionEvidence.test.js — timestamped evidence log + tracker wiring.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EVIDENCE_WINDOW_MS,
  SELF_REPORT_WINDOW_MS,
  TaskEventType,
  clearInteractionEvidence,
  getInteractionEvidenceSnapshot,
  recordCorrection,
  recordSelfReport,
  recordTaskEvent,
  recordUndo,
} from "../interactionEvidence.js";
import {
  getInteractionSnapshot,
  recordNavigationSignal,
  resetInteractionTracker,
  startInteractionTracking,
} from "../contextInteractionTracker.js";
import { toContextSnapshot } from "../contextSnapshotAdapter.js";

const T0 = Date.parse("2026-11-21T12:00:00.000Z");
const total = (key) => getInteractionEvidenceSnapshot().buckets.reduce((s, b) => s + b[key], 0);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(T0);
  resetInteractionTracker();
  clearInteractionEvidence();
});
afterEach(() => {
  resetInteractionTracker();
  vi.useRealTimers();
});

describe("evidence log", () => {
  it("counts one correction for a keydown + beforeinput pair, but separate keystrokes separately", () => {
    recordCorrection();
    recordCorrection(); // same key, beforeinput echo
    vi.advanceTimersByTime(200);
    recordCorrection();
    expect(total("correction")).toBe(2);
  });

  it("dedupes undo the same way", () => {
    recordUndo();
    recordUndo();
    expect(total("undo")).toBe(1);
  });

  it("marks a restart after abandonment or failure as a retry, and times completions", () => {
    recordTaskEvent({ type: TaskEventType.STARTED, moduleId: "m", taskId: "a" });
    vi.advanceTimersByTime(5000);
    recordTaskEvent({ type: TaskEventType.FAILED, moduleId: "m", taskId: "a" });
    recordTaskEvent({ type: TaskEventType.STARTED, moduleId: "m", taskId: "b" });
    vi.advanceTimersByTime(7000);
    recordTaskEvent({ type: TaskEventType.COMPLETED, moduleId: "m", taskId: "b" });
    recordTaskEvent({ type: TaskEventType.STARTED, moduleId: "m", taskId: "c" });
    const events = getInteractionEvidenceSnapshot().taskEvents;
    expect(events.map((e) => [e.type, e.retry === true])).toEqual([
      ["started", false], ["failed", false], ["started", true], ["completed", false], ["started", false],
    ]);
    expect(events[3].durationMs).toBe(7000);
  });

  it("ignores unknown task event types and missing module ids", () => {
    recordTaskEvent({ type: "exploded", moduleId: "m" });
    recordTaskEvent({ type: TaskEventType.STARTED });
    expect(getInteractionEvidenceSnapshot().taskEvents).toHaveLength(0);
  });

  it("accepts only the closed self-report vocabulary", () => {
    recordSelfReport({ state: "Overwhelmed", moduleId: "support.mood_checkin" });
    recordSelfReport({ state: "diagnosis:anxiety" });
    expect(getInteractionEvidenceSnapshot().selfReports.map((r) => r.state)).toEqual(["overwhelmed"]);
  });

  it("is bounded in time: behavioural evidence after 15 min, self-reports after 60 min", () => {
    recordCorrection();
    recordTaskEvent({ type: TaskEventType.STARTED, moduleId: "m" });
    recordSelfReport({ state: "tired" });
    vi.advanceTimersByTime(EVIDENCE_WINDOW_MS + 1000);
    let snap = getInteractionEvidenceSnapshot();
    expect(snap.buckets).toHaveLength(0);
    expect(snap.taskEvents).toHaveLength(0);
    expect(snap.selfReports).toHaveLength(1);
    vi.advanceTimersByTime(SELF_REPORT_WINDOW_MS);
    snap = getInteractionEvidenceSnapshot();
    expect(snap.selfReports).toHaveLength(0);
  });

  it("clearInteractionEvidence drops everything (user switch / sign-out)", () => {
    recordCorrection();
    recordSelfReport({ state: "anxious" });
    clearInteractionEvidence();
    const snap = getInteractionEvidenceSnapshot();
    expect(snap.buckets).toHaveLength(0);
    expect(snap.selfReports).toHaveLength(0);
  });
});

describe("tracker wiring", () => {
  function typeInto(input, key, options = {}) {
    input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...options }));
  }

  it("records keystrokes, typing gaps, corrections and undo from real DOM events", () => {
    startInteractionTracking();
    const input = document.createElement("input");
    document.body.appendChild(input);
    for (let i = 0; i < 5; i += 1) {
      typeInto(input, "a");
      vi.advanceTimersByTime(150);
    }
    typeInto(input, "Backspace");
    vi.advanceTimersByTime(200);
    typeInto(input, "z", { ctrlKey: true });
    expect(total("keystroke")).toBe(5);
    expect(total("correction")).toBe(1);
    expect(total("undo")).toBe(1);
    const bucket = getInteractionEvidenceSnapshot().buckets[0];
    expect(bucket.typingGapCount).toBe(4);
    expect(bucket.typingGapSumMs).toBe(600);
    input.remove();
  });

  it("an input field losing focus is not an interruption; the window losing focus is", () => {
    startInteractionTracking();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new FocusEvent("blur"));
    expect(total("focusInterrupt")).toBe(0);
    window.dispatchEvent(new FocusEvent("blur"));
    expect(total("focusInterrupt")).toBe(1);
    input.remove();
  });

  it("only real page switches count (not the landing page, not repeats)", () => {
    recordNavigationSignal("/");
    recordNavigationSignal("/");
    recordNavigationSignal("/adhd");
    expect(total("navigationSwitch")).toBe(1);
  });

  it("the public ContextSnapshot carries the evidence block", () => {
    recordSelfReport({ state: "calm" });
    const snapshot = toContextSnapshot({});
    expect(snapshot.interactionEvidence).toMatchObject({ observedAt: T0, selfReports: [{ state: "calm" }] });
    expect(getInteractionSnapshot().evidence.selfReports).toHaveLength(1);
  });
});

describe("module-scoped views of one log", () => {
  it("attributes evidence to the active module; the app view merges, module views filter", async () => {
    const { setEvidenceScope } = await import("../interactionEvidence.js");
    setEvidenceScope("support.task_breakdown");
    recordCorrection();
    recordTaskEvent({ type: TaskEventType.FAILED, moduleId: "support.task_breakdown" });
    vi.advanceTimersByTime(200);
    setEvidenceScope("support.focus_session");
    recordCorrection();
    const sum = (view) => view.buckets.reduce((s, b) => s + b.correction, 0);
    expect(sum(getInteractionEvidenceSnapshot())).toBe(2);
    expect(sum(getInteractionEvidenceSnapshot({ moduleId: "support.task_breakdown" }))).toBe(1);
    expect(sum(getInteractionEvidenceSnapshot({ moduleId: "support.focus_session" }))).toBe(1);
    expect(getInteractionEvidenceSnapshot({ moduleId: "support.focus_session" }).taskEvents).toHaveLength(0);
    expect(getInteractionEvidenceSnapshot().buckets.every((b) => !("scope" in b))).toBe(true);
    setEvidenceScope(null);
  });

  it("self-reports are about the person and appear in every view", async () => {
    const { setEvidenceScope } = await import("../interactionEvidence.js");
    setEvidenceScope("support.task_breakdown");
    recordSelfReport({ state: "tired" });
    expect(getInteractionEvidenceSnapshot({ moduleId: "support.focus_session" }).selfReports).toHaveLength(1);
    setEvidenceScope(null);
  });
});

describe("clarification requests", () => {
  it("recognises clarification phrasing and records a count only — never the text", async () => {
    const { isClarificationRequest, noteChatMessageForClarification } = await import("../interactionEvidence.js");
    expect(isClarificationRequest("Sorry, what do you mean by that?")).toBe(true);
    expect(isClarificationRequest("I don't understand step 2")).toBe(true);
    expect(isClarificationRequest("Can you explain it differently")).toBe(true);
    expect(isClarificationRequest("Start a focus session")).toBe(false);
    expect(isClarificationRequest("meaningful work")).toBe(false);
    const secret = "I don't understand my diagnosis letter from Dr. Smith";
    expect(noteChatMessageForClarification(secret)).toBe(true);
    const snap = JSON.stringify(getInteractionEvidenceSnapshot());
    expect(total("clarification")).toBe(1);
    expect(snap).not.toMatch(/diagnosis|Smith|understand/);
  });
});
