import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';
import { listInterventions } from '@/support/persistence/role4Store';
import { currentStatusLabel, friendlyToolLabel } from '@/lib/agentEvents';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');
const DEMO_SESSION_KEY = 'nb_agent_demo_session_id';

/**
 * Demo/mock logins (see AuthContext.jsx's MOCK_USERS) have no real Supabase
 * session, so there's no token to send. Instead we generate a random,
 * per-browser session id once and persist it — this keeps one demo visitor's
 * agent data (real DB rows, just under a "demo:" namespaced id) isolated from
 * every other demo visitor, even though they picked the same demo role.
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

async function authHeaders(user) {
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

/**
 * Small, explicit snapshot of frontend-only (localStorage-backed) activity —
 * NOT a raw dump. Sent as untrusted supplementary context; the backend never
 * treats it as authoritative or writes it back to the database.
 */
function buildClientContext(userId) {
  if (!userId) return null;
  try {
    const recent = listInterventions(userId)
      .slice(0, 8)
      .map((record) => record?.moduleId)
      .filter(Boolean);
    if (recent.length === 0) return null;
    return { recent_module_activity: [...new Set(recent)].slice(0, 5) };
  } catch {
    return null;
  }
}

function newStreamingMessageId() {
  return `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Compact execution timeline (Understanding → Checking progress → ... → Complete).
 * Appends a new step unless it's a continuation of the same label (avoids the
 * duplicate entry that would otherwise appear when execution_started and the
 * following state_changed both resolve to the same "Understanding..." label).
 * Never called with anything but real, backend-driven status text.
 */
function withNewStep(prev, label) {
  if (!label) return {};
  const steps = prev.steps || [];
  if (steps.length && steps[steps.length - 1].label === label) return {};
  const advanced = steps.map((s) => (s.status === 'active' ? { ...s, status: 'done' } : s));
  advanced.push({ id: `step-${advanced.length}`, label, status: 'active' });
  return { steps: advanced };
}

function withLastStepStatus(prev, status) {
  const steps = prev.steps || [];
  if (!steps.length) return {};
  return { steps: steps.map((s, i) => (i === steps.length - 1 ? { ...s, status } : s)) };
}

/**
 * Parses one chunk of raw SSE text ("data: {...}\n\n" per event, possibly
 * split across reads) into complete events plus whatever incomplete tail to
 * carry over to the next chunk. Malformed individual events are dropped
 * silently — one bad line must never crash the whole stream.
 */
export function parseSSEChunk(buffer) {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';
  const events = [];
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith('data: ')) continue;
    try {
      events.push(JSON.parse(line.slice('data: '.length)));
    } catch {
      // malformed event — skip safely, do not throw
    }
  }
  return { events, remainder };
}

const useAgentStore = create((set, get) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  conversationId: null,
  error: null,
  pendingConfirmation: null, // { messageIndex, tool_name, tool_args }
  isSignedIn: true,

  // Backend-owned execution state (never inferred from message text).
  executionId: null,
  executionState: 'IDLE',
  currentTool: null,
  isStreaming: false,
  _activeAbortController: null,

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, msg]
  })),

  updateMessage: (id, patchOrFn) => set((state) => ({
    messages: state.messages.map((m) => {
      if (m.id !== id) return m;
      const patch = typeof patchOrFn === 'function' ? patchOrFn(m) : patchOrFn;
      return { ...m, ...patch };
    }),
  })),

  removeMessage: (id) => set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),

  clearError: () => set({ error: null }),

  /** Only one active stream at a time — aborts anything already in flight. */
  abortActiveStream: () => {
    const controller = get()._activeAbortController;
    if (controller) controller.abort();
  },

  _handleAgentEvent: (streamingId, event) => {
    const { updateMessage } = get();

    // Ignore events from a stream that's no longer the active one (e.g. a
    // stale delivery after abort-and-restart) — prevents stale execution state.
    if (event.type !== 'execution_started' && event.execution_id && event.execution_id !== get().executionId) {
      return;
    }

    // Every event carries conversation_id — learn it as soon as a brand-new
    // conversation's id arrives, so the next message continues the same thread
    // instead of starting a new one.
    if (event.conversation_id && !get().conversationId) {
      set({ conversationId: event.conversation_id });
    }

    switch (event.type) {
      case 'execution_started': {
        const label = currentStatusLabel('UNDERSTANDING', null);
        set({ executionId: event.execution_id, executionState: 'UNDERSTANDING', currentTool: null });
        updateMessage(streamingId, (prev) => ({ statusLabel: label, ...withNewStep(prev, label) }));
        break;
      }

      case 'state_changed': {
        const nextTool = event.tool ?? get().currentTool;
        const label = currentStatusLabel(event.state, nextTool);
        set({ executionState: event.state, currentTool: nextTool });
        updateMessage(streamingId, (prev) => ({ statusLabel: label, ...withNewStep(prev, label) }));
        break;
      }

      case 'tool_started': {
        const label = friendlyToolLabel(event.tool);
        set({ currentTool: event.tool });
        updateMessage(streamingId, (prev) => ({ statusLabel: label, ...withNewStep(prev, label) }));
        break;
      }

      case 'tool_completed':
        // Tool name stays visible (as "just finished") until the next state/tool
        // event supersedes it — avoids a flicker back to a generic label.
        updateMessage(streamingId, (prev) => withLastStepStatus(prev, 'done'));
        break;

      case 'assistant_delta':
        // Defensive / forward-compatible only: the current backend does not emit
        // this (Gemini calls aren't in streaming mode). If it ever does, append
        // real text incrementally — never replace, never fabricate a delta.
        if (typeof event.content === 'string' && event.content) {
          updateMessage(streamingId, (prev) => ({ content: (prev.content || '') + event.content, streaming: true }));
        }
        break;

      case 'confirmation_required':
      case 'execution_completed': {
        updateMessage(streamingId, (prev) => ({
          content: event.content,
          action_payload: event.action_payload,
          streaming: false,
          ...withLastStepStatus(prev, 'done'),
        }));
        set({ executionState: event.state || 'COMPLETED', currentTool: null, isStreaming: false });
        if (event.action_payload?.type === 'PENDING_CONFIRMATION') {
          const idx = get().messages.findIndex((m) => m.id === streamingId);
          set({ pendingConfirmation: { messageIndex: idx, ...event.action_payload } });
        }
        break;
      }

      case 'execution_failed':
        // A safely-worded explanation belongs in the assistant bubble itself
        // (e.g. max-steps reached) — not the separate connectivity-error banner.
        updateMessage(streamingId, (prev) => ({
          content: event.content || "I'm having trouble with that right now. Please try again.",
          streaming: false,
          ...withLastStepStatus(prev, 'failed'),
        }));
        set({ executionState: 'FAILED', currentTool: null, isStreaming: false });
        break;

      default:
        break; // unknown event type — ignore safely, never crash the stream
    }
  },

  sendMessage: async (text, user) => {
    const { addMessage, abortActiveStream } = get();
    abortActiveStream(); // only one active stream per conversation

    addMessage({ role: 'user', content: text });
    const streamingId = newStreamingMessageId();
    addMessage({ id: streamingId, role: 'model', content: '', streaming: true, statusLabel: 'Understanding your request...', steps: [], action_payload: null });

    const controller = new AbortController();
    set({
      isLoading: true, error: null, pendingConfirmation: null,
      _activeAbortController: controller, isStreaming: true,
      executionId: null, executionState: 'IDLE', currentTool: null,
    });

    const { conversationId, removeMessage, updateMessage, _handleAgentEvent } = get();

    try {
      const headers = await authHeaders(user);
      if (!headers.Authorization) {
        removeMessage(streamingId);
        set({ isLoading: false, isStreaming: false, isSignedIn: false, error: 'Sign in (or use a Demo Access account) to use the assistant.' });
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/agent/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          client_context: buildClientContext(user?.id),
        }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        removeMessage(streamingId);
        set({ isLoading: false, isStreaming: false, isSignedIn: false, error: 'Your session has expired. Please sign in again.' });
        return;
      }
      if (res.status === 429) {
        removeMessage(streamingId);
        const body = await res.json().catch(() => null);
        set({ isLoading: false, isStreaming: false, error: body?.detail || 'You are sending messages too quickly — please wait a bit.' });
        return;
      }
      if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remainder } = parseSSEChunk(buffer);
        buffer = remainder;
        for (const event of events) {
          _handleAgentEvent(streamingId, event);
        }
      }

      const finalMsg = get().messages.find((m) => m.id === streamingId);
      if (finalMsg?.streaming) {
        // Stream ended without a terminal event (shouldn't normally happen) — don't
        // leave a permanently "in progress" bubble.
        updateMessage(streamingId, { streaming: false, content: finalMsg.content || 'Done.' });
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        return; // intentional cancellation — not a user-facing error
      }
      console.error(err);
      set({ error: "Sorry, I'm having trouble connecting to the server. Please try again." });
      updateMessage(streamingId, {
        content: "Sorry, I'm having trouble connecting to the server. Please try again.",
        streaming: false,
      });
    } finally {
      set((state) => (
        state._activeAbortController === controller
          ? { isLoading: false, isStreaming: false, _activeAbortController: null }
          : {}
      ));
    }
  },

  confirmPendingAction: async (user) => {
    const { pendingConfirmation, conversationId, addMessage } = get();
    if (!pendingConfirmation || !conversationId) return;

    set({ isLoading: true, error: null });
    try {
      const headers = await authHeaders(user);
      const res = await fetch(`${API_BASE_URL}/api/agent/tool/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          conversation_id: conversationId,
          tool_name: pendingConfirmation.tool_name,
          tool_args: pendingConfirmation.tool_args,
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();

      addMessage({ role: 'model', content: data.message, action_payload: null });
      set({ pendingConfirmation: null });
    } catch (err) {
      console.error(err);
      set({ error: "Couldn't complete that action. Please try again." });
    } finally {
      set({ isLoading: false });
    }
  },

  cancelPendingAction: () => {
    const { addMessage } = get();
    addMessage({ role: 'model', content: 'No problem, I left that as-is.', action_payload: null });
    set({ pendingConfirmation: null });
  },

  loadHistory: async (convId, user) => {
    try {
      const headers = await authHeaders(user);
      const res = await fetch(`${API_BASE_URL}/api/agent/conversations/${convId}`, { headers });
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      set({
        messages: data.messages,
        conversationId: convId,
      });
    } catch (err) {
      console.error(err);
    }
  }
}));

export default useAgentStore;
