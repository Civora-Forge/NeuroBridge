/**
 * gardenStore.js — Reusable state model for Adaptive Wellbeing Garden
 *
 * Growth Mechanics:
 * - Day 1–6: Tree gradually develops 1 to 6 leaves.
 * - Every 7 days of meaningful engagement: Adds a new flower.
 * - 30-Day Cycle: Completes current season tree, archives it to personal history,
 *   and starts a new tree for Season N+1.
 * - Non-punitive design: Missing days NEVER reset the tree. The tree stays at its
 *   current growth stage until the user returns.
 * - Never displays negative messaging ("streak lost").
 * - Fully persistent via Supabase with offline/mock localStorage fallback.
 */

import { contextEventBus } from "@/adaptive/context/events/contextEventBus.js";
import { ContextEvents } from "@/adaptive/context/events/contextEvents.js";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient.js";

const GARDEN_STORAGE_PREFIX = "nb_garden_state_";

/** Encouraging calming messages */
export const ENCOURAGING_MESSAGES = [
  "You don't have to be perfect. You can keep growing.",
  "Every small step nourishes your well-being.",
  "Your garden waits patiently for you—growth happens at your pace.",
  "Rooted in grace, reaching toward tomorrow.",
  "Consistency is resting when you need to and returning when you're ready.",
  "Just like nature, your journey unfolds in its own season.",
];

/**
 * Returns initial default state for a fresh garden season.
 * @param {number} season
 * @returns {object}
 */
