/**
 * contextInteractionTracker.js — Live interaction metrics tracker
 *
 * Collects observable interaction signals from user input, scrolling, navigation,
 * and visibility/focus changes. The tracker does not infer cognitive state.
 */

import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";
import { contextStore } from "./contextStore.js";

const DEFAULT_SOURCE = "interactionTracker";
const NAVIGATION_WINDOW_MS = 5 * 60 * 1000;
const FAST_TYPING_GAP_MS = 2000;

// Rapid pointer-movement ("mouse shake") burst detection. Bursts are a
// pure observable signal: the tracker only reports the movement metrics, it
// never infers emotion or intent (that interpretation lives in moodAgent).
const POINTER_SAMPLE_MIN_GAP_MS = 24;
const POINTER_BURST_WINDOW_MS = 900;
const POINTER_BURST_MIN_SAMPLES = 5;
const POINTER_BURST_MIN_DISTANCE_PX = 420;
const POINTER_BURST_MIN_SPEED_PPS = 800;
const POINTER_BURST_MIN_REVERSALS = 4;
const POINTER_BURST_DECAY_MS = 1200;

let _isTracking = false;
let _listeners = [];
let _emitTimer = null;

let _lastInteractionAt = null;
let _lastNavigationAt = null;
let _firstInteractionAfterNavigationAt = null;
let _lastPath = null;
let _navigationEvents = [];
let _focusSessionInterruptions = 0;

let _typingEvents = [];
let _typingSessionStartAt = null;
let _lastPrintableKeyAt = null;
let _typedPrintableCount = 0;
let _typingCorrectionCount = 0;

let _scrollEvents = [];
let _lastScrollTop = null;
let _lastScrollAt = null;

let _pointerMoveSamples = [];
let _lastPointerSampleAt = null;
let _lastPointerX = null;
let _lastPointerY = null;
let _lastPointerMoveAt = null;
let _movementBurstActive = false;
let _burstEndTimer = null;

let _explicitRequest = {
  requestType: null,
  inputMode: null,
  timestamp: null,
  confidence: null,
};

function nowIso() {
  return new Date().toISOString();
}

