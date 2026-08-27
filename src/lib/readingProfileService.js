/**
 * readingProfileService.js
 * 
 * Manages persistent reading preferences for the Dyslexia module.
 * Supabase is the source of truth; localStorage is a performance cache.
 * 
 * Uses the existing `reader_preferences` table (remote schema).
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const LOCAL_KEY = "neurobridge-reading-prefs-v3";
const DEBOUNCE_MS = 1500;

let saveTimer = null;

/** Default preferences — matches AdaptiveReadingModule.jsx DEFAULT_PREFS */
export const DEFAULT_READING_PREFS = {
  fontFamily: '"OpenDyslexic", "Lexend", "Atkinson Hyperlegible", sans-serif',
  fontSize: 24,
  lineHeight: 1.85,
  letterSpacing: 0.02,
  wordSpacing: 0.1,
  backgroundColor: "#FAF3A0",
  textColor: "#1E2022",
  darkMode: false,
  highContrast: false,
  readingRuler: true,
  focusMode: true,
};

// ─── Local Cache ─────────────────────────────────────────────────────────────

function getCachedPrefs() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedPrefs(prefs) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
  } catch {}
}

// ─── Supabase Mapping ─────────────────────────────────────────────────────────

function prefsToRow(userId, prefs) {
  return {
    user_id: userId,
    font: prefs.fontFamily ?? DEFAULT_READING_PREFS.fontFamily,
    font_size: prefs.fontSize ?? DEFAULT_READING_PREFS.fontSize,
    line_spacing: prefs.lineHeight ?? DEFAULT_READING_PREFS.lineHeight,
    letter_spacing: prefs.letterSpacing ?? DEFAULT_READING_PREFS.letterSpacing,
    word_spacing: prefs.wordSpacing ?? DEFAULT_READING_PREFS.wordSpacing,
    theme: prefs.backgroundColor ?? DEFAULT_READING_PREFS.backgroundColor,
    background_color: prefs.backgroundColor ?? DEFAULT_READING_PREFS.backgroundColor,
    text_color: prefs.textColor ?? DEFAULT_READING_PREFS.textColor,
    dark_mode: prefs.darkMode ?? DEFAULT_READING_PREFS.darkMode,
    high_contrast: prefs.highContrast ?? DEFAULT_READING_PREFS.highContrast,
    focus_mode: prefs.focusMode ?? DEFAULT_READING_PREFS.focusMode,
    reading_ruler: prefs.readingRuler ?? DEFAULT_READING_PREFS.readingRuler,
    updated_at: new Date().toISOString(),
  };
}

function rowToPrefs(row) {
  return {
    fontFamily: row.font ?? DEFAULT_READING_PREFS.fontFamily,
    fontSize: Number(row.font_size) || DEFAULT_READING_PREFS.fontSize,
    lineHeight: Number(row.line_spacing) || DEFAULT_READING_PREFS.lineHeight,
    letterSpacing: Number(row.letter_spacing) || DEFAULT_READING_PREFS.letterSpacing,
    wordSpacing: Number(row.word_spacing) || DEFAULT_READING_PREFS.wordSpacing,
    backgroundColor:
      row.background_color || row.theme || DEFAULT_READING_PREFS.backgroundColor,
    textColor: row.text_color || DEFAULT_READING_PREFS.textColor,
    darkMode: Boolean(row.dark_mode),
    highContrast: Boolean(row.high_contrast),
    focusMode: Boolean(row.focus_mode),
    readingRuler: Boolean(row.reading_ruler),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Load reading preferences.
 * Checks Supabase first (if authenticated), falls back to localStorage, then defaults.
 */
export async function loadReadingProfile(user) {
  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;

  // Try Supabase
  if (isSupabaseUser) {
    try {
      const { data, error } = await supabase
        .from("reader_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        const prefs = rowToPrefs(data);
        setCachedPrefs(prefs);
        return prefs;
      }
    } catch (err) {
      console.warn("[readingProfileService] Supabase load failed:", err);
    }
  }

  // Fall back to localStorage
  const cached = getCachedPrefs();
  if (cached) return { ...DEFAULT_READING_PREFS, ...cached };

  return { ...DEFAULT_READING_PREFS };
}

/**
 * Save reading preferences.
 * Immediately updates localStorage; debounced upsert to Supabase.
 */
export function saveReadingProfile(user, prefs) {
  setCachedPrefs(prefs);

  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;
  if (!isSupabaseUser) return;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const row = prefsToRow(user.id, prefs);
      const { error } = await supabase
        .from("reader_preferences")
        .upsert(row, { onConflict: "user_id" });
      if (error) {
        console.warn("[readingProfileService] Supabase save failed:", error.message);
      }
    } catch (err) {
      console.warn("[readingProfileService] Supabase save exception:", err);
    }
  }, DEBOUNCE_MS);
}

/**
 * Log a reading difficulty/interaction event.
 * Non-blocking — fires and forgets with error suppression.
 */
