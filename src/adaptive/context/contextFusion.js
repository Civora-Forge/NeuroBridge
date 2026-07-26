/**
 * contextFusion.js — Context Fusion Engine
 *
 * Part of the Context & Perception Engine for NeuroBridge V2.
 *
 * SCOPE & BOUNDARY:
 * Answers ONLY: "What do we currently know about the user right now, and how reliable/fresh is that information?"
 * Answers NEVER: "What intervention should we perform?"
 *
 * STRICT NON-GOALS:
 * Does NOT contain intervention ranking, recommendations, adaptation decisions,
 * UI changes, cognitive reasoning, or user-state modeling (owned by Adaptive Intelligence layer).
 *
 * RESPONSIBILITIES:
 * 1. Fuses signals across 6 dimensions: profile, environment, activity, conversation, mood, session.
 * 2. Computes dimensional and aggregate confidence scores.
 * 3. Evaluates freshness index and per-category staleness flags.
 * 4. Merges active conflict reports from signal validation.
 * 5. Detects material context changes for event emission filtering.
 *
 * Ownership: Context & Perception Engineer
 */

import { contextStore } from "./contextStore.js";
import { evaluateSignalFreshness, SIGNAL_TTL_SECONDS } from "./validation/signalValidator.js";

/**
 * Compute the aggregate freshness index (0.0 to 1.0) for a Unified Context snapshot.
 * @param {import("./types/contextTypes.js").UnifiedContextObject} context
 * @returns {number}
 */
export function computeFreshnessIndex(context) {
  if (!context) return 0.0;

  const nowMs = Date.now();
  const categories = ["profile", "activity", "environment", "conversation", "mood", "session"];
  let totalWeight = 0;
  let weightedFreshnessSum = 0;

  categories.forEach((cat) => {
    const data = context[cat] || {};
    const timestamp = data.startedAt || data.currentTime || data.timestamp || context.metadata?.lastUpdated;
    const ttlSeconds = SIGNAL_TTL_SECONDS[cat] || 60;

    const { isStale, ageSeconds } = evaluateSignalFreshness(timestamp, 1.0, ttlSeconds);
    const catFreshness = Math.max(0.0, 1.0 - ageSeconds / (ttlSeconds * 2));

    // Dynamic category weights (mood & activity weighted higher for temporal freshness)
    const weight = cat === "mood" || cat === "activity" ? 2.0 : 1.0;

    totalWeight += weight;
    weightedFreshnessSum += catFreshness * weight;
  });

  const freshnessIndex = totalWeight > 0 ? weightedFreshnessSum / totalWeight : 1.0;
  return +freshnessIndex.toFixed(2);
}

/**
 * Detect material context changes between previous and current Unified Context Object snapshots.
 *
 * @param {import("./types/contextTypes.js").UnifiedContextObject} prevContext
 * @param {import("./types/contextTypes.js").UnifiedContextObject} newContext
 * @returns {{ isMaterialChange: boolean, materialChanges: string[] }}
 */
export function detectMaterialChange(prevContext, newContext) {
  if (!prevContext || !newContext) {
    return { isMaterialChange: true, materialChanges: ["initial_snapshot"] };
  }

  const materialChanges = [];

  // Check 1: Activity change
  if (prevContext.activity?.activity !== newContext.activity?.activity) {
    materialChanges.push(`activity_changed:${prevContext.activity?.activity}->${newContext.activity?.activity}`);
  }

  // Check 2: Mood change
  if (prevContext.mood?.primaryMood !== newContext.mood?.primaryMood) {
    materialChanges.push(`mood_changed:${prevContext.mood?.primaryMood}->${newContext.mood?.primaryMood}`);
  }

  // Check 3: Urgency change
  if (prevContext.conversation?.urgency !== newContext.conversation?.urgency) {
    materialChanges.push(`urgency_changed:${prevContext.conversation?.urgency}->${newContext.conversation?.urgency}`);
  }

  // Check 4: Online status change
  if (prevContext.environment?.isOnline !== newContext.environment?.isOnline) {
    materialChanges.push(`connectivity_changed:${prevContext.environment?.isOnline}->${newContext.environment?.isOnline}`);
  }

  // Check 5: Significant confidence shift (>0.25)
  const prevConf = prevContext.metadata?.dimensionalConfidence?.mood || 0.5;
  const newConf = newContext.metadata?.dimensionalConfidence?.mood || 0.5;
  if (Math.abs(prevConf - newConf) >= 0.25) {
    materialChanges.push(`confidence_shift:${prevConf}->${newConf}`);
  }

  return {
    isMaterialChange: materialChanges.length > 0,
    materialChanges,
  };
}

