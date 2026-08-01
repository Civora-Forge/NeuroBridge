/**
 * contextEvents.js — Event Name Constants for Context & Perception Layer
 */

export const ContextEvents = {
  /** Emitted when user activity changes or activity metrics update */
  ACTIVITY_UPDATED: "ActivityUpdated",
  /** Emitted when environmental conditions (time, network, screen) update */
  ENVIRONMENT_UPDATED: "EnvironmentUpdated",
  /** Emitted when session metadata or navigation state changes */
  SESSION_UPDATED: "SessionUpdated",
  /** Emitted when any portion of the Unified Context Object is updated */
  CONTEXT_UPDATED: "ContextUpdated",
  /** Emitted when raw or processed context signal is ingested */
  SIGNAL_RECEIVED: "SignalReceived",
  /** Emitted when mood or emotional state is updated */
  MOOD_UPDATED: "MoodUpdated",
  /** Emitted when conversation context updates */
  CONVERSATION_UPDATED: "ConversationUpdated",
  /** Emitted when live interaction metrics change */
  INTERACTION_UPDATED: "InteractionUpdated",
};
