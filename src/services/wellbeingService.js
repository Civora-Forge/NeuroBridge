/**
 * wellbeingService.js — Centralized Wellbeing Interaction Mechanism
 *
 * Connects NeuroBridge features (support toolkit, ADHD focus, OCD exposure,
 * dyslexia reader, emotion check-ins, context engine recommendations) to the
 * Adaptive Wellbeing Garden.
 *
 * Product Principle:
 * Represents "care invested in yourself", NOT "time spent inside NeuroBridge".
 *
 * Integration Architecture:
 *   [Context Engine / Features]
 *             ↓
 *   recordWellbeingInteraction({ userId, interactionType, source, metadata })
 *             ↓
 *   [Garden Store & State Manager] (evaluates daily growth rules & adaptive messaging)
 *             ↓
 *   [Tree Visualization & UI]
 */

import { contextEventBus } from "@/adaptive/context/events/contextEventBus.js";
import { logGardenEngagement, getGardenState, ENCOURAGING_MESSAGES } from "@/stores/gardenStore.js";

export const WELLBEING_INTERACTION_TYPES = {
  SUPPORT_MODULE_COMPLETED: "support_module_completed",
  FOCUS_SESSION_COMPLETED: "focus_session_completed",
  EXPOSURE_SESSION_COMPLETED: "exposure_session_completed",
  MOOD_CHECKIN_COMPLETED: "mood_checkin_completed",
  ADAPTIVE_RECOMMENDATION_COMPLETED: "adaptive_recommendation_completed",
  READING_SESSION_COMPLETED: "reading_session_completed",
  MOTOR_PRACTICE_COMPLETED: "motor_practice_completed",
  SELF_CARE_ACTION: "self_care_action",
};

/**
 * Get active user ID safely.
 */
function getActiveUserId() {
  try {
    const raw = localStorage.getItem("nb_auth");
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.id) return user.id;
    }
  } catch {
    // Fallback
  }
  return "default";
}

/**
 * Generate supportive, non-diagnostic, non-judgmental messaging.
 * Avoids any diagnostic language or pressure.
 */
export function generateAdaptiveMessage({ isFirstInteractionToday, lastEngagementDate, interactionType, source }) {
  if (source === "context_engine" || interactionType === WELLBEING_INTERACTION_TYPES.ADAPTIVE_RECOMMENDATION_COMPLETED) {
    return "Thank you for listening to your needs today.";
  }

  if (interactionType === WELLBEING_INTERACTION_TYPES.MOOD_CHECKIN_COMPLETED) {
    return "Naming how you feel is a brave step of self-care.";
  }

  if (interactionType === WELLBEING_INTERACTION_TYPES.FOCUS_SESSION_COMPLETED) {
    return "Focus is about gentle intention, step by step.";
  }

  if (lastEngagementDate) {
    const today = new Date();
    const last = new Date(lastEngagementDate);
    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 3600 * 24));

    if (diffDays >= 3) {
      return "Welcome back. Your garden is still here.";
    }
  }

  if (!isFirstInteractionToday) {
    return "You've nurtured your garden today. Every care you give yourself matters.";
  }

  return "Your garden is growing with you.";
}

/**
 * Record a meaningful wellbeing interaction across NeuroBridge.
 *
 * @param {object} params
 * @param {string} [params.userId]
 * @param {string} params.interactionType - From WELLBEING_INTERACTION_TYPES
 * @param {string} [params.source="unknown"] - Source feature/module ID
 * @param {object} [params.metadata={}] - Additional details (e.g. duration, title, planId)
 * @returns {object} Interaction result summary
 */
export function recordWellbeingInteraction({
  userId,
  interactionType = WELLBEING_INTERACTION_TYPES.SELF_CARE_ACTION,
  source = "unknown",
  metadata = {},
} = {}) {
  const resolvedUserId = userId || getActiveUserId();
  const currentGarden = getGardenState(resolvedUserId);
  const todayStr = new Date().toISOString().split("T")[0];

  const isFirstInteractionToday = currentGarden.lastEngagementDate !== todayStr;

  const adaptiveMessage = generateAdaptiveMessage({
    isFirstInteractionToday,
    lastEngagementDate: currentGarden.lastEngagementDate,
    interactionType,
    source,
  });

  // Delegate growth update to gardenStore (enforces 1 day growth per calendar day rule)
  const updatedGarden = logGardenEngagement(resolvedUserId, {
    customMessage: adaptiveMessage,
  });

  const interactionLogEntry = {
    id: `wb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: resolvedUserId,
    interactionType,
    source,
    metadata,
    timestamp: new Date().toISOString(),
    contributedToGrowth: isFirstInteractionToday,
  };

  try {
    contextEventBus.emit("WELLBEING_INTERACTION_RECORDED", {
      interaction: interactionLogEntry,
      gardenState: updatedGarden,
    });
  } catch {
    // Bus safe fallback
  }

  // Persist interaction event asynchronously to Supabase
  persistWellbeingInteractionAsync(interactionLogEntry).catch(() => {});

  return {
    success: true,
    interaction: interactionLogEntry,
    gardenState: updatedGarden,
    contributedToGrowth: isFirstInteractionToday,
  };
}

/**
 * Persist interaction audit record to Supabase if configured.
 * @param {object} interaction
 */
export async function persistWellbeingInteractionAsync(interaction) {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient.js");
    if (!isSupabaseConfigured || !interaction.userId || interaction.userId === "default") {
      return;
    }

    const payload = {
      id: interaction.id,
      user_id: interaction.userId,
      interaction_type: interaction.interactionType,
      source: interaction.source,
      contributed_to_growth: interaction.contributedToGrowth,
      metadata: interaction.metadata || {},
      created_at: interaction.timestamp || new Date().toISOString(),
    };

    const { error } = await supabase.from("wellbeing_interactions").insert(payload);
    if (error) {
      console.warn("[WellbeingService] Supabase insert interaction error:", error);
    }
  } catch (err) {
    console.warn("[WellbeingService] Supabase offline in persistWellbeingInteractionAsync:", err);
  }
}
