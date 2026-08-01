/**
 * contextPipeline.js — End-to-end context processing orchestration
 *
 * Chains: Conversation Analysis → Mood Inference → Validation → Fusion → ContextUpdated
 */

import { contextEngine } from "./contextEngine.js";
import { analyzeConversation } from "./conversationAgent.js";
import { inferMood } from "./moodAgent.js";
import { contextStore } from "./contextStore.js";
import { createContextSignal } from "./types/contextTypes.js";
import { ContextEvents } from "./events/contextEvents.js";
import { logFusion } from "./contextLogger.js";
import { toContextSnapshot } from "./contextSnapshotAdapter.js";

/**
 * Build conversation store payload from analysis result.
 * @param {string} text
 * @param {object} validated
 */
function buildConversationData(text, validated) {
  return {
    lastUserMessage: text,
    sentimentScore: validated.sentiment === "positive" ? 0.8 : validated.sentiment === "negative" ? -0.8 : 0.0,
    detectedIntent: validated.intent,
    urgency: validated.urgency,
    keyTopics: validated.challenges,
    emotionalCues: validated.emotionalCues,
    analysis: validated,
  };
}

/**
 * Build mood store payload from inference result.
 * @param {object} result
 */
function buildMoodStoreData(result) {
  return {
    primaryMood: result.value,
    valence: result.value === "positive" || result.value === "calm" ? 0.8 : result.value === "neutral" ? 0.5 : 0.25,
    arousal: result.value === "overwhelmed" || result.value === "stressed" || result.value === "frustrated" ? 0.85 : 0.4,
    emotions: [result.value],
    moodTrend: "stable",
    confidence: result.confidence,
    sources: result.sources,
  };
}

/**
 * Process user text through the full perception pipeline.
 *
 * @param {string} text - User message
 * @param {object} [options]
 * @param {boolean} [options.useAI] - Override AI usage (defaults to online-aware)
 * @param {string} [options.explicitMood] - Optional explicit mood check-in
 * @returns {Promise<{ analysis: object, mood: object, context: import("./types/contextTypes.js").ContextSnapshot }>}
 */
export async function processUserMessage(text, options = {}) {
  const env = contextStore.getContext().environment;
  const useAI = options.useAI !== undefined ? options.useAI : env?.isOnline !== false;

  const analysis = await Promise.resolve(
    analyzeConversation(text, { ...options, useAI, persist: false })
  );

  const conversationData = buildConversationData(text, analysis);

  contextEngine.ingestSignal(
    createContextSignal({
      source: "conversationAgent",
      type: ContextEvents.CONVERSATION_UPDATED,
      payload: conversationData,
      confidence: analysis.confidence,
      ttlSeconds: 120,
    })
  );

  const moodInputs = {
    conversation: conversationData,
    activity: contextStore.getContext().activity,
  };
  if (options.explicitMood) {
    moodInputs.explicitMood = options.explicitMood;
  }

  const moodResult = inferMood({ ...moodInputs, persist: false });
  const moodStoreData = buildMoodStoreData(moodResult);

  const fusedContext = contextEngine.ingestSignal(
    createContextSignal({
      source: "moodAgent",
      type: ContextEvents.MOOD_UPDATED,
      payload: { ...moodResult, ...moodStoreData },
      confidence: moodResult.confidence,
      ttlSeconds: 90,
    })
  );

  const contextSnapshot = toContextSnapshot(fusedContext);

  logFusion(fusedContext);

  return {
    analysis,
    mood: moodResult,
    context: contextSnapshot,
  };
}

/**
 * Sync user profile from auth/onboarding into context store.
 * @param {object} profile
 */
export function syncProfileContext(profile) {
  if (!profile) return;

  contextEngine.ingestSignal(
    createContextSignal({
      source: "authProfile",
      type: "ProfileUpdated",
      payload: {
        category: "profile",
        userId: profile.id || profile.userId || null,
        disorders: Array.isArray(profile.disorders) ? profile.disorders : [],
        sensorySensitivities: profile.sensorySensitivities || [],
        communicationPreference: profile.communicationPreference || "adaptive",
        baselineValence: profile.baselineValence ?? 0.5,
      },
      confidence: 1.0,
      ttlSeconds: 3600,
    })
  );
}