export function getDefaultGardenState(season = 1) {
  return {
    season,
    currentDayInSeason: 1, // 1 to 30
    totalEngagementDays: 1,
    leaves: 1, // 1 to 6 within leaf cycle
    flowers: 0, // +1 flower every 7 days
    lastEngagementDate: null,
    history: [], // Completed tree seasons
    encouragingMessage: ENCOURAGING_MESSAGES[0],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate growth parameters from day in season & total engagement.
 * @param {number} dayInSeason (1 to 30)
 * @param {number} totalDays
 */
export function calculateTreeMetrics(dayInSeason, totalDays) {
  // Days 1-6 cycle gives leaves (1..6)
  const leafCycleDay = ((dayInSeason - 1) % 6) + 1;
  const leaves = Math.min(6, leafCycleDay);

  // Every 7 days of engagement adds 1 flower
  const flowers = Math.floor(totalDays / 7);

  return { leaves, flowers };
}

/**
 * Determine growth stage title based on current day and flowers.
 * @param {number} dayInSeason
 * @param {number} flowers
 */
export function getGrowthStageTitle(dayInSeason, flowers) {
  if (dayInSeason >= 30) return "Mature Season Harvest";
  if (flowers >= 4) return "Full Bloom Sanctuary";
  if (flowers >= 2) return "Flowering Canopy";
  if (dayInSeason >= 14) return "Flourishing Growth";
  if (dayInSeason >= 7) return "Budding Branches";
  if (dayInSeason >= 3) return "Developing Sapling";
  return "Fresh Sprout";
}

/**
 * Read garden state for a user synchronously from localStorage or default.
 * @param {string} userId
 */
export function getGardenState(userId = "default") {
  const key = `${GARDEN_STORAGE_PREFIX}${userId || "default"}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return getDefaultGardenState(1);
    const parsed = JSON.parse(raw);
    
    // Recalculate leaves & flowers for consistency
    const metrics = calculateTreeMetrics(parsed.currentDayInSeason || 1, parsed.totalEngagementDays || 1);
    return {
      ...getDefaultGardenState(parsed.season || 1),
      ...parsed,
      leaves: metrics.leaves,
      flowers: metrics.flowers,
    };
  } catch (err) {
    console.error("[GardenStore] Error reading state:", err);
    return getDefaultGardenState(1);
  }
}

/**
 * Fetch garden state asynchronously from Supabase (with fallback).
 * @param {string} userId
 */
export async function fetchGardenStateAsync(userId = "default") {
  const local = getGardenState(userId);
  if (!isSupabaseConfigured || !userId || userId === "default") {
    return local;
  }

  try {
    const { data: remoteGarden, error: gardenErr } = await supabase
      .from("wellbeing_gardens")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (gardenErr && gardenErr.code !== "PGRST116") {
      console.warn("[GardenStore] Supabase fetch garden error:", gardenErr);
    }

    const { data: remoteHistory, error: historyErr } = await supabase
      .from("wellbeing_garden_history")
      .select("*")
      .eq("user_id", userId)
      .order("season", { ascending: false });

    if (historyErr) {
      console.warn("[GardenStore] Supabase fetch history error:", historyErr);
    }

    const history = Array.isArray(remoteHistory) && remoteHistory.length > 0
      ? remoteHistory.map((item) => ({
          season: item.season,
          completedAt: item.completed_at,
          totalEngagementDays: item.total_engagement_days,
          totalLeaves: item.total_leaves,
          totalFlowers: item.total_flowers,
          stageTitle: item.stage_title,
          summary: item.summary,
        }))
      : local.history || [];

    if (!remoteGarden) {
      // First time user on Supabase: insert initial record
      await saveGardenStateAsync(userId, local);
      return { ...local, history };
    }

    const metrics = calculateTreeMetrics(remoteGarden.current_day_in_season || 1, remoteGarden.total_engagement_days || 1);
    const merged = {
      season: remoteGarden.season || 1,
      currentDayInSeason: remoteGarden.current_day_in_season || 1,
      totalEngagementDays: remoteGarden.total_engagement_days || 1,
      leaves: metrics.leaves,
      flowers: metrics.flowers,
      lastEngagementDate: remoteGarden.last_engagement_date || null,
      encouragingMessage: remoteGarden.encouraging_message || ENCOURAGING_MESSAGES[0],
      history,
      updatedAt: remoteGarden.updated_at || new Date().toISOString(),
    };

    saveGardenState(userId, merged);
    return merged;
  } catch (err) {
    console.warn("[GardenStore] Offline/Supabase error in fetchGardenStateAsync:", err);
    return local;
  }
}

/**
 * Save garden state synchronously to localStorage and asynchronously to Supabase.
 * @param {string} userId
 * @param {object} state
 */
export function saveGardenState(userId = "default", state) {
  const key = `${GARDEN_STORAGE_PREFIX}${userId || "default"}`;
  const toSave = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(toSave));
  } catch (err) {
    console.error("[GardenStore] Error saving state locally:", err);
  }

  // Trigger async Supabase sync in background
  saveGardenStateAsync(userId, toSave).catch(() => {});

  return toSave;
}

/**
 * Persist garden state asynchronously to Supabase.
 * @param {string} userId
 * @param {object} state
 */
export async function saveGardenStateAsync(userId = "default", state) {
  if (!isSupabaseConfigured || !userId || userId === "default") {
    return state;
  }

  try {
    const payload = {
      id: `g_${userId}`,
      user_id: userId,
      season: state.season,
      current_day_in_season: state.currentDayInSeason,
      total_engagement_days: state.totalEngagementDays,
      leaves: state.leaves,
      flowers: state.flowers,
      last_engagement_date: state.lastEngagementDate,
      encouraging_message: state.encouragingMessage,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("wellbeing_gardens")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      console.warn("[GardenStore] Supabase save garden error:", error);
    }
  } catch (err) {
    console.warn("[GardenStore] Supabase network failure in saveGardenStateAsync:", err);
  }

  return state;
}

/**
 * Archive a completed season to Supabase history table.
 * @param {string} userId
 * @param {object} historyItem
 */
export async function archiveGardenSeasonAsync(userId = "default", historyItem) {
  if (!isSupabaseConfigured || !userId || userId === "default") {
    return;
  }

  try {
    const payload = {
      id: `gh_${userId}_s${historyItem.season}_${Date.now()}`,
      user_id: userId,
      season: historyItem.season,
      completed_at: historyItem.completedAt || new Date().toISOString(),
      total_engagement_days: historyItem.totalEngagementDays,
      total_leaves: historyItem.totalLeaves || 6,
      total_flowers: historyItem.totalFlowers || 0,
      stage_title: historyItem.stageTitle || "Mature Tree",
      summary: historyItem.summary || "",
    };

    const { error } = await supabase
      .from("wellbeing_garden_history")
      .insert(payload);

    if (error) {
      console.warn("[GardenStore] Supabase archive season error:", error);
    }
  } catch (err) {
    console.warn("[GardenStore] Supabase failure in archiveGardenSeasonAsync:", err);
  }
}

/**
 * Record a day of meaningful engagement for the user.
 * missing days are IGNORED—growth simply resumes from current day!
 *
 * @param {string} userId
 * @param {{ forceNextDay?: boolean, customMessage?: string }} options
 */
export function logGardenEngagement(userId = "default", options = {}) {
  const current = getGardenState(userId);
  const todayStr = new Date().toISOString().split("T")[0];

  // Idempotency check: If already engaged today and not forced, return current state
  if (current.lastEngagementDate === todayStr && !options.forceNextDay) {
    return current;
  }

  const isInitial = current.lastEngagementDate === null;
  let nextDayInSeason = isInitial && !options.forceNextDay ? current.currentDayInSeason : current.currentDayInSeason + (options.forceNextDay || !isInitial ? 1 : 0);
  let nextTotalEngagement = isInitial && !options.forceNextDay ? current.totalEngagementDays : current.totalEngagementDays + (options.forceNextDay || !isInitial ? 1 : 0);
  let nextSeason = current.season;
  let updatedHistory = [...(current.history || [])];

  const messageIndex = (current.totalEngagementDays + 1) % ENCOURAGING_MESSAGES.length;
  const newEncouragement = options.customMessage || ENCOURAGING_MESSAGES[messageIndex];

  // Check if 30-day season cycle completed!
  if (current.currentDayInSeason >= 30 && (options.forceNextDay || current.lastEngagementDate !== todayStr)) {
    const completedSeasonArchive = {
      season: current.season,
      completedAt: new Date().toISOString(),
      totalEngagementDays: current.totalEngagementDays,
      totalLeaves: 6,
      totalFlowers: current.flowers,
      stageTitle: getGrowthStageTitle(30, current.flowers),
      summary: `Completed Season ${current.season} with ${current.flowers} blossoms and 30 days of growth.`,
    };

    // Idempotent history check (prevent duplicate season entries)
    if (!updatedHistory.some((h) => h.season === current.season)) {
      updatedHistory.unshift(completedSeasonArchive);
      archiveGardenSeasonAsync(userId, completedSeasonArchive).catch(() => {});
    }

    nextSeason = current.season + 1;
    nextDayInSeason = 1; // Start day 1 of new tree
  }

  const { leaves, flowers } = calculateTreeMetrics(nextDayInSeason, nextTotalEngagement);

  const updatedState = {
    ...current,
    season: nextSeason,
    currentDayInSeason: nextDayInSeason,
    totalEngagementDays: nextTotalEngagement,
    leaves,
    flowers,
    lastEngagementDate: todayStr,
    history: updatedHistory,
    encouragingMessage: newEncouragement,
  };

  saveGardenState(userId, updatedState);

  contextEventBus.emit("GARDEN_UPDATED", {
    userId,
    gardenState: updatedState,
    timestamp: new Date().toISOString(),
  });

  return updatedState;
}

/**
 * Developer / Demo helper to advance day by 1 or N days.
 * @param {string} userId
 * @param {number} daysToAdvance
 */
export function advanceGardenDays(userId = "default", daysToAdvance = 1) {
  let state = getGardenState(userId);
  for (let i = 0; i < daysToAdvance; i++) {
    state = logGardenEngagement(userId, { forceNextDay: true });
  }
  return state;
}

/**
 * Reset garden state to Season 1, Day 1 for testing.
 * @param {string} userId
 */
export function resetGardenState(userId = "default") {
  const fresh = getDefaultGardenState(1);
  saveGardenState(userId, fresh);
  return fresh;
}
