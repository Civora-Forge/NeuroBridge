import { create } from 'zustand';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:8000');

const useAgentStore = create((set, get) => ({
  isOpen: false,
  messages: [],
  isLoading: false,
  conversationId: null,

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),

  addMessage: (msg) => set((state) => ({ 
    messages: [...state.messages, msg] 
  })),

  sendMessage: async (text) => {
    const { conversationId, addMessage } = get();
    
    // Add user message to UI immediately
    addMessage({ role: 'user', content: text });
    set({ isLoading: true });

    try {
      const res = await fetch(`${API_BASE_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');

      const data = await res.json();
      
      // If it's the first message, save the conversation ID
      if (!conversationId && data.conversation_id) {
        set({ conversationId: data.conversation_id });
      }

      addMessage({
        role: 'model',
        content: data.content,
        action_payload: data.action_payload,
      });
    } catch (err) {
      console.error(err);
      addMessage({
        role: 'model',
        content: "Sorry, I'm having trouble connecting to the server.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loadHistory: async (convId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/agent/conversations/${convId}`);
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
