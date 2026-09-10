import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

// These are unimplemented-backend stubs (no real endpoint exists yet). They
// must never log `payload` itself — several callers pass free-text reading/
// writing samples and phoneme data, which would otherwise land in the
// browser console (and any console-capturing devtools extension or future
// crash reporter) even though nothing here actually persists it.

export const createReadingSession = async (_payload) => {
  console.log("Mock createReadingSession called");
  return { id: "mock-session-id" };
};

export const getReadingInsights = async (_userId) => {
  console.log("Mock getReadingInsights called");
  return { speed: 120, accuracy: 95 };
};

export const logPhonologyErrors = async (payload) => {
  if (isSupabaseConfigured && payload?.userId && payload?.phoneme) {
    const { error } = await supabase.from("phoneme_errors").upsert({
      user_id: payload.userId,
      phoneme: payload.phoneme,
      error_count: 1, // Basic increment would be better, but this is a stub
    });
    if (error) console.warn("Failed to log phoneme error", error.message);
  }
  return { success: true };
};

export const generatePhonologyDrills = async (_payload) => {
  console.log("Mock generatePhonologyDrills called");
  return {
    drills: [
      { id: 1, word: "cat", phoneme: "a" },
      { id: 2, word: "dog", phoneme: "o" },
    ],
  };
};

export const trackReinforcementEvent = async (_payload) => {
  console.log("Mock trackReinforcementEvent called");
  return { success: true };
};

export const analyzeWriting = async (_payload) => {
  console.log("Mock analyzeWriting called");
  return { stability: 85, suggestions: [] };
};

export const getLearningProfile = async (_userId) => {
  console.log("Mock getLearningProfile called");
  return { dominantWeakness: "None" };
};

export const getAnalyticsStreamUrl = (userId) => {
  // This is no longer used for SSE, just return null
  return null;
};
