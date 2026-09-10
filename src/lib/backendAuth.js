import { supabase } from "@/lib/supabaseClient";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:8000");

const DEMO_SESSION_KEY = "nb_agent_demo_session_id";

/**
 * Demo/mock logins (see AuthContext.jsx's MOCK_USERS) have no real Supabase
 * session, so there's no token to send. Instead we generate a random,
 * per-browser session id once and persist it — this keeps one demo visitor's
 * backend data (real DB rows, just under a "demo:" namespaced id) isolated
 * from every other demo visitor, even though they picked the same demo role.
 */
function getOrCreateDemoSessionId() {
  try {
    let id = localStorage.getItem(DEMO_SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEMO_SESSION_KEY, id);
    }
    return id;
  } catch {
    return `volatile-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Shared with agentStore.js's own copy of this logic — every authenticated
 * backend call (agent chat, the Gemini proxy, data export/deletion) needs the
 * exact same "real Supabase session token, or a namespaced demo pseudo-token"
 * resolution, and duplicating it risks the two copies drifting apart.
 */
export async function backendAuthHeaders(user) {
  if (user?._supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }
  if (user?.id) {
    const sessionId = getOrCreateDemoSessionId();
    return { Authorization: `Bearer demo:${user.id}:${sessionId}` };
  }
  return {};
}
