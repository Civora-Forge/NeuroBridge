/**
 * contextEngine.js — Context & Perception Engine Coordinator
 *
 * Core coordinator and Facade API for the Context & Perception layer.
 * Responsibilities:
 * - Maintain user's current context snapshot via ContextStore & ContextFusion
 * - Receive, validate, deduplicate, and process incoming ContextSignal instances
 * - Update affected context dimensions selectively
 * - Timestamp updates, calculate freshness index, and preserve source metadata
 * - Maintain current session lifecycle
 * - Expose current context snapshot to external services (User State Model, Adaptive Intelligence layer, UI)
 * - Broadcast ContextUpdated and typed perception events on material changes
 */

import { contextStore } from "./contextStore.js";
import { contextEventBus } from "./events/contextEventBus.js";
import { ContextEvents } from "./events/contextEvents.js";
import { collectEnvironmentContext, startEnvironmentMonitoring, stopEnvironmentMonitoring } from "./environmentContext.js";
import { trackActivity } from "./activityTracker.js";
import { startSession, updateSessionNavigation } from "./sessionTracker.js";
import { createContextSignal } from "./types/contextTypes.js";
import { validateContextSignal } from "./validation/signalValidator.js";
import { fuseContext, detectMaterialChange } from "./contextFusion.js";
import { handleGetUnifiedContext, getUnifiedContextAPI } from "./api/contextApi.js";
import { initContextLogger } from "./contextLogger.js";
import { processUserMessage as runPipelineMessage, syncProfileContext } from "./contextPipeline.js";

class ContextEngine {
  constructor() {
    this.isInitialized = false;
    this.activeConflicts = [];
  }

  /**
   * Initialize the Context Engine, collectors, and session lifecycle.
   * @param {object} [options]
   * @param {string} [options.initialScreen="dashboard"]
   * @param {boolean} [options.autoMonitorEnvironment=true]
   */
  init(options = {}) {
    if (this.isInitialized) return;

    const initialScreen = options.initialScreen || "dashboard";

    // 1. Initialize session context
    startSession(initialScreen);

    // 2. Initialize activity context
    trackActivity(initialScreen, { module: initialScreen, action: "init" });

    // 3. Initialize environment context
    collectEnvironmentContext();

    if (options.autoMonitorEnvironment !== false) {
      startEnvironmentMonitoring();
    }

    // 4. Perform initial context fusion
    fuseContext({}, { conflicts: this.activeConflicts });

    initContextLogger();

    this.isInitialized = true;

    // Emit initial ContextUpdated event
    const currentContext = this.getLatestContext();
    contextEventBus.emit(ContextEvents.CONTEXT_UPDATED, {
      category: "all",
      updatedData: currentContext,
      context: currentContext,
      timestamp: new Date().toISOString(),
      source: "contextEngine.init",
      isMaterialChange: true,
      materialChanges: ["initialization"],
    });
  }

  /**
   * Stop Context Engine monitoring and timers.
   */
  stop() {
    stopEnvironmentMonitoring();
    this.isInitialized = false;
  }

