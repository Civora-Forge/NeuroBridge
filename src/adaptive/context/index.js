/**
 * index.js — Context & Perception Layer Main Entry Point
 *
 * Exposes the Context Engine, Context Store, Signal Validator, Context Fusion Engine,
 * Event Bus, Collectors, Agents, API Handlers, and data models for NeuroBridge V2.
 */

export { contextEngine, ContextEngine } from "./contextEngine.js";
export {
  contextStore,
  ContextStore,
  getDefaultContextState,
} from "./contextStore.js";
export { contextEventBus, ContextEventBus } from "./events/contextEventBus.js";
export { ContextEvents } from "./events/contextEvents.js";
export { createContextSignal } from "./types/contextTypes.js";

// Signal Validation & Quality Assurance
export {
  validateContextSignal,
  evaluateSignalFreshness,
  isDuplicateSignal,
  clearDedupCache,
  detectSignalConflicts,
  SIGNAL_TTL_SECONDS,
} from "./validation/signalValidator.js";

// Activity Collectors & Tracking
export {
  trackActivity,
  getActivitySummary,
  detectBehavioralPatterns,
  resetActivityTracker,
} from "./activityTracker.js";

// Environment Sensing
export {
  collectEnvironmentContext,
  startEnvironmentMonitoring,
  stopEnvironmentMonitoring,
  assessEnvironmentFit,
} from "./environmentContext.js";

// Session Tracking
export {
  startSession,
  updateSessionNavigation,
  getSessionSummary,
  resetSessionTracker,
} from "./sessionTracker.js";

// Analysis Agents
export {
  analyzeConversation,
  extractExplicitRequest,
  heuristicAnalyzeConversation,
  ConversationAnalysisSchema,
} from "./conversationAgent.js";

export {
  inferMood,
  handleInteractionSignal,
  detectMoodShift,
  resetMoodAgent,
  MOOD_VOCABULARY,
} from "./moodAgent.js";

// Context Fusion Engine
export {
  fuseContext,
  estimateReliability,
  computeFreshnessIndex,
  detectMaterialChange,
} from "./contextFusion.js";

// Live Interaction Metrics
export {
  startInteractionTracking,
  stopInteractionTracking,
  recordNavigationSignal,
  recordExplicitRequestInteraction,
  getInteractionSnapshot,
  getExplicitRequestSnapshot,
  resetInteractionTracker,
} from "./contextInteractionTracker.js";

// Public ContextSnapshot API & Services
export {
  handleGetContextSnapshot,
  getContextSnapshotAPI,
  handleGetUnifiedContext,
  getUnifiedContextAPI,
} from "./api/contextApi.js";

// Public ContextSnapshot Adapter
export {
  ContextSnapshotAdapter,
  toContextSnapshot,
} from "./contextSnapshotAdapter.js";

// Pipeline orchestration & observability
export { processUserMessage, syncProfileContext } from "./contextPipeline.js";
export {
  initContextLogger,
  logFusion,
  teardownContextLogger,
  isDebugEnabled,
} from "./contextLogger.js";
