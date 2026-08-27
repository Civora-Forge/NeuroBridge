import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export const createReadingSession = async (payload) => {
  console.log("Mock createReadingSession", payload);
  return { id: "mock-session-id" };
};

export const getReadingInsights = async (userId) => {
  console.log("Mock getReadingInsights", userId);
  return { speed: 120, accuracy: 95 };
};

export const logPhonologyErrors = async (payload) => {
  if (isSupabaseConfigured && payload?.userId && payload?.phoneme) {
    const { error } = await supabase.from("phoneme_errors").upsert({
      user_id: payload.userId,
      phoneme: payload.phoneme,
      error_count: 1, // Basic increment would be better, but this is a stub
    });
    if (error) console.warn("Failed to log phoneme error", error);
  }
  return { success: true };
};

export const generatePhonologyDrills = async (payload) => {
  console.log("Mock generatePhonologyDrills", payload);
  return {
    drills: [
      { id: 1, word: "cat", phoneme: "a" },
      { id: 2, word: "dog", phoneme: "o" },
    ],
  };
};

export const trackReinforcementEvent = async (payload) => {
  console.log("Mock trackReinforcementEvent", payload);
  return { success: true };
};

export const analyzeWriting = async (payload) => {
  console.log("Mock analyzeWriting", payload);
  return { stability: 85, suggestions: [] };
};

export const getLearningProfile = async (userId) => {
  console.log("Mock getLearningProfile", userId);
  return { dominantWeakness: "None" };
};

export const getAnalyticsStreamUrl = (userId) => {
  // This is no longer used for SSE, just return null
  return null;
};
