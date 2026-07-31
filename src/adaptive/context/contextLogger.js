/**
 * contextLogger.js — Development-only pipeline observability
 *
 * Logs context pipeline stages without exposing raw user message content.
 * Enable via VITE_CONTEXT_DEBUG=true or import.meta.env.DEV.
 */

import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";

const PREFIX = "[ContextPipeline]";

function isDebugEnabled() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (import.meta.env.VITE_CONTEXT_DEBUG === "true") return true;
    if (import.meta.env.VITE_CONTEXT_DEBUG === "false") return false;
    return import.meta.env.DEV === true;
  }
  return false;
}

function redactMessage(text) {
  if (!text || typeof text !== "string") return null;
  return `[${text.length} chars]`;
}

function summarizeSignal(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const { signal, conversation, mood, activity, environment, session, analysis, ...rest } = payload;

  const summary = { ...rest };

  if (signal) {
    summary.signal = {
      id: signal.id,
      source: signal.source,
      type: signal.type,
      confidence: signal.confidence,
    };
  }

  if (conversation) {
    summary.conversation = {
      intent: conversation.detectedIntent || analysis?.intent,
      sentiment: analysis?.sentiment,
      urgency: conversation.urgency || analysis?.urgency,
      message: redactMessage(conversation.lastUserMessage),
      confidence: analysis?.confidence,
    };
  }

  if (mood) {
    summary.mood = {
      value: mood.value || mood.primaryMood,
      confidence: mood.confidence,
      sources: mood.sources,
    };
  }

  if (activity) {
    summary.activity = {
      module: activity.currentModule,
      activity: activity.activity,
    };
  }

  if (environment) {
    summary.environment = {
      timeOfDay: environment.timeOfDay,
      isOnline: environment.isOnline,
      deviceType: environment.device?.deviceType,
    };
  }

  if (session) {
    summary.session = {
      screen: session.currentScreen,
      durationSeconds: session.durationSeconds,
    };
  }

  return summary;
}

let _initialized = false;
const _unsubscribers = [];

/**
 * Attach dev-only event bus listeners for pipeline tracing.
 * Safe to call multiple times — only initializes once.
 */
export function initContextLogger() {
  if (!isDebugEnabled() || _initialized) return;
  _initialized = true;

  const log = (stage, payload) => {
    console.debug(PREFIX, stage, summarizeSignal(payload));
  };

  _unsubscribers.push(
    contextEventBus.subscribe(ContextEvents.SIGNAL_RECEIVED, (signal) => {
      log("SignalReceived", { signal });
    }),
    contextEventBus.subscribe(ContextEvents.CONVERSATION_UPDATED, (payload) => {
      log("AnalyzerResult", payload);
    }),
    contextEventBus.subscribe(ContextEvents.MOOD_UPDATED, (payload) => {
      log("MoodUpdate", payload);
    }),
    contextEventBus.subscribe(ContextEvents.ACTIVITY_UPDATED, (payload) => {
      log("ActivityUpdate", payload);
    }),
    contextEventBus.subscribe(ContextEvents.ENVIRONMENT_UPDATED, (payload) => {
      log("EnvironmentUpdate", payload);
    }),
    contextEventBus.subscribe(ContextEvents.SESSION_UPDATED, (payload) => {
      log("SessionUpdate", payload);
    }),
    contextEventBus.subscribe(ContextEvents.CONTEXT_UPDATED, (payload) => {
      log("ContextUpdated", {
        category: payload.category,
        source: payload.source,
        isMaterialChange: payload.isMaterialChange,
        materialChanges: payload.materialChanges,
        mood: payload.context?.mood?.primaryMood,
        activity: payload.context?.activity?.activity,
        freshnessIndex: payload.context?.metadata?.freshnessIndex,
      });
    })
  );

  console.debug(PREFIX, "Pipeline logging enabled");
}

/**
 * Log a fusion step manually (e.g. after getLatestContext).
 * @param {object} fusedContext
 */
export function logFusion(fusedContext) {
  if (!isDebugEnabled()) return;
  console.debug(PREFIX, "Fusion", {
    mood: fusedContext?.mood?.primaryMood,
    moodConfidence: fusedContext?.mood?.confidence,
    activity: fusedContext?.activity?.activity,
    freshnessIndex: fusedContext?.metadata?.freshnessIndex,
    overallConfidence: fusedContext?.metadata?.overallConfidence,
    stalenessFlags: fusedContext?.metadata?.stalenessFlags,
  });
}

/**
 * Tear down logger subscriptions (for tests).
 */
export function teardownContextLogger() {
  _unsubscribers.forEach((unsub) => unsub());
  _unsubscribers.length = 0;
  _initialized = false;
}

export { isDebugEnabled };
