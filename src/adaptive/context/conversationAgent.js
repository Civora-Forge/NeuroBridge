/**
 * conversationAgent.js — Conversation Analysis Agent
 *
 * Part of the Context & Perception Engine for NeuroBridge V2.
 *
 * PURPOSE: Context extraction from user text (intent, sentiment, emotional cues,
 * challenges, urgency). It is NOT a chatbot response generator and does NOT
 * generate conversational replies or diagnose medical/psychological conditions.
 *
 * FEATURES:
 * - Structured JSON output validated via Zod schema
 * - Gemini AI provider integration with fallback to heuristic rule-based analyzer
 * - Strict timeout handling (AbortController)
 * - Malformed JSON recovery
 * - Minimal token footprint
 * - Emits ConversationUpdated event & updates Context Engine
 */

import { z } from "zod";
import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";
import { contextStore } from "./contextStore.js";
import { createContextSignal } from "./types/contextTypes.js";

/** Zod Schema for Conversation Analysis Output */
export const ConversationAnalysisSchema = z.object({
  intent: z.string().default("general_inquiry"),
  sentiment: z.enum(["positive", "neutral", "negative"]).default("neutral"),
  emotionalCues: z.array(z.string()).default([]),
  challenges: z.array(z.string()).default([]),
  urgency: z.enum(["low", "moderate", "high", "critical"]).default("low"),
  confidence: z.number().min(0).max(1).default(0.5),
});

/** @typedef {z.infer<typeof ConversationAnalysisSchema>} ConversationAnalysisResult */

// Default Gemini API configuration
const DEFAULT_GEMINI_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY);

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const DEFAULT_TIMEOUT_MS = 4000;

/**
 * Heuristic rule-based fallback analyzer used when AI is offline, times out, or returns malformed response.
 * @param {string} text
 * @returns {ConversationAnalysisResult}
 */
export function heuristicAnalyzeConversation(text) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return {
      intent: "unknown",
      sentiment: "neutral",
      emotionalCues: [],
      challenges: [],
      urgency: "low",
      confidence: 0.3,
    };
  }

  const lower = text.toLowerCase();

  // Sentiment detection
  let sentiment = "neutral";
  if (/happy|great|good|awesome|calm|focused|relaxed|thanks|helpful/i.test(lower)) {
    sentiment = "positive";
  } else if (/can't|cannot|hard|stuck|frustrated|overwhelmed|panic|fail|tired|stress|impossible|hate|sad|lost/i.test(lower)) {
    sentiment = "negative";
  }

  // Emotional cues extraction
  const emotionalCues = [];
  if (/frustrat/i.test(lower)) emotionalCues.push("frustration");
  if (/overwhelm|too much|drowning|too many/i.test(lower)) emotionalCues.push("overwhelm");
  if (/anxi|panic|fear|scared|worry/i.test(lower)) emotionalCues.push("anxiety");
  if (/concentrat|focus|distract|mind wandering/i.test(lower)) emotionalCues.push("focus_struggle");
  if (/tired|exhausted|burnout|sleepy/i.test(lower)) emotionalCues.push("fatigue");

  // Challenges extraction
  const challenges = [];
  if (/concentrat|focus|distract/i.test(lower)) challenges.push("focus");
  if (/work|task|assignment|deadline|so much to do/i.test(lower)) challenges.push("workload");
  if (/time|late|schedule|plan/i.test(lower)) challenges.push("time_management");
  if (/sensory|noise|bright|overstimulat/i.test(lower)) challenges.push("sensory_overload");

  // Urgency estimation
  let urgency = "low";
  if (/panic|emergency|crisis|can't breathe|help me now/i.test(lower)) {
    urgency = "critical";
  } else if (/can't concentrate|so much work|stuck|overwhelmed|urgent/i.test(lower)) {
    urgency = "high";
  } else if (/need help|how do i|question|explain/i.test(lower)) {
    urgency = "moderate";
  }

  // Intent classification
  let intent = "general_inquiry";
  if (challenges.includes("focus")) intent = "focus_support";
  else if (challenges.includes("workload")) intent = "task_support";
  else if (challenges.includes("sensory_overload")) intent = "sensory_support";
  else if (challenges.includes("time_management")) intent = "planning_support";

  return {
    intent,
    sentiment,
    emotionalCues,
    challenges,
    urgency,
    confidence: 0.7,
  };
}

/**
 * Call Gemini REST API for structured context extraction with timeout & validation.
 * @param {string} text
 * @param {string} apiKey
 * @param {number} timeoutMs
 * @returns {Promise<ConversationAnalysisResult>}
 */
