/**
 * contextStore.js — Context Store & State Manager
 *
 * Manages the current Unified Context Object snapshot in memory.
 * Features:
 * - Granular partial updates (updates only affected category)
 * - Automatic timestamping
 * - Source metadata tracking per dimension
 * - Listener subscription management
 * - Immutable snapshot export
 */

import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";

/**
 * Returns default initial state for Unified Context Object.
 * @returns {import("./types/contextTypes.js").UnifiedContextObject}
 */
export function getDefaultContextState() {
  const now = new Date().toISOString();
  return {
    profile: {
      userId: null,
      disorders: [],
      sensorySensitivities: [],
      communicationPreference: "adaptive",
      baselineValence: 0.5,
    },
    activity: {
      currentModule: "dashboard",
      activity: "idle",
      startedAt: now,
      durationSeconds: 0,
      previousActivity: null,
      recentEvents: [],
    },
    environment: {
      currentTime: now,
      timeOfDay: "afternoon",
      dayOfWeek: "Sunday",
      isOnline: true,
      device: {
        deviceType: "unknown",
        browser: "unknown",
        platform: "unknown",
        screenSize: { width: 0, height: 0 },
      },
      battery: null,
      location: null,
      weather: null,
    },
    conversation: {
      lastUserMessage: null,
      sentimentScore: null,
      detectedIntent: null,
      urgency: "unknown",
      keyTopics: [],
    },
    mood: {
      primaryMood: "neutral",
      valence: 0.5,
      arousal: 0.5,
      emotions: [],
      moodTrend: "stable",
      confidence: 0.5,
    },
    session: {
      sessionId: `sess_${Date.now()}`,
      startTime: now,
      durationSeconds: 0,
      currentScreen: "dashboard",
      navigationHistory: [],
    },
    metadata: {
      lastUpdated: now,
      sourceMap: {
        profile: "default",
        activity: "default",
        environment: "default",
        conversation: "default",
        mood: "default",
        session: "default",
      },
      dimensionalConfidence: {
        profile: 1.0,
        activity: 1.0,
        environment: 1.0,
        conversation: 0.5,
        mood: 0.5,
        session: 1.0,
      },
      stalenessFlags: {
        profile: false,
        activity: false,
        environment: false,
        conversation: true,
        mood: true,
        session: false,
      },
    },
  };
}

class ContextStore {
  constructor() {
    /** @type {import("./types/contextTypes.js").UnifiedContextObject} */
    this.state = getDefaultContextState();
  }

  /**
   * Get an immutable snapshot of the current Unified Context Object.
   * @returns {import("./types/contextTypes.js").UnifiedContextObject}
   */
  getContext() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Update a specific category of the Unified Context Object.
   * Updates only the affected portion, timestamps the update, and preserves source metadata.
   *
   * @param {"profile" | "activity" | "environment" | "conversation" | "mood" | "session"} category
   * @param {object} updateData - Partial or full properties for the category
   * @param {string} [source="unknown"] - Source component/agent generating the update
   * @param {number} [confidence] - Optional confidence score for this dimension update
   * @param {{ emitEvent?: boolean }} [options] - When false, skip ContextUpdated (engine handles material-change emission)
   * @returns {import("./types/contextTypes.js").UnifiedContextObject} Updated context snapshot
   */
  updateContext(category, updateData, source = "unknown", confidence, options = {}) {
    if (!this.state[category]) {
      console.warn(`[ContextStore] Invalid category '${category}' specified for update.`);
      return this.getContext();
    }

    const now = new Date().toISOString();

    // Update only the affected category cleanly
    this.state[category] = {
      ...this.state[category],
      ...updateData,
    };

    // Update metadata
    this.state.metadata.lastUpdated = now;
    this.state.metadata.sourceMap[category] = source;
    this.state.metadata.stalenessFlags[category] = false;

    if (typeof confidence === "number") {
      this.state.metadata.dimensionalConfidence[category] = Math.max(0, Math.min(1, confidence));
    }

    const snapshot = this.getContext();

    if (options.emitEvent === true) {
      contextEventBus.emit(ContextEvents.CONTEXT_UPDATED, {
        category,
        updatedData: snapshot[category],
        context: snapshot,
        timestamp: now,
        source,
      });
    }

    return snapshot;
  }

  /**
   * Subscribe to ContextUpdated events.
   * @param {Function} callback - Function called with payload on context update
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    return contextEventBus.subscribe(ContextEvents.CONTEXT_UPDATED, callback);
  }

  /**
   * Reset store to default state (useful for testing or session reset).
   */
  reset() {
    this.state = getDefaultContextState();
  }
}

// Export singleton instance
export const contextStore = new ContextStore();
export { ContextStore };