function getNowMs() {
  return Date.now();
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getSessionStartMs() {
  const session = contextStore.getContext().session;
  const startTime = session?.startTime;
  const parsed = startTime ? new Date(startTime).getTime() : Date.now();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function isEditableTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = String(target.tagName).toLowerCase();
  return (
    tag === "input" || tag === "textarea" || target.isContentEditable === true
  );
}

function isPrintableKey(event) {
  return typeof event.key === "string" && event.key.length === 1;
}

function scheduleEmit(reason) {
  if (_emitTimer) return;
  _emitTimer = window.setTimeout(() => {
    _emitTimer = null;
    const snapshot = getInteractionSnapshot();
    contextEventBus.emit(ContextEvents.INTERACTION_UPDATED, {
      interaction: snapshot,
      reason,
      source: DEFAULT_SOURCE,
      timestamp: nowIso(),
    });
  }, 80);
}

function recordInteraction({ countLatency = true } = {}) {
  const now = getNowMs();
  _lastInteractionAt = now;

  if (
    countLatency &&
    _lastNavigationAt &&
    !_firstInteractionAfterNavigationAt
  ) {
    _firstInteractionAfterNavigationAt = now;
  }
}

/** Rolling rapid pointer-movement metrics over a short time window. */
function computeMovementBurst(now) {
  const recent = _pointerMoveSamples.filter(
    (sample) => now - sample.t <= POINTER_BURST_WINDOW_MS,
  );
  if (recent.length < POINTER_BURST_MIN_SAMPLES) {
    return null;
  }

  const elapsedSeconds = Math.max(
    0.05,
    (recent[recent.length - 1].t - recent[0].t) / 1000,
  );
  const distance = recent.reduce((sum, sample) => sum + sample.d, 0);
  const intensity = Math.round(distance / elapsedSeconds);

  let reversals = 0;
  for (let i = 2; i < recent.length; i += 1) {
    const prev = recent[i - 1].xDir;
    const cur = recent[i].xDir;
    if (prev !== 0 && cur !== 0 && prev !== cur) {
      reversals += 1;
    }
  }

  const active =
    now - (_lastPointerMoveAt ?? 0) <= POINTER_BURST_DECAY_MS &&
    recent.length >= POINTER_BURST_MIN_SAMPLES &&
    distance >= POINTER_BURST_MIN_DISTANCE_PX &&
    intensity >= POINTER_BURST_MIN_SPEED_PPS &&
    reversals >= POINTER_BURST_MIN_REVERSALS;

  return {
    active,
    intensity,
    distance: Math.round(distance),
    samples: recent.length,
    reversals,
    timestamp: nowIso(),
  };
}

/** Check that a detected burst has ended so consumers can restore baseline. */
function scheduleBurstEndCheck() {
  if (!_movementBurstActive) return;
  if (_burstEndTimer) clearTimeout(_burstEndTimer);
  _burstEndTimer = window.setTimeout(() => {
    _burstEndTimer = null;
    const burst = computeMovementBurst(getNowMs());
    if (!(burst?.active ?? false) && _movementBurstActive) {
      _movementBurstActive = false;
      scheduleEmit("movement_burst_end");
    } else if (_movementBurstActive) {
      scheduleBurstEndCheck();
    }
  }, POINTER_BURST_DECAY_MS + 60);
}

function recordPointerMove(event) {
  if (typeof window === "undefined") return;
  // Only physical pointers (mouse / pen); ignore scrolling gestures.
  if (event.pointerType === "touch") return;

  const now = getNowMs();
  if (
    _lastPointerSampleAt != null &&
    now - _lastPointerSampleAt < POINTER_SAMPLE_MIN_GAP_MS
  ) {
    return;
  }

  const x = event.clientX ?? 0;
  const y = event.clientY ?? 0;
  const dx = x - (_lastPointerX ?? x);
  const dy = y - (_lastPointerY ?? y);
  const xDir = dx === 0 ? 0 : dx > 0 ? 1 : -1;

  _lastPointerX = x;
  _lastPointerY = y;
  _lastPointerSampleAt = now;

  if (dx === 0 && dy === 0) return;

  _lastPointerMoveAt = now;
  _pointerMoveSamples.push({ t: now, d: Math.hypot(dx, dy), xDir });
  _pointerMoveSamples = _pointerMoveSamples.filter(
    (sample) => now - sample.t <= POINTER_BURST_WINDOW_MS,
  );

  const burst = computeMovementBurst(now);
  const isActive = burst?.active ?? false;

  if (isActive && !_movementBurstActive) {
    _movementBurstActive = true;
    scheduleEmit("movement_burst");
    scheduleBurstEndCheck();
  } else if (isActive) {
    scheduleEmit("movement_burst");
  } else if (_movementBurstActive) {
    _movementBurstActive = false;
    scheduleEmit("movement_burst_end");
  }
}

function recordTypingEvent(event) {
  if (!isEditableTarget(event.target)) return;
  recordInteraction();

  const now = getNowMs();
  const key = event.key || "";
  const isCorrection =
    key === "Backspace" ||
    key === "Delete" ||
    event.inputType?.startsWith?.("delete");

  if (isCorrection) {
    _typingCorrectionCount += 1;
  }

  if (!isPrintableKey(event)) {
    return;
  }

  if (
    _typingSessionStartAt === null ||
    now - (_lastPrintableKeyAt || now) > FAST_TYPING_GAP_MS
  ) {
    _typingSessionStartAt = now;
    _typingEvents = [];
    _typedPrintableCount = 0;
    _typingCorrectionCount = 0;
  }

  _typingEvents.push(now);
  _typedPrintableCount += 1;
  _lastPrintableKeyAt = now;

  scheduleEmit("typing");
}

function recordScrollEvent() {
  if (typeof window === "undefined") return;
  recordInteraction();

  const now = getNowMs();
  const scrollTop = window.scrollY || window.pageYOffset || 0;
  const delta = _lastScrollTop == null ? 0 : scrollTop - _lastScrollTop;

  _scrollEvents.push({ timestamp: now, scrollTop, delta });
  _scrollEvents = _scrollEvents.slice(-40);
  _lastScrollTop = scrollTop;
  _lastScrollAt = now;

  scheduleEmit("scroll");
}

function recordNavigationInteraction(pathname) {
  if (!pathname) return;

  const now = getNowMs();
  recordInteraction({ countLatency: false });

  if (_lastPath === pathname) {
    _navigationEvents.push({ pathname, timestamp: now, repeated: true });
  } else {
    _navigationEvents.push({ pathname, timestamp: now, repeated: false });
    _lastPath = pathname;
  }

  _navigationEvents = _navigationEvents.filter(
    (entry) => now - entry.timestamp <= NAVIGATION_WINDOW_MS,
  );
  _lastNavigationAt = now;
  _firstInteractionAfterNavigationAt = null;

  scheduleEmit("navigation");
}

function recordFocusInterrupt() {
  _focusSessionInterruptions += 1;
  scheduleEmit("focus_interrupt");
}

export function recordExplicitRequestInteraction({
  requestType = null,
  inputMode = null,
  confidence = null,
  timestamp = null,
} = {}) {
  _explicitRequest = {
    requestType,
    inputMode,
    confidence,
    timestamp: timestamp || nowIso(),
  };

  recordInteraction();
  scheduleEmit("explicit_request");
  return getInteractionSnapshot().explicitRequests;
}

export function recordNavigationSignal(pathname) {
  recordNavigationInteraction(pathname);
}

export function startInteractionTracking() {
  if (
    _isTracking ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  )
    return;

  const keydownHandler = (event) => recordTypingEvent(event);
  const beforeInputHandler = (event) => {
    if (
      isEditableTarget(event.target) &&
      event.inputType &&
      String(event.inputType).startsWith("delete")
    ) {
      recordInteraction();
      _typingCorrectionCount += 1;
      scheduleEmit("correction");
    }
  };
  const scrollHandler = () => recordScrollEvent();
  const pointerHandler = () => {
    recordInteraction();
    scheduleEmit("pointer");
  };
  const pointerMoveHandler = (event) => recordPointerMove(event);
  const visibilityHandler = () => {
    if (document.hidden) {
      recordFocusInterrupt();
    } else {
      recordInteraction();
    }
  };
  const blurHandler = () => recordFocusInterrupt();
  const focusHandler = () => recordInteraction();

  window.addEventListener("keydown", keydownHandler, true);
  window.addEventListener("beforeinput", beforeInputHandler, true);
  window.addEventListener("scroll", scrollHandler, { passive: true });
  window.addEventListener("pointerdown", pointerHandler, true);
  window.addEventListener("pointermove", pointerMoveHandler, { passive: true });
  window.addEventListener("blur", blurHandler, true);
  window.addEventListener("focus", focusHandler, true);
  document.addEventListener("visibilitychange", visibilityHandler, true);

  _listeners = [
    ["keydown", keydownHandler, true],
    ["beforeinput", beforeInputHandler, true],
    ["scroll", scrollHandler, { passive: true }],
    ["pointerdown", pointerHandler, true],
    ["pointermove", pointerMoveHandler, { passive: true }],
    ["blur", blurHandler, true],
    ["focus", focusHandler, true],
    ["visibilitychange", visibilityHandler, true],
  ];

  _isTracking = true;
}

export function stopInteractionTracking() {
  if (
    !_isTracking ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  )
    return;

  _listeners.forEach(([type, handler, options]) => {
    const target = type === "visibilitychange" ? document : window;
    target.removeEventListener(type, handler, options);
  });

  _listeners = [];
  _isTracking = false;

  if (_emitTimer) {
    clearTimeout(_emitTimer);
    _emitTimer = null;
  }
  if (_burstEndTimer) {
    clearTimeout(_burstEndTimer);
    _burstEndTimer = null;
  }
}

function computeTypingMetrics(now) {
  if (_typingEvents.length < 2) {
    return {
      typingSpeed: null,
      typingPauseDuration: null,
      correctionRate:
        _typedPrintableCount > 0
          ? +(_typingCorrectionCount / _typedPrintableCount).toFixed(2)
          : null,
    };
  }

  const durationSeconds = Math.max(1, (now - _typingSessionStartAt) / 1000);
  const typingSpeed = Math.round((_typedPrintableCount / durationSeconds) * 60);

  const gaps = [];
  for (let i = 1; i < _typingEvents.length; i += 1) {
    gaps.push(_typingEvents[i] - _typingEvents[i - 1]);
  }

  const pauseDuration =
    gaps.length > 0
      ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)
      : null;
  const correctionRate =
    _typedPrintableCount > 0
      ? +(_typingCorrectionCount / _typedPrintableCount).toFixed(2)
      : null;

  return {
    typingSpeed,
    typingPauseDuration: pauseDuration,
    correctionRate,
  };
}