export async function logReadingInteraction(user, interactionType, targetText, metadata = {}) {
  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;
  if (!isSupabaseUser) return;

  try {
    await supabase.from("reading_difficulty_interactions").insert({
      user_id: user.id,
      interaction_type: interactionType,
      target_text: targetText || null,
      metadata,
    });
  } catch {
    // Non-critical — swallow silently
  }
}

/**
 * Save a completed reading session.
 */
export async function saveReadingSession(user, sessionData) {
  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;
  if (!isSupabaseUser) return null;

  try {
    const { data, error } = await supabase
      .from("reading_sessions")
      .insert({
        user_id: user.id,
        file_id: sessionData.fileId || null,
        original_text: sessionData.originalText
          ? sessionData.originalText.slice(0, 2000)
          : null,
        wpm: sessionData.wpm || 0,
        reading_comfort_score: sessionData.comfortScore || 0,
        duration_seconds: sessionData.durationSeconds || 0,
        tts_used: Boolean(sessionData.ttsUsed),
        simplification_used: Boolean(sessionData.simplificationUsed),
        difficulty_interactions: sessionData.difficultyInteractions || 0,
        word_count: sessionData.wordCount || 0,
        start_position: sessionData.startPosition || 0,
        end_position: sessionData.endPosition || 0,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[readingProfileService] Session save failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn("[readingProfileService] Session save exception:", err);
    return null;
  }
}

/**
 * Derive personalized recommendations from reading history.
 * Returns array of recommendation objects.
 */
export async function deriveRecommendations(user) {
  const isSupabaseUser = isSupabaseConfigured && user?._supabase && user?.id;
  if (!isSupabaseUser) return [];

  const recommendations = [];

  try {
    // Get recent sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from("reading_sessions")
      .select("wpm, reading_comfort_score, tts_used, simplification_used, difficulty_interactions, duration_seconds")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (sessionsError || !sessions?.length) return [];

    const avgWpm = sessions.reduce((s, r) => s + Number(r.wpm), 0) / sessions.length;
    const avgComfort = sessions.reduce((s, r) => s + Number(r.reading_comfort_score), 0) / sessions.length;
    const ttsUsageCount = sessions.filter((r) => r.tts_used).length;
    const simplificationUsed = sessions.filter((r) => r.simplification_used).length;
    const highDifficultyCount = sessions.filter((r) => r.difficulty_interactions > 2).length;
    const avgDuration = sessions.reduce((s, r) => s + Number(r.duration_seconds), 0) / sessions.length;

    // Get interaction patterns
    const { data: interactions } = await supabase
      .from("reading_difficulty_interactions")
      .select("interaction_type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const interactionCounts = {};
    (interactions || []).forEach((i) => {
      interactionCounts[i.interaction_type] = (interactionCounts[i.interaction_type] || 0) + 1;
    });

    // Generate recommendations
    if (avgWpm < 100 || avgComfort < 50) {
      recommendations.push({
        id: "increase_font_size",
        type: "settings",
        title: "Increase Font Size",
        description:
          "Your recent reading speed suggests a larger font may help. Try 26–30px for more comfortable reading.",
        settingKey: "fontSize",
        settingValue: 28,
        priority: "high",
        reason: `Average reading comfort: ${Math.round(avgComfort)}%`,
      });
    }

    if (avgWpm < 120 || avgComfort < 60) {
      recommendations.push({
        id: "increase_line_spacing",
        type: "settings",
        title: "Increase Line Spacing",
        description: "More space between lines reduces visual crowding and helps track text.",
        settingKey: "lineHeight",
        settingValue: 2.1,
        priority: "medium",
        reason: `Reading comfort below average`,
      });
    }

    if (ttsUsageCount >= sessions.length * 0.6) {
      recommendations.push({
        id: "enable_tts_highlight",
        type: "info",
        title: "You Often Use Read-Aloud",
        description:
          "You use TTS frequently. Make sure Reading Ruler is enabled to follow along more easily.",
        settingKey: "readingRuler",
        settingValue: true,
        priority: "medium",
        reason: `TTS used in ${ttsUsageCount} of ${sessions.length} recent sessions`,
      });
    }

    if (simplificationUsed >= 2 || highDifficultyCount >= 3) {
      recommendations.push({
        id: "enable_simplification_mode",
        type: "info",
        title: "Frequent Difficulty Detected",
        description:
          "You've requested word simplification multiple times. Try enabling Focus Mode to reduce distractions.",
        settingKey: "focusMode",
        settingValue: true,
        priority: "high",
        reason: `Simplification used ${simplificationUsed} times recently`,
      });
    }

    if (interactionCounts.settings_changed > 5) {
      recommendations.push({
        id: "letter_spacing",
        type: "settings",
        title: "Try More Letter Spacing",
        description:
          "You frequently adjust settings. Wider letter spacing (0.06em) is often helpful for dyslexia.",
        settingKey: "letterSpacing",
        settingValue: 0.06,
        priority: "low",
        reason: "You frequently change reading settings",
      });
    }
  } catch (err) {
    console.warn("[readingProfileService] Recommendations error:", err);
  }

  return recommendations.slice(0, 3);
}
