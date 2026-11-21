/**
 * behaviouralBaseline.test.js — shared per-user baseline: learns normal,
 * never temporary states.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BASELINE_CONFIG,
  baselineObservationFromUserState,
  clearBehaviouralBaseline,
  getBehaviouralBaseline,
  recordBaselineObservation,
  setBaselineStorage,
} from "../behaviouralBaseline.js";
import { buildUserState } from "@backend/adaptive/state/userStateModel";
import { resetAdaptiveSession } from "@/adaptive/session/adaptiveSession";

function memoryStorage() {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

const USER = "baseline-user";
const T0 = Date.parse("2026-11-21T12:00:00.000Z");
let storage;

beforeEach(() => {
  storage = memoryStorage();
  setBaselineStorage(storage);
});
afterEach(() => setBaselineStorage(null));

describe("recording", () => {
  it("learns a running mean per activity type", () => {
    for (let i = 0; i < 5; i += 1) {
      recordBaselineObservation(USER, { activityType: "reading", metrics: { correctionRate: 0.1 + i * 0.01 }, at: T0 + i * BASELINE_CONFIG.minIntervalMs });
    }
    const stat = getBehaviouralBaseline(USER).activities.reading.metrics.correctionRate;
    expect(stat.n).toBe(5);
    expect(stat.mean).toBeCloseTo(0.12, 5);
    expect(getBehaviouralBaseline(USER).activities.general).toBeUndefined();
  });

  it("rejects observations made while a temporary state is active", () => {
    expect(recordBaselineObservation(USER, { activityType: "general", metrics: { correctionRate: 0.6 }, contaminated: true, at: T0 })).toMatchObject({ recorded: false, reason: "state_active" });
    expect(getBehaviouralBaseline(USER).activities).toEqual({});
  });

  it("rate-limits observations per activity type", () => {
    expect(recordBaselineObservation(USER, { activityType: "general", metrics: { latencySeconds: 2 }, at: T0 }).recorded).toBe(true);
    expect(recordBaselineObservation(USER, { activityType: "general", metrics: { latencySeconds: 2 }, at: T0 + 1000 }).reason).toBe("rate_limited");
    expect(recordBaselineObservation(USER, { activityType: "reading", metrics: { latencySeconds: 2 }, at: T0 + 1000 }).recorded).toBe(true);
  });

  it("drops unknown metrics and out-of-range values", () => {
    recordBaselineObservation(USER, { activityType: "general", metrics: { frustration: 1, latencySeconds: -4, typingGapMs: 180 }, at: T0 });
    expect(Object.keys(getBehaviouralBaseline(USER).activities.general.metrics)).toEqual(["typingGapMs"]);
  });

  it("a long history moves only slowly (no single session redefines normal)", () => {
    for (let i = 0; i < 60; i += 1) {
      recordBaselineObservation(USER, { activityType: "general", metrics: { typingGapMs: 200 }, at: T0 + i * BASELINE_CONFIG.minIntervalMs });
    }
    recordBaselineObservation(USER, { activityType: "general", metrics: { typingGapMs: 2000 }, at: T0 + 61 * BASELINE_CONFIG.minIntervalMs });
    expect(getBehaviouralBaseline(USER).activities.general.metrics.typingGapMs.mean).toBeLessThan(240);
  });

  it("stores numbers only — never states, labels or events", () => {
    recordBaselineObservation(USER, { activityType: "general", metrics: { correctionRate: 0.1 }, at: T0 });
    const raw = [...storage.map.values()].join("");
    expect(raw).not.toMatch(/present|frustrat|overload|fatigue|anxious|selfReport/);
  });

  it("corrupt storage reads as an empty baseline", () => {
    recordBaselineObservation(USER, { activityType: "general", metrics: { correctionRate: 0.1 }, at: T0 });
    for (const key of storage.map.keys()) storage.map.set(key, "{not json");
    expect(getBehaviouralBaseline(USER).activities).toEqual({});
  });
});

describe("observation from a decision's UserState", () => {
  const evidenceSnapshot = (extraBuckets = []) => ({
    timestamp: new Date(T0).toISOString(),
    interactionEvidence: {
      observedAt: T0,
      bucketMs: 30000,
      buckets: [0, 1, 2, 3].map((i) => ({ start: T0 - 45000 - i * 30000, keystroke: 30, correction: 1, undo: 0, focusInterrupt: 0, navigationSwitch: 0, scrollBacktrack: 0, typingGapSumMs: 0, typingGapCount: 0 })).concat(extraBuckets),
      taskEvents: [],
      latencySamples: [],
      selfReports: [],
    },
  });

  it("normal behaviour yields a clean observation", () => {
    const observation = baselineObservationFromUserState(buildUserState(evidenceSnapshot()));
    expect(observation).toMatchObject({ activityType: "general", contaminated: false });
    expect(observation.metrics.correctionRate).toBeCloseTo(4 / 120, 3);
  });

  it("is contaminated while a state is present or the user reported distress", () => {
    const snap = evidenceSnapshot();
    snap.interactionEvidence.selfReports = [{ state: "overwhelmed", at: T0 - 1000, source: "mood_checkin" }];
    expect(baselineObservationFromUserState(buildUserState(snap)).contaminated).toBe(true);
  });

  it("no evidence → no observation", () => {
    expect(baselineObservationFromUserState(buildUserState({}))).toBeNull();
  });
});

describe("privacy", () => {
  it("clearBehaviouralBaseline and the sign-out reset remove the baseline", () => {
    recordBaselineObservation(USER, { activityType: "general", metrics: { correctionRate: 0.1 }, at: T0 });
    clearBehaviouralBaseline(USER);
    expect(getBehaviouralBaseline(USER).activities).toEqual({});
    recordBaselineObservation(USER, { activityType: "general", metrics: { correctionRate: 0.1 }, at: T0 + 120000 });
    resetAdaptiveSession(USER);
    expect(getBehaviouralBaseline(USER).activities).toEqual({});
  });
});