async function callGeminiForAnalysis(text, apiKey = DEFAULT_GEMINI_KEY, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const prompt = `You are a context extraction perception module for a neurodivergent support system.
Extract structured context JSON from the following user input.
Do NOT generate a response to the user.
Do NOT diagnose medical or psychological conditions.
Respond ONLY with a valid JSON object matching this schema:
{
  "intent": string (e.g. "focus_support", "task_support", "emotional_checkin", "general_inquiry"),
  "sentiment": "positive" | "neutral" | "negative",
  "emotionalCues": string[] (e.g. ["frustration", "overwhelm", "anxiety", "fatigue"]),
  "challenges": string[] (e.g. ["focus", "workload", "time_management", "sensory_overload"]),
  "urgency": "low" | "moderate" | "high" | "critical",
  "confidence": number (between 0.0 and 1.0)
}

User input: "${text.replace(/"/g, '\\"')}"`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 250,
          responseMimeType: "application/json",
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON output
    let parsedJSON;
    try {
      parsedJSON = JSON.parse(rawText);
    } catch (_jsonErr) {
      // Attempt regex extraction of JSON object if wrapped in code block
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedJSON = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse JSON response from AI model");
      }
    }

    // Validate with Zod schema
    const validated = ConversationAnalysisSchema.parse(parsedJSON);
    return validated;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      console.warn("[conversationAgent] AI request timed out. Falling back to heuristic analysis.");
    } else {
      console.warn("[conversationAgent] AI request failed:", error.message || error);
    }
    // Fall back to heuristic rule-based analysis
    return heuristicAnalyzeConversation(text);
  }
}

/**
 * Primary entry point for Conversation Analysis Agent.
 * Analyzes user text, extracts structured context, updates Context Store, and emits ConversationUpdated.
 *
 * @param {string} text - User message or input text
 * @param {object} [options]
 * @param {boolean} [options.useAI=true] - Whether to attempt AI call (false forces fast heuristic analysis)
 * @param {string} [options.apiKey] - Optional custom Gemini API key
 * @param {number} [options.timeoutMs] - Optional custom timeout
 * @returns {Promise<ConversationAnalysisResult> | ConversationAnalysisResult}
 */
export function analyzeConversation(text, options = {}) {
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    const emptyResult = {
      intent: "unknown",
      sentiment: "neutral",
      emotionalCues: [],
      challenges: [],
      urgency: "low",
      confidence: 0.0,
    };
    return emptyResult;
  }

  const useAI = options.useAI !== false;

  const processResult = (analysis) => {
    const validated = ConversationAnalysisSchema.parse(analysis);
    const now = new Date().toISOString();

    const conversationData = {
      lastUserMessage: text,
      timestamp: now,
      lastUpdated: now,
      sentimentScore: validated.sentiment === "positive" ? 0.8 : validated.sentiment === "negative" ? -0.8 : 0.0,
      detectedIntent: validated.intent,
      urgency: validated.urgency,
      keyTopics: validated.challenges,
      emotionalCues: validated.emotionalCues,
      analysis: validated,
    };

    if (options.persist === false) {
      return validated;
    }

    // Update Context Store conversation category (silent — engine emits ContextUpdated)
    contextStore.updateContext("conversation", conversationData, "conversationAgent", validated.confidence);

    // Construct and emit ConversationUpdated signal & event
    const signal = createContextSignal({
      source: "conversationAgent",
      type: ContextEvents.CONVERSATION_UPDATED,
      payload: conversationData,
      confidence: validated.confidence,
      ttlSeconds: 120,
    });

    contextEventBus.emit(ContextEvents.CONVERSATION_UPDATED, {
      conversation: conversationData,
      analysis: validated,
      signal,
      timestamp: now,
    });

    contextEventBus.emit(ContextEvents.SIGNAL_RECEIVED, signal);

    return validated;
  };

  if (useAI) {
    return callGeminiForAnalysis(text, options.apiKey, options.timeoutMs).then(processResult);
  } else {
    const heuristicResult = heuristicAnalyzeConversation(text);
    return processResult(heuristicResult);
  }
}

/**
 * Extract explicit user request and topic keyword from text input.
 * Preserves backward compatibility.
 *
 * @param {string} input
 * @returns {{ request?: string, topic?: string }}
 */
export function extractExplicitRequest(input) {
  if (!input) return { request: null, topic: null };
  const analysis = heuristicAnalyzeConversation(input);
  return {
    request: input,
    topic: analysis.challenges[0] || analysis.intent || "general",
  };
}
