/**
 * moodAgent.js — Mood / Emotion Inference Agent
 *
 * Part of the Context & Perception Engine for NeuroBridge V2.
 *
 * PURPOSE:
 * Infers a coarse, non-clinical current emotional context from available signals
 * using a multi-source priority hierarchy.
 *
 * CONTROLLED VOCABULARY:
 * - "calm"
 * - "positive"
 * - "neutral"
 * - "tired"
 * - "frustrated"
 * - "stressed"
 * - "overwhelmed"
 * - "unknown"
 *
 * SIGNAL SOURCE PRIORITY HIERARCHY:
 * 1. Explicit user mood check-in — HIGHEST confidence (1.0)
 * 2. Conversation analysis (from conversationAgent)
 * 3. Recent relevant interaction signals (from activityTracker)
 * 4. Previous recent mood — LOWEST priority
 *
 * OUTPUT STRUCTURE:
 * {
 *   "value": "stressed",
 *   "confidence": 0.84,
 *   "sources": ["explicit_checkin", "conversation", "activity"],
 *   "timestamp": "2026-07-26T13:48:58.000Z"
 * }
 *
 * Ownership: Context & Perception Engineer
 */

import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";
import { contextStore } from "./contextStore.js";
import { createContextSignal } from "./types/contextTypes.js";

/** Controlled Vocabulary for Mood Inference */
export const MOOD_VOCABULARY = [
  "calm",
  "positive",
  "neutral",
  "tired",
  "frustrated",
  "stressed",
  "overwhelmed",
  "unknown",
];

let _lastInferredMood = {
  value: "unknown",
  confidence: 0.0,
  sources: [],
  timestamp: new Date().toISOString(),
};

/**
 * Normalize input mood string against controlled vocabulary.
 * @param {string} rawMood
 * @returns {string}
 */
function normalizeMoodValue(rawMood) {
  if (!rawMood || typeof rawMood !== "string") return "unknown";
  const lower = rawMood.toLowerCase().trim();
  if (MOOD_VOCABULARY.includes(lower)) return lower;

  // Synonyms mapping
  if (/anxio|anxiety|panic|scared|worried/i.test(lower)) return "stressed";
  if (/drowning|too much|overloaded/i.test(lower)) return "overwhelmed";
  if (/annoyed|angry|mad|stuck/i.test(lower)) return "frustrated";
  if (/exhausted|fatigue|sleepy|drained/i.test(lower)) return "tired";
  if (/happy|great|good|cheerful/i.test(lower)) return "positive";
  if (/relaxed|peaceful|serene/i.test(lower)) return "calm";

  return "unknown";
}

/**
 * Infer mood value from conversation analysis object.
 * @param {object} conversationData
 * @returns {{ value: string, confidence: number }}
 */
function inferFromConversation(conversationData) {
  if (!conversationData) return { value: "unknown", confidence: 0.0 };

  const analysis = conversationData.analysis || conversationData;
  const sentiment = analysis.sentiment || conversationData.sentiment;
  const cues = analysis.emotionalCues || conversationData.emotionalCues || [];
  const urgency = analysis.urgency || conversationData.urgency;
  const confidence = analysis.confidence || 0.7;

  let value = "unknown";

  if (cues.includes("overwhelm") || urgency === "critical" || urgency === "high") {
    value = cues.includes("overwhelm") ? "overwhelmed" : "stressed";
  } else if (cues.includes("frustration")) {
    value = "frustrated";
  } else if (cues.includes("fatigue") || cues.includes("tired")) {
    value = "tired";
  } else if (cues.includes("anxiety")) {
    value = "stressed";
  } else if (sentiment === "positive" || cues.includes("calm")) {
    value = cues.includes("calm") ? "calm" : "positive";
  } else if (sentiment === "negative") {
    value = "stressed";
  } else if (sentiment === "neutral" && cues.length === 0) {
    value = "neutral";
  }

  return { value, confidence: confidence * 0.85 };
}

/**
 * Infer mood value from activity tracking signals.
 * @param {object} activityData
 * @returns {{ value: string, confidence: number }}
 */
function inferFromActivity(activityData) {
  if (!activityData) return { value: "unknown", confidence: 0.0 };

  const module = activityData.currentModule || activityData.activity || "";
  const recentEvents = activityData.recentEvents || [];
  const eventCount = recentEvents.length;

  if (module === "regulation" || module === "breathing") {
    return { value: "stressed", confidence: 0.65 };
  }

  if (eventCount >= 5) {
    return { value: "overwhelmed", confidence: 0.60 };
  }

  if (eventCount >= 3) {
    return { value: "stressed", confidence: 0.50 };
  }

  return { value: "unknown", confidence: 0.0 };
}

/**
 * Primary Mood / Emotion Inference Function.
 *
 * Implements priority hierarchy:
 * 1. Explicit user mood check-in (Highest confidence: 1.0)
 * 2. Conversation analysis
 * 3. Interaction / Activity signals
 * 4. Previous recent mood (Lowest priority decay)
 *
 * @param {object} [inputs]
 * @param {string} [inputs.explicitMood] - Direct user check-in mood (e.g. "stressed", "calm")
 * @param {object} [inputs.conversation] - Conversation context object or text message
 * @param {object} [inputs.activity] - Recent activity tracking object
 * @param {boolean} [inputs.persist=true] - When false, skip store/event writes (pipeline handles ingestion)
 * @returns {{ value: string, confidence: number, sources: string[], timestamp: string }}
 */