/**
 * Fuse heterogeneous signals from all 6 categories into a single Unified Context Object snapshot.
 *
 * @param {object} [signals] - Optional signals to ingest before fusion
 * @param {object} [options]
 * @param {Array<object>} [options.conflicts] - Active conflict reports to append to snapshot metadata
 * @returns {import("./types/contextTypes.js").UnifiedContextObject} Fused Unified Context Snapshot
 */
export function fuseContext(signals = {}, options = {}) {
  // 1. Ingest provided signals into contextStore cleanly
  if (signals.activity) contextStore.updateContext("activity", signals.activity, "contextFusion");
  if (signals.environment) contextStore.updateContext("environment", signals.environment, "contextFusion");
  if (signals.conversation) contextStore.updateContext("conversation", signals.conversation, "contextFusion");
  if (signals.mood) contextStore.updateContext("mood", signals.mood, "contextFusion");
  if (signals.session) contextStore.updateContext("session", signals.session, "contextFusion");
  if (signals.profile) contextStore.updateContext("profile", signals.profile, "contextFusion");

  // 2. Fetch raw snapshot
  const rawSnapshot = contextStore.getContext();
  const now = new Date().toISOString();

  // 3. Compute staleness flags & dimensional confidences
  const stalenessFlags = {};
  const dimensionalConfidence = { ...rawSnapshot.metadata.dimensionalConfidence };
  const categories = ["profile", "activity", "environment", "conversation", "mood", "session"];

  categories.forEach((cat) => {
    const data = rawSnapshot[cat] || {};
    const timestamp = data.startedAt || data.currentTime || data.timestamp || rawSnapshot.metadata?.lastUpdated;
    const ttlSeconds = SIGNAL_TTL_SECONDS[cat] || 60;

    const freshness = evaluateSignalFreshness(timestamp, dimensionalConfidence[cat] || 1.0, ttlSeconds);
    stalenessFlags[cat] = freshness.isStale;
    dimensionalConfidence[cat] = freshness.effectiveConfidence;
  });

  // 4. Compute overall confidence as weighted mean of dimensional confidences
  const confValues = Object.values(dimensionalConfidence);
  const overallConfidence = confValues.length > 0 ? confValues.reduce((a, b) => a + b, 0) / confValues.length : 1.0;

  // 5. Compute freshness index
  const freshnessIndex = computeFreshnessIndex(rawSnapshot);

  // 6. Assemble complete Unified Context Object
  const fusedSnapshot = {
    ...rawSnapshot,
    metadata: {
      ...rawSnapshot.metadata,
      observedAt: {
        earliest: rawSnapshot.session?.startTime || now,
        latest: now,
      },
      updatedAt: now,
      lastUpdated: now,
      overallConfidence: +overallConfidence.toFixed(2),
      dimensionalConfidence,
      freshnessIndex,
      stalenessFlags,
      conflicts: options.conflicts || rawSnapshot.metadata?.conflicts || [],
    },
  };

  // 7. Backward Compatibility: ensure legacy emotion & task views are populated
  fusedSnapshot.emotion = {
    label: fusedSnapshot.mood.primaryMood || "neutral",
    confidence: fusedSnapshot.mood.confidence || 0.5,
  };
  fusedSnapshot.task = {
    urgency: fusedSnapshot.conversation.urgency || "unknown",
    intent: fusedSnapshot.conversation.detectedIntent || "unknown",
  };
  fusedSnapshot.confidence = {
    overall: fusedSnapshot.metadata.overallConfidence,
  };

  return fusedSnapshot;
}

/**
 * Estimate the reliability of a fused context snapshot.
 * Preserves legacy compatibility.
 *
 * @param {import("./types/contextTypes.js").UnifiedContextObject} snapshot
 * @returns {{ reliable: boolean, factors: string[] }}
 */
export function estimateReliability(snapshot) {
  if (!snapshot || !snapshot.metadata) {
    return { reliable: false, factors: ["No context snapshot provided"] };
  }

  const factors = [];
  const confidences = snapshot.metadata.dimensionalConfidence || {};

  if ((confidences.mood || 0) < 0.4) factors.push("Low mood confidence");
  if ((confidences.activity || 0) < 0.4) factors.push("Low activity confidence");
  if (snapshot.metadata.stalenessFlags?.mood) factors.push("Mood context is stale");
  if (snapshot.metadata.stalenessFlags?.activity) factors.push("Activity context is stale");
  if (snapshot.metadata.conflicts && snapshot.metadata.conflicts.length > 0) {
    factors.push(`Active signal conflicts: ${snapshot.metadata.conflicts.length}`);
  }

  const reliable = factors.length === 0 && (snapshot.metadata.overallConfidence || 0) >= 0.5;

  return {
    reliable,
    factors,
  };
}