function computeScrollBehavior(now) {
  if (_scrollEvents.length < 2) return null;

  const first = _scrollEvents[0];
  const last = _scrollEvents[_scrollEvents.length - 1];
  const elapsedSeconds = Math.max(1, (last.timestamp - first.timestamp) / 1000);
  const totalDistancePx = _scrollEvents.reduce(
    (sum, entry) => sum + Math.abs(entry.delta),
    0,
  );
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight || 1 : 1;
  const averageSpeedPxPerSec = Math.round(totalDistancePx / elapsedSeconds);
  const direction = last.delta > 0 ? "down" : last.delta < 0 ? "up" : "steady";

  const currentModule =
    contextStore.getContext().session?.currentScreen || "dashboard";
  const readingSpeed =
    currentModule === "reader"
      ? Math.max(0, Math.round((totalDistancePx / viewportHeight) * 220))
      : null;

  return {
    direction,
    totalDistancePx: Math.round(totalDistancePx),
    averageSpeedPxPerSec,
    readingSpeed,
    lastScrollAt: new Date(last.timestamp).toISOString(),
  };
}

export function getInteractionSnapshot() {
  const now = getNowMs();
  const sessionStart = getSessionStartMs();
  const timeSinceLastInteraction = _lastInteractionAt
    ? Math.max(0, Math.round((now - _lastInteractionAt) / 1000))
    : null;
  const idleDuration = timeSinceLastInteraction;
  const currentSessionDuration = Math.max(
    0,
    Math.round((now - sessionStart) / 1000),
  );

  const recentNavs = _navigationEvents.filter(
    (entry) => now - entry.timestamp <= NAVIGATION_WINDOW_MS,
  );
  const repeatedNavigation = recentNavs.filter(
    (entry) => entry.repeated,
  ).length;
  const taskSwitchFrequency = +(
    recentNavs.filter((entry) => !entry.repeated).length / 5
  ).toFixed(2);
  const interactionLatency =
    _firstInteractionAfterNavigationAt && _lastNavigationAt
      ? Math.max(
          0,
          Math.round(
            (_firstInteractionAfterNavigationAt - _lastNavigationAt) / 1000,
          ),
        )
      : null;

  const typingMetrics = computeTypingMetrics(now);
  const scrollBehavior = computeScrollBehavior(now);
  const movementBurst = computeMovementBurst(now);

  const behaviorConfidence =
    [
      typingMetrics.typingSpeed,
      typingMetrics.correctionRate,
      scrollBehavior,
      movementBurst?.active === true,
    ].filter(Boolean).length > 0
      ? 0.7
      : 0.0;
  const deviceInteractionConfidence = [
    timeSinceLastInteraction,
    currentSessionDuration,
    repeatedNavigation,
    _focusSessionInterruptions,
  ].some((value) => value !== null && value !== undefined)
    ? 0.7
    : 0.0;

  return {
    behavior: {
      typingSpeed: typingMetrics.typingSpeed,
      typingPauseDuration: typingMetrics.typingPauseDuration,
      correctionRate: typingMetrics.correctionRate,
      taskSwitchFrequency,
      idleDuration,
      scrollBehavior,
      readingSpeed: scrollBehavior?.readingSpeed ?? null,
      interactionLatency,
      movementIntensity: movementBurst?.intensity ?? null,
      movementBurst,
      timestamp: nowIso(),
      confidence: behaviorConfidence,
      source: DEFAULT_SOURCE,
    },
    deviceInteraction: {
      focusSessionInterruptions: _focusSessionInterruptions,
      repeatedNavigation,
      timeSinceLastInteraction,
      currentSessionDuration,
      timestamp: nowIso(),
      confidence: deviceInteractionConfidence,
      source: DEFAULT_SOURCE,
    },
    explicitRequests: {
      requestType: _explicitRequest.requestType,
      inputMode: _explicitRequest.inputMode,
      timestamp: _explicitRequest.timestamp,
      confidence: _explicitRequest.confidence,
      source: _explicitRequest.inputMode
        ? `explicit:${_explicitRequest.inputMode}`
        : null,
    },
    biometrics: null,
    metadata: {
      lastUpdated: nowIso(),
      sourceMap: {
        behavior: DEFAULT_SOURCE,
        deviceInteraction: DEFAULT_SOURCE,
        explicitRequests: _explicitRequest.inputMode
          ? `explicit:${_explicitRequest.inputMode}`
          : DEFAULT_SOURCE,
        biometrics: "future_extension",
      },
    },
  };
}

export function getExplicitRequestSnapshot() {
  return deepClone(getInteractionSnapshot().explicitRequests);
}

export function resetInteractionTracker() {
  stopInteractionTracking();
  _lastInteractionAt = null;
  _lastNavigationAt = null;
  _firstInteractionAfterNavigationAt = null;
  _lastPath = null;
  _navigationEvents = [];
  _focusSessionInterruptions = 0;
  _typingEvents = [];
  _typingSessionStartAt = null;
  _lastPrintableKeyAt = null;
  _typedPrintableCount = 0;
  _typingCorrectionCount = 0;
  _scrollEvents = [];
  _lastScrollTop = null;
  _lastScrollAt = null;
  _pointerMoveSamples = [];
  _lastPointerSampleAt = null;
  _lastPointerX = null;
  _lastPointerY = null;
  _lastPointerMoveAt = null;
  _movementBurstActive = false;
  if (_burstEndTimer) {
    clearTimeout(_burstEndTimer);
    _burstEndTimer = null;
  }
  _explicitRequest = {
    requestType: null,
    inputMode: null,
    timestamp: null,
    confidence: null,
  };
}
