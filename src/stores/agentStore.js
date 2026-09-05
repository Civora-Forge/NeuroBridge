import { create } from 'zustand';
import { supabase } from '@/lib/supabaseClient';
import { listInterventions } from '@/support/persistence/role4Store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

async function authHeaders() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
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

const useAgentStore = create((set, get) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  conversationId: null,
  error: null,
  pendingConfirmation: null, // { messageIndex, tool_name, tool_args }
  isSignedIn: true,

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, msg]
  })),

  clearError: () => set({ error: null }),

  sendMessage: async (text, userId) => {
    const { conversationId, addMessage } = get();

    addMessage({ role: 'user', content: text });
    set({ isLoading: true, error: null, pendingConfirmation: null });

    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        set({
          isLoading: false,
          isSignedIn: false,
          error: 'Sign in with your NeuroBridge account to use the assistant.',
        });
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          client_context: buildClientContext(userId),
        }),
      });

      if (res.status === 401) {
        set({ isLoading: false, isSignedIn: false, error: 'Your session has expired. Please sign in again.' });
        return;
      }
      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      const data = await res.json();

      if (!conversationId && data.conversation_id) {
        set({ conversationId: data.conversation_id });
      }

      const action = data.action_payload;
      addMessage({
        role: 'model',
        content: data.content,
        action_payload: action,
      });

      if (action?.type === 'PENDING_CONFIRMATION') {
        set((state) => ({ pendingConfirmation: { messageIndex: state.messages.length - 1, ...action } }));
      }
    } catch (err) {
      console.error(err);
      set({ error: "Sorry, I'm having trouble connecting to the server. Please try again." });
      addMessage({
        role: 'model',
        content: "Sorry, I'm having trouble connecting to the server. Please try again.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  confirmPendingAction: async () => {
    const { pendingConfirmation, conversationId, addMessage } = get();
    if (!pendingConfirmation || !conversationId) return;

    set({ isLoading: true, error: null });
    try {
      const headers = await authHeaders();
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

  loadHistory: async (convId) => {
    try {
      const headers = await authHeaders();
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
