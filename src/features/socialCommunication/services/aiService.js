/**
 * aiService.js — The ONLY place the Social Communication Simulator talks to an
 * LLM. Mirrors the existing Gemini REST pattern (see
 * src/adaptive/context/conversationAgent.js) and never reaches the model from
 * UI components.
 *
 * Every call returns a Zod-validated object or `null`. A `null` result means
 * "AI unavailable" and the caller MUST fall back to a deterministic path —
 * success is never fabricated.
 *
 * Privacy: prompts are assembled from scenario context + a short slice of the
 * CURRENT turn only. No name, userId, audio, or full transcript is sent.
 */

import {
  AI_TIMEOUT_MS,
  AI_TRANSCRIPT_LIMIT,
  EvaluationInsightsSchema,
  NpcTurnSchema,
  ScenarioContentSchema,
  ToneAssessmentSchema,
} from "../types/communicationTypes";

const GEMINI_MODEL_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export function getGeminiApiKey() {
  return typeof import.meta !== "undefined" && import.meta?.env
    ? import.meta.env.VITE_GEMINI_API_KEY
    : undefined;
}

export function isGeminiAvailable() {
  return Boolean(getGeminiApiKey());
}

function clampPromptSlice(text, limit = AI_TRANSCRIPT_LIMIT) {
  if (typeof text !== "string") return "";
  if (text.length <= limit) return text;
  const boundary = text.slice(0, limit).lastIndexOf(" ");
  return boundary > limit * 0.6 ? text.slice(0, boundary) : text.slice(0, limit);
}

/**
 * Low-level JSON generation helper. Returns `{ ok, data }` or `{ ok: false, error }`.
 * Never throws for network/parse failures.
 */
export async function callGeminiJson(prompt, schema, options = {}) {
  const {
    apiKey = getGeminiApiKey(),
    timeoutMs = AI_TIMEOUT_MS,
    temperature = 0.7,
    maxOutputTokens = 900,
    fetchImpl,
  } = options;

  if (!apiKey) {
    return { ok: false, error: "missing_api_key" };
  }
  if (!prompt || !schema) {
    return { ok: false, error: "invalid_arguments" };
  }

  const doFetch = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  if (typeof doFetch !== "function") {
    return { ok: false, error: "fetch_unavailable" };
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId =
    controller && typeof setTimeout === "function"
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const response = await doFetch(`${GEMINI_MODEL_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json",
        },
      }),
      signal: controller ? controller.signal : undefined,
    });

    if (!response || !response.ok) {
      return { ok: false, error: `gemini_http_${response?.status ?? "unknown"}` };
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part?.text ?? "").join("\n") ?? "";
    if (!text.trim()) {
      return { ok: false, error: "empty_response" };
    }

    const parsed = extractJsonObject(text);
    if (!parsed) {
      return { ok: false, error: "invalid_json" };
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      return { ok: false, error: "schema_mismatch" };
    }

    return { ok: true, data: validated.data };
  } catch (error) {
    const message = error?.name === "AbortError" ? "timeout" : String(error?.message ?? error);
    return { ok: false, error: message };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Extract the first JSON object from a model response, tolerating markdown
 * fences and surrounding prose. Returns null when no object is found.
 */
export function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
//  Feature-specific generators
// ─────────────────────────────────────────────

export async function generateScenarioContent({ config, apiKey, fetchImpl }) {
  const domainLabel = config?.domain ?? "a daily situation";
  const prompt =
    `You generate one short, realistic social conversation scenario for a "Social Communication Simulator".\n` +
    `Return ONLY a JSON object with exactly these keys:\n` +
    `- "domain": "${domainLabel}"\n` +
    `- "title": short title\n` +
    `- "setting": where the conversation happens\n` +
    `- "goal": the user's goal for the conversation (one clear sentence)\n` +
    `- "context": one sentence describing the situation\n` +
    `- "npc": { "name", "role", "personality" }\n` +
    `- "openingLine": the first thing the other person says\n` +
    `- "suggestedResponses": 3 example replies the user could give\n` +
    `- "hint": an optional gentle tip (or empty string)\n` +
    `Rules: neutral, everyday tone; no stereotypes about accents or disability; ` +
    `keep the whole scenario under 120 words; the other person is friendly.` +
    (config?.contextHint ? `\nRelevant detail for this user: ${clampPromptSlice(config.contextHint)}` : "");

  const result = await callGeminiJson(prompt, ScenarioContentSchema, {
    apiKey,
    fetchImpl,
  });
  return result.ok ? result.data : null;
}

export async function generateNpcTurn({ scenario, userTurn, turnIndex, totalTurns, apiKey, fetchImpl }) {
  const prompt =
    `You are playing the other person in a practice conversation.\n` +
    `Scenario: ${scenario?.title}. Goal: ${scenario?.goal}.\n` +
    `The other person: ${scenario?.npc?.name ?? "the other person"}, ${scenario?.npc?.role ?? "a friendly person"}.\n` +
    `The user just said: "${clampPromptSlice(userTurn)}"\n` +
    `Return ONLY JSON with keys: "line" (your reply, 1 sentence), "followUp" (one open question to keep the conversation going), ` +
    `"emotion" (e.g. "friendly", "neutral", "warm"), "done" (true ONLY if this should be the last exchange, given it is turn ${turnIndex} of ${totalTurns}), "hint" (optional gentle tip or empty string).\n` +
    `Be realistic, kind and neutral. Never correct the user's grammar or accent.`;

  const result = await callGeminiJson(prompt, NpcTurnSchema, { apiKey, fetchImpl });
  return result.ok ? result.data : null;
}

export async function generateEvaluationInsights({ evaluation, userTurns, scenario, apiKey, fetchImpl }) {
  const prompt =
    `You refine written feedback for a communication practice session. The structured scores are already computed; never change them.\n` +
    `Session goal: ${scenario?.goal ?? ""}.\n` +
    `Average dimension scores (0-100): ${JSON.stringify(evaluation?.dimensions ?? [])}\n` +
    `User's replies: ${clampPromptSlice((userTurns ?? []).join(" | "))}\n` +
    `Return ONLY JSON with keys: "strengths" (up to 3 kind, specific positives), "improvements" (up to 3 neutral, actionable suggestions), ` +
    `"alternatives" (2-3 example rephrasings the user could try next time), "overallComment" (one encouraging sentence).\n` +
    `Use warm, non-judgmental language. Never criticise accent, eye contact, gestures or a disability.`;

  const result = await callGeminiJson(prompt, EvaluationInsightsSchema, { apiKey, fetchImpl });
  return result.ok ? result.data : null;
}

export async function generateToneAssessment({ userTurns, scenario, apiKey, fetchImpl }) {
  const prompt =
    `Rate how rude or unfriendly this person sounds in a practice conversation.\n` +
    `Conversation goal: ${scenario?.goal ?? ""}.\n` +
    `Their replies: "${clampPromptSlice((userTurns ?? []).join(" | "))}"\n` +
    `Return ONLY JSON with one key "toneScore": a number 0-100 where 100 is warm and polite, ` +
    `70 is neutral, and anything under 40 is hostile, rude, condescending or sarcastic. ` +
    `Consider demanding tone, dismissal, insults, sarcasm and passive aggression — not only profanity. ` +
    `If there are no replies, use 50.`;

  const result = await callGeminiJson(prompt, ToneAssessmentSchema, {
    apiKey,
    fetchImpl,
    temperature: 0.2,
    maxOutputTokens: 60,
  });
  return result.ok ? result.data : null;
}
