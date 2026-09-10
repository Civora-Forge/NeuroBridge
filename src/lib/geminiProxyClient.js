/**
 * geminiProxyClient.js — the ONLY place in the frontend that should send a
 * `generateContent` request. It talks to the backend's `/api/ai/generate`
 * proxy (backend/routers/ai_proxy_router.py) instead of calling
 * generativelanguage.googleapis.com directly with a bundled API key.
 *
 * Why this exists: VITE_-prefixed env vars are compiled into the public JS
 * bundle, so a client-side Gemini API key is extractable by anyone who opens
 * devtools — a real billing/abuse exposure, and it meant AI calls had no
 * auth, no rate limiting, and no server-side visibility. Routing through the
 * backend closes that gap without changing what any feature sends to Gemini:
 * callers still build their own `contents`/`generationConfig`, this just
 * changes where the request is sent and who holds the key.
 *
 * The response shape is passed through unchanged from Gemini's own API
 * (`{ candidates: [{ content: { parts: [{ text }] } }] }`), so existing
 * response-parsing code in callers doesn't need to change.
 */

import { backendAuthHeaders, API_BASE_URL } from "@/lib/backendAuth";
import { supabase } from "@/lib/supabaseClient";

/**
 * Most callers of this module are plain service functions (not React
 * components), several calls deep from anywhere that holds the app's
 * `useAuth()` user object. Rather than threading `user` through every one of
 * those signatures, fall back to reading the real Supabase session directly
 * when no `user` was passed — that's exactly what `backendAuthHeaders` would
 * do anyway for a real (`_supabase: true`) user. Demo/mock accounts (which
 * have no Supabase session) simply don't get this optional AI enhancement
 * unless the caller explicitly passes their `user` object through.
 */
async function resolveAuthHeaders(user) {
  if (user) return backendAuthHeaders(user);
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * @param {object} params
 * @param {string} [params.model] - one of the backend's allowed Gemini models; falls back to the backend's default if omitted/unrecognized.
 * @param {Array<object>} params.contents - Gemini `contents` array (text and/or inline_data parts).
 * @param {object} [params.generationConfig] - Gemini `generationConfig` (temperature, maxOutputTokens, responseMimeType, ...).
 * @param {object} [params.user] - the current authenticated user (from useAuth()/AuthContext), used to attach the right auth header.
 * @param {typeof fetch} [params.fetchImpl] - injectable fetch for tests.
 * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
 */
export async function callGeminiProxy({ model, contents, generationConfig, user, fetchImpl } = {}) {
  const doFetch = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  if (typeof doFetch !== "function") {
    return { ok: false, error: "fetch_unavailable" };
  }
  if (!Array.isArray(contents) || contents.length === 0) {
    return { ok: false, error: "invalid_arguments" };
  }

  // No client-side "not authenticated" short-circuit here on purpose: the
  // backend is the real authority on whether this request is allowed (it
  // also accepts namespaced demo pseudo-tokens — see backend/auth.py — which
  // this module has no way to distinguish from "no session" up front). An
  // unauthenticated request simply gets a 401 from the backend like any
  // other failure, which every caller already treats as "AI unavailable,
  // fall back to a deterministic path" — no special-casing needed.
  const headers = { "Content-Type": "application/json", ...(await resolveAuthHeaders(user)) };

  try {
    const response = await doFetch(`${API_BASE_URL}/api/ai/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, contents, generation_config: generationConfig }),
    });
    if (!response.ok) {
      const body = typeof response.json === "function" ? await response.json().catch(() => ({})) : {};
      return { ok: false, error: body?.detail || `proxy_error_${response.status}` };
    }
    return { ok: true, data: await response.json() };
  } catch (err) {
    return { ok: false, error: err?.message || "network_error" };
  }
}

/** Convenience: extract the first candidate's text, mirroring the raw Gemini response shape callers already parse. */
export function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
