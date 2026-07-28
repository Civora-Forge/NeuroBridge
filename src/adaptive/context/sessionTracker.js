/**
 * sessionTracker.js — Session Context Tracker
 *
 * Part of the Context & Perception Engine.
 * Tracks session lifecycle: start time, total elapsed duration, current screen/module,
 * and navigation event history.
 *
 * Ownership: Context & Perception Engineer
 */

import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";
import { contextStore } from "./contextStore.js";
import { createContextSignal } from "./types/contextTypes.js";

let _sessionState = {
  sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  startTime: new Date().toISOString(),
  durationSeconds: 0,
  currentScreen: "dashboard",
  navigationHistory: [],
};

let _sessionStartTimestamp = Date.now();
const MAX_NAV_HISTORY = 50;

/**
 * Calculate total elapsed session duration in seconds.
 * @returns {number}
 */
function computeSessionDuration() {
  return Math.floor((Date.now() - _sessionStartTimestamp) / 1000);
}

/**
 * Initialize a new session.
 * @param {string} [initialScreen="dashboard"]
 * @returns {import("./types/contextTypes.js").SessionContext}
 */
export function startSession(initialScreen = "dashboard") {
  const now = new Date().toISOString();
  _sessionStartTimestamp = Date.now();

  _sessionState = {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    startTime: now,
    durationSeconds: 0,
    currentScreen: initialScreen,
    navigationHistory: [{ screen: initialScreen, timestamp: now }],
  };

  contextStore.updateContext("session", _sessionState, "sessionTracker", 1.0);

  const signal = createContextSignal({
    source: "sessionTracker",
    type: ContextEvents.SESSION_UPDATED,
    payload: { ..._sessionState },
    confidence: 1.0,
    ttlSeconds: 3600,
  });

  contextEventBus.emit(ContextEvents.SESSION_UPDATED, {
    session: { ..._sessionState },
    signal,
    timestamp: now,
  });

  contextEventBus.emit(ContextEvents.SIGNAL_RECEIVED, signal);

  return { ..._sessionState };
}

/**
 * Track navigation to a new screen or module.
 * @param {string} screenName - Screen or module name (e.g. "reader", "focus", "planner")
 * @returns {import("./types/contextTypes.js").SessionContext}
 */
export function updateSessionNavigation(screenName) {
  if (!screenName) return getSessionSummary();

  const now = new Date().toISOString();
  const durationSeconds = computeSessionDuration();

  const navEntry = { screen: screenName, timestamp: now };
  const updatedHistory = [..._sessionState.navigationHistory, navEntry].slice(-MAX_NAV_HISTORY);

  _sessionState = {
    ..._sessionState,
    durationSeconds,
    currentScreen: screenName,
    navigationHistory: updatedHistory,
  };

  contextStore.updateContext("session", _sessionState, "sessionTracker", 1.0);

  const signal = createContextSignal({
    source: "sessionTracker",
    type: ContextEvents.SESSION_UPDATED,
    payload: { ..._sessionState },
    confidence: 1.0,
    ttlSeconds: 3600,
  });

  contextEventBus.emit(ContextEvents.SESSION_UPDATED, {
    session: { ..._sessionState },
    signal,
    timestamp: now,
  });

  contextEventBus.emit(ContextEvents.SIGNAL_RECEIVED, signal);

  return { ..._sessionState };
}

/**
 * Get current session summary with updated duration.
 * @returns {import("./types/contextTypes.js").SessionContext}
 */
export function getSessionSummary() {
  _sessionState.durationSeconds = computeSessionDuration();
  return { ..._sessionState };
}

/**
 * Reset session tracker state (useful for testing).
 */
export function resetSessionTracker() {
  const now = new Date().toISOString();
  _sessionStartTimestamp = Date.now();
  _sessionState = {
    sessionId: `sess_${Date.now()}_test`,
    startTime: now,
    durationSeconds: 0,
    currentScreen: "dashboard",
    navigationHistory: [],
  };
}
