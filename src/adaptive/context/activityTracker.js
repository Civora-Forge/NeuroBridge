/**
 * activityTracker.js — User Activity Tracker
 *
 * Part of the Context & Perception Engine.
 * Tracks user interactions, active module states, activity types, and durations throughout a session.
 *
 * Mappings:
 * - Reader opened ("reader") → "reading"
 * - Focus session started ("focus") → "focus_session"
 * - Routine planner opened ("planner") → "planning"
 * - Breathing exercise opened ("regulation") → "regulation"
 * - Reflection opened ("reflection") → "reflection"
 *
 * Ownership: Context & Perception Engineer
 * Note: Does NOT infer cognitive state from activity events.
 */

import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";
import { contextStore } from "./contextStore.js";
import { createContextSignal } from "./types/contextTypes.js";

/** Module to activity name mapping table */
const MODULE_ACTIVITY_MAP = {
  reader: "reading",
  focus: "focus_session",
  planner: "planning",
  routine: "planning",
  regulation: "regulation",
  breathing: "regulation",
  reflection: "reflection",
  dashboard: "browsing",
  chat: "communicating",
};

let _activityState = {
  currentModule: "dashboard",
  activity: "browsing",
  startedAt: new Date().toISOString(),
  durationSeconds: 0,
  previousActivity: null,
  recentEvents: [],
};

let _activityStartTime = Date.now();
const MAX_RECENT_EVENTS = 20;

/**
 * Determine canonical activity name from module or event.
 * @param {string} moduleOrEvent
 * @returns {string}
 */
function resolveActivityName(moduleOrEvent) {
  if (!moduleOrEvent) return "idle";
  const normalized = String(moduleOrEvent).toLowerCase();
  return MODULE_ACTIVITY_MAP[normalized] || normalized;
}

/**
 * Calculate elapsed duration for current activity in seconds.
 * @returns {number}
 */
function computeCurrentDuration() {
  return Math.floor((Date.now() - _activityStartTime) / 1000);
}

/**
 * Track a user activity event automatically.
 * Updates current module, activity name, duration, previous activity, and recent events log.
 *
 * @param {string} eventType - Type of activity (e.g. "reader", "focus", "planner", "regulation", "reflection", "module_open", "task_switch")
 * @param {object} [data] - Additional event metadata (e.g. { module: "reader", action: "open" })
 * @returns {import("./types/contextTypes.js").ActivityContext} Updated activity summary
 */
export function trackActivity(eventType, data = {}) {
  const now = new Date().toISOString();
  const targetModule = data.module || eventType || "dashboard";
  const newActivity = resolveActivityName(targetModule);

  const isModuleSwitch = newActivity !== _activityState.activity;

  let previousActivity = _activityState.previousActivity;
  if (isModuleSwitch) {
    previousActivity = _activityState.activity;
    _activityStartTime = Date.now();
  }

  const durationSeconds = computeCurrentDuration();

  const eventRecord = {
    eventType,
    module: targetModule,
    activity: newActivity,
    timestamp: now,
    data,
  };

  const updatedEvents = [eventRecord, ..._activityState.recentEvents].slice(0, MAX_RECENT_EVENTS);

  _activityState = {
    currentModule: targetModule,
    activity: newActivity,
    startedAt: isModuleSwitch ? now : _activityState.startedAt,
    durationSeconds,
    previousActivity,
    recentEvents: updatedEvents,
  };

  // Update ContextStore activity dimension cleanly
  contextStore.updateContext("activity", _activityState, "activityTracker", 1.0);

  // Construct and emit typed ActivityUpdated signal and event
  const signal = createContextSignal({
    source: "activityTracker",
    type: ContextEvents.ACTIVITY_UPDATED,
    payload: { ..._activityState },
    confidence: 1.0,
    ttlSeconds: 30,
  });

  contextEventBus.emit(ContextEvents.ACTIVITY_UPDATED, {
    activity: { ..._activityState },
    signal,
    timestamp: now,
  });

  contextEventBus.emit(ContextEvents.SIGNAL_RECEIVED, signal);

  return { ..._activityState };
}

/**
 * Get current activity summary.
 * @returns {import("./types/contextTypes.js").ActivityContext}
 */
export function getActivitySummary() {
  _activityState.durationSeconds = computeCurrentDuration();
  return { ..._activityState };
}

/**
 * Detect behavioral patterns from activity history without inferring cognitive state.
 * @returns {{ taskSwitchCount: number, recentModules: string[], patterns: string[] }}
 */
export function detectBehavioralPatterns() {
  const events = _activityState.recentEvents || [];
  const recentModules = [...new Set(events.map((e) => e.module))];
  const taskSwitchCount = events.filter((e) => e.eventType === "task_switch" || e.eventType === "module_open").length;

  const patterns = [];
  if (taskSwitchCount > 5) patterns.push("frequent_task_switching");
  if (recentModules.includes("regulation") || recentModules.includes("breathing")) patterns.push("active_self_regulation");

  return {
    taskSwitchCount,
    recentModules,
    patterns,
  };
}

/**
 * Reset activity tracker state (useful for testing).
 */
export function resetActivityTracker() {
  _activityStartTime = Date.now();
  _activityState = {
    currentModule: "dashboard",
    activity: "browsing",
    startedAt: new Date().toISOString(),
    durationSeconds: 0,
    previousActivity: null,
    recentEvents: [],
  };
}
