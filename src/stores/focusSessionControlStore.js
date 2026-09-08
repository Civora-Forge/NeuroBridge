import { create } from 'zustand';

/**
 * A tiny command bus, not a second timer. The agent never ticks its own
 * countdown here — it posts an intent (start/pause/resume/stop/set_duration),
 * and FocusSessions.jsx (the one real, visible timer) is the only thing that
 * ever acts on it, through its own existing handlers (startSession,
 * togglePause, resetToSetup) — the exact same functions a manual click
 * would call, so existing analytics/lifecycle tracking fires identically.
 */
const useFocusSessionControlStore = create((set) => ({
  pendingCommand: null,
  dispatch: (command) => set({ pendingCommand: { ...command, _dispatchedAt: Date.now() } }),
  consume: () => set({ pendingCommand: null }),
}));

export default useFocusSessionControlStore;
