import { create } from 'zustand';

const useOcdStore = create((set) => ({
  // Session State
  activeSession: null,
  startSession: (hierarchyTask) => set({ activeSession: { task: hierarchyTask, startTime: Date.now(), isPaused: false, sudsLogs: [] } }),
  pauseSession: () => set((state) => ({ activeSession: state.activeSession ? { ...state.activeSession, isPaused: true } : null })),
  resumeSession: () => set((state) => ({ activeSession: state.activeSession ? { ...state.activeSession, isPaused: false } : null })),
  endSession: () => set({ activeSession: null }),
  
  // UI State for SUDS Slider
  currentSuds: 50,
  setCurrentSuds: (value) => set({ currentSuds: value }),

  // Add SUDS log during active session
  addSessionSudsLog: (value) => set((state) => ({
    activeSession: state.activeSession ? {
      ...state.activeSession,
      sudsLogs: [...state.activeSession.sudsLogs, { value, time: Date.now() }]
    } : null
  })),
}));

export default useOcdStore;