export function inferMood(inputs = {}) {
  const now = new Date().toISOString();
  const sources = [];

  const contextSnapshot = contextStore.getContext();
  const currentConv = inputs.conversation || contextSnapshot.conversation;
  const currentAct = inputs.activity || contextSnapshot.activity;

  let explicitCandidate = null;
  let conversationCandidate = null;
  let activityCandidate = null;
  let previousCandidate = null;

  // 1. Explicit User Check-in (Priority 1)
  if (inputs.explicitMood) {
    const norm = normalizeMoodValue(inputs.explicitMood);
    if (norm !== "unknown") {
      explicitCandidate = { value: norm, confidence: 1.0 };
      sources.push("explicit_checkin");
    }
  }

  // 2. Conversation Analysis (Priority 2)
  if (currentConv) {
    const convText = typeof currentConv === "string" ? currentConv : currentConv.lastUserMessage;
    if (convText) {
      const convInference = inferFromConversation(currentConv);
      if (convInference.value !== "unknown") {
        conversationCandidate = convInference;
        sources.push("conversation");
      }
    }
  }

  // 3. Recent Interaction Signals (Priority 3)
  if (currentAct) {
    const actInference = inferFromActivity(currentAct);
    if (actInference.value !== "unknown") {
      activityCandidate = actInference;
      sources.push("activity");
    }
  }

  // 4. Previous Recent Mood (Priority 4)
  if (_lastInferredMood && _lastInferredMood.value !== "unknown") {
    // Apply temporal decay to previous mood
    const ageSeconds = (Date.now() - new Date(_lastInferredMood.timestamp).getTime()) / 1000;
    if (ageSeconds < 600) {
      // Valid for 10 minutes
      const decayedConfidence = Math.max(0.1, _lastInferredMood.confidence * 0.6);
      previousCandidate = { value: _lastInferredMood.value, confidence: decayedConfidence };
      sources.push("previous_mood");
    }
  }

  // Final Synthesis & Conflict Resolution
  let finalValue = "unknown";
  let finalConfidence = 0.0;

  if (explicitCandidate) {
    finalValue = explicitCandidate.value;
    finalConfidence = explicitCandidate.confidence;

    // Check for conflict with conversation or activity to adjust confidence
    if (conversationCandidate && conversationCandidate.value !== explicitCandidate.value) {
      // E.g. User checked in as "calm", but conversation text indicates distress
      finalConfidence = Math.max(0.6, finalConfidence - 0.25);
    }
  } else if (conversationCandidate) {
    finalValue = conversationCandidate.value;
    finalConfidence = conversationCandidate.confidence;

    // Reinforce if activity candidate agrees
    if (activityCandidate && activityCandidate.value === conversationCandidate.value) {
      finalConfidence = Math.min(0.95, finalConfidence + 0.15);
    } else if (activityCandidate && activityCandidate.value !== conversationCandidate.value) {
      // Conflict between conversation and activity reduces confidence
      finalConfidence = Math.max(0.4, finalConfidence - 0.2);
    }
  } else if (activityCandidate) {
    finalValue = activityCandidate.value;
    finalConfidence = activityCandidate.confidence;
  } else if (previousCandidate) {
    finalValue = previousCandidate.value;
    finalConfidence = previousCandidate.confidence;
  }

  // If evidence is insufficient (confidence < 0.35 or value is unknown), return unknown
  if (finalConfidence < 0.35 || finalValue === "unknown") {
    finalValue = "unknown";
    finalConfidence = 0.0;
  }

  // Format final output
  const result = {
    value: finalValue,
    confidence: +finalConfidence.toFixed(2),
    sources,
    timestamp: now,
  };

  _lastInferredMood = { ...result };

  const persist = inputs.persist !== false;

  const storeMoodData = {
    primaryMood: result.value,
    valence: result.value === "positive" || result.value === "calm" ? 0.8 : result.value === "neutral" ? 0.5 : 0.25,
    arousal: result.value === "overwhelmed" || result.value === "stressed" || result.value === "frustrated" ? 0.85 : 0.4,
    emotions: [result.value],
    moodTrend: "stable",
    confidence: result.confidence,
    sources: result.sources,
  };

  if (!persist) {
    return result;
  }

  contextStore.updateContext("mood", storeMoodData, "moodAgent", result.confidence);

  // Construct and emit MoodUpdated signal & event
  const signal = createContextSignal({
    source: "moodAgent",
    type: ContextEvents.MOOD_UPDATED,
    payload: result,
    confidence: result.confidence,
    ttlSeconds: 90,
  });

  contextEventBus.emit(ContextEvents.MOOD_UPDATED, {
    mood: result,
    signal,
    timestamp: now,
  });

  contextEventBus.emit(ContextEvents.SIGNAL_RECEIVED, signal);

  return result;
}

/**
 * Detect significant mood shifts.
 * Preserves legacy compatibility.
 * @param {object} currentMood
 * @param {object} previousMood
 * @returns {{ changed: boolean, direction?: string, severity?: string }}
 */
export function detectMoodShift(currentMood, previousMood) {
  if (!currentMood || !previousMood) return { changed: false };
  const changed = currentMood.value !== previousMood.value && currentMood.value !== "unknown";
  return {
    changed,
    direction: changed ? (currentMood.value === "calm" || currentMood.value === "positive" ? "positive" : "negative") : "stable",
    severity: changed ? "moderate" : "none",
  };
}

/**
 * Reset mood agent state (useful for testing).
 */
export function resetMoodAgent() {
  _lastInferredMood = {
    value: "unknown",
    confidence: 0.0,
    sources: [],
    timestamp: new Date().toISOString(),
  };
}
