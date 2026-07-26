/**
 * contextEventBus.js — Typed Pub/Sub Event Bus for Context & Perception Layer
 *
 * Provides decoupled communication between signal collectors, analysis agents,
 * context store, context engine, and external subscribers.
 */

class ContextEventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * Subscribe to a specific event type.
   * @param {string} eventType - Constant from ContextEvents or custom string
   * @param {Function} callback - Event handler callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventType, callback) {
    if (typeof callback !== "function") {
      throw new Error(`Event subscriber callback must be a function, got ${typeof callback}`);
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(callback);

    // Return unsubscribe cleanup function
    return () => {
      this.unsubscribe(eventType, callback);
    };
  }

  /**
   * Unsubscribe a callback from an event type.
   * @param {string} eventType
   * @param {Function} callback
   */
  unsubscribe(eventType, callback) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(eventType);
      }
    }
  }

  /**
   * Emit an event with a payload to all registered subscribers.
   * @param {string} eventType
   * @param {any} payload
   */
  emit(eventType, payload) {
    const handlers = this.listeners.get(eventType);
    if (handlers && handlers.size > 0) {
      handlers.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`[ContextEventBus] Error handling event '${eventType}':`, error);
        }
      });
    }

    // Support wildcard subscribers listening to all events
    const wildcardHandlers = this.listeners.get("*");
    if (wildcardHandlers && wildcardHandlers.size > 0) {
      wildcardHandlers.forEach((callback) => {
        try {
          callback({ eventType, payload });
        } catch (error) {
          console.error(`[ContextEventBus] Error handling wildcard event '${eventType}':`, error);
        }
      });
    }
  }

  /**
   * Clear all event listeners.
   */
  clear() {
    this.listeners.clear();
  }
}

// Export singleton instance
export const contextEventBus = new ContextEventBus();
export { ContextEventBus };