  /**
   * Ingest a context signal into the perception pipeline.
   * Pipeline steps: Ingestion → Validation & Deduplication → Staleness Check → Conflict Detection → Selective Update & Fusion → Material Change Filter → ContextUpdated Event.
   *
   * @param {import("./types/contextTypes.js").ContextSignal | object} rawSignal
   * @param {object} [options]
   * @returns {import("./types/contextTypes.js").UnifiedContextObject} Updated context snapshot
   */
  ingestSignal(rawSignal, options = {}) {
    const currentContext = contextStore.getContext();

    // 1. Validate, sanitize, deduplicate, and evaluate signal freshness
    const validationResult = validateContextSignal(rawSignal, currentContext, options);

    // Suppress duplicate signals if flagged as duplicate
    if (validationResult.isDuplicate && options.force !== true) {
      return currentContext;
    }

    const signal = validationResult.sanitizedSignal;
    const source = signal.source || "unknown";
    const confidence = signal.confidence;
    const type = signal.type || "";
    const payload = signal.payload || {};

    // Track active signal conflicts
    if (validationResult.conflicts && validationResult.conflicts.length > 0) {
      this.activeConflicts = [...this.activeConflicts, ...validationResult.conflicts].slice(-10);
    }

    // 2. Route signal payload to appropriate context category
    let targetCategory = null;

    if (type === ContextEvents.ACTIVITY_UPDATED || source === "activityTracker" || payload.activity || payload.currentModule) {
      targetCategory = "activity";
    } else if (type === ContextEvents.ENVIRONMENT_UPDATED || source === "environmentContext" || payload.timeOfDay || payload.device) {
      targetCategory = "environment";
    } else if (type === ContextEvents.SESSION_UPDATED || source === "sessionTracker" || payload.sessionId) {
      targetCategory = "session";
    } else if (type === ContextEvents.CONVERSATION_UPDATED || source === "conversationAgent" || payload.lastUserMessage) {
      targetCategory = "conversation";
    } else if (type === ContextEvents.MOOD_UPDATED || source === "moodAgent" || payload.primaryMood || payload.value) {
      targetCategory = "mood";
    } else if (payload.category && ["profile", "activity", "environment", "conversation", "mood", "session"].includes(payload.category)) {
      targetCategory = payload.category;
    }

    if (targetCategory) {
      contextStore.updateContext(targetCategory, payload, source, confidence);
    }

    // Emit typed perception events for pipeline observability
    if (type === ContextEvents.CONVERSATION_UPDATED) {
      contextEventBus.emit(ContextEvents.CONVERSATION_UPDATED, {
        conversation: payload,
        analysis: payload.analysis,
        signal,
        timestamp: signal.timestamp,
      });
    } else if (type === ContextEvents.MOOD_UPDATED) {
      contextEventBus.emit(ContextEvents.MOOD_UPDATED, {
        mood: payload,
        signal,
        timestamp: signal.timestamp,
      });
    }

    // 3. Fuse full context snapshot with metadata
    const fusedContext = fuseContext({}, { conflicts: this.activeConflicts });

    // 4. Detect if material change occurred compared to previous snapshot
    const changeCheck = detectMaterialChange(currentContext, fusedContext);

    // Broadcast raw signal received event
    contextEventBus.emit(ContextEvents.SIGNAL_RECEIVED, signal);

    // Emit ContextUpdated event if a material change occurred or forced
    if (changeCheck.isMaterialChange || options.force === true) {
      contextEventBus.emit(ContextEvents.CONTEXT_UPDATED, {
        category: targetCategory || "all",
        updatedData: targetCategory ? fusedContext[targetCategory] : fusedContext,
        context: fusedContext,
        timestamp: new Date().toISOString(),
        source,
        isMaterialChange: true,
        materialChanges: changeCheck.materialChanges,
      });
    }

    return fusedContext;
  }

  /**
   * Expose current Unified Context Object snapshot synchronously to other services.
   * @returns {import("./types/contextTypes.js").UnifiedContextObject}
   */
  getLatestContext() {
    return fuseContext({}, { conflicts: this.activeConflicts });
  }

  /**
   * Subscribe to ContextUpdated events (emitted whenever a material context change occurs).
   * @param {Function} callback - ({ category, updatedData, context, timestamp, source, isMaterialChange }) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    return contextStore.subscribe(callback);
  }

  /**
   * Subscribe to a specific typed perception event (e.g. ActivityUpdated, EnvironmentUpdated, SessionUpdated).
   * @param {string} eventType - Constant from ContextEvents
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  subscribeEvent(eventType, callback) {
    return contextEventBus.subscribe(eventType, callback);
  }

  /**
   * Helper to notify system of a module/screen navigation event.
   * Automatically updates activity and session tracking.
   * @param {string} moduleName - Name of module (e.g. "reader", "focus", "planner", "regulation", "reflection")
   * @param {object} [data]
   */
  trackNavigation(moduleName, data = {}) {
    const previousContext = contextStore.getContext();
    updateSessionNavigation(moduleName);
    trackActivity(moduleName, { module: moduleName, ...data });

    const fusedContext = fuseContext({}, { conflicts: this.activeConflicts });
    const changeCheck = detectMaterialChange(previousContext, fusedContext);

    if (changeCheck.isMaterialChange) {
      contextEventBus.emit(ContextEvents.CONTEXT_UPDATED, {
        category: "activity",
        updatedData: fusedContext.activity,
        context: fusedContext,
        timestamp: new Date().toISOString(),
        source: "activityTracker",
        isMaterialChange: true,
        materialChanges: changeCheck.materialChanges,
      });
    }

    return fusedContext;
  }

  /**
   * Process user message through conversation → mood → fusion pipeline.
   * @param {string} text
   * @param {object} [options]
   * @returns {Promise<{ analysis: object, mood: object, context: object }>}
   */
  processUserMessage(text, options = {}) {
    return runPipelineMessage(text, options);
  }

  /**
   * Sync authenticated user profile into context dimensions.
   * @param {object} profile
   */
  syncProfile(profile) {
    syncProfileContext(profile);
  }

  /**
   * REST API Endpoint Handler for GET /api/context/current
   */
  handleApiGetContext(req) {
    return handleGetUnifiedContext(req);
  }
}

// Export singleton instance
export const contextEngine = new ContextEngine();
export { ContextEngine };
