/**
 * contextTypes.js — Data Models & Schemas for Context & Perception Layer
 */

/**
 * @typedef {object} ContextSignal
 * @property {string} id - Unique signal identifier
 * @property {string} source - Originating module or agent name
 * @property {string} type - Event or signal type
 * @property {object} payload - Categorical signal data
 * @property {number} [confidence] - Signal confidence score (0.0 to 1.0)
 * @property {string} timestamp - ISO 8601 creation timestamp
 * @property {number} [ttlSeconds] - Time-to-live before signal is considered stale
 * @property {object} [metadata] - Additional source metadata
 */

/**
 * @typedef {object} ActivityContext
 * @property {string} currentModule - Active UI module (e.g. "reader", "focus", "planner", "regulation", "reflection")
 * @property {string} activity - Active activity type (e.g. "reading", "focus_session", "planning", "regulation", "reflection")
 * @property {string} startedAt - ISO 8601 timestamp when current activity started
 * @property {number} durationSeconds - Elapsed duration in seconds for current activity
 * @property {string|null} previousActivity - Previous activity name
 * @property {Array<{ eventType: string, timestamp: string, data?: object }>} recentEvents - Log of recent activity events
 */

/**
 * @typedef {object} EnvironmentContext
 * @property {string} currentTime - ISO 8601 current timestamp
 * @property {string} timeOfDay - "morning" | "afternoon" | "evening" | "night"
 * @property {string} dayOfWeek - Day name (e.g. "Monday", "Tuesday")
 * @property {boolean} isOnline - Network connectivity status
 * @property {{ deviceType: string, browser: string, platform: string, screenSize: { width: number, height: number } }} device - Device & screen parameters
 * @property {{ level: number|null, charging: boolean|null }|null} [battery] - Optional battery status (graceful fallback)
 * @property {object|null} [location] - Optional location status (graceful fallback)
 * @property {object|null} [weather] - Optional weather status (graceful fallback)
 */

/**
 * @typedef {object} SessionContext
 * @property {string} sessionId - Unique session identifier
 * @property {string} startTime - ISO 8601 session start timestamp
 * @property {number} durationSeconds - Total elapsed session duration in seconds
 * @property {string} currentScreen - Currently active screen/module
 * @property {Array<{ screen: string, timestamp: string }>} navigationHistory - History of visited screens
 */

/**
 * @typedef {object} ProfileContext
 * @property {string|null} userId - User identifier
 * @property {string[]} disorders - Profiled conditions (e.g. ADHD, ASD, Dyspraxia, OCD)
 * @property {string[]} sensorySensitivities - Known sensory triggers
 * @property {string} communicationPreference - Preferred interaction style
 * @property {number} baselineValence - User baseline emotional valence
 */

/**
 * @typedef {object} ConversationContext
 * @property {string|null} lastUserMessage - Last message input
 * @property {number|null} sentimentScore - Sentiment score (-1.0 to +1.0)
 * @property {string|null} detectedIntent - Extracted intent
 * @property {string} urgency - "low" | "moderate" | "high" | "critical" | "unknown"
 * @property {string[]} keyTopics - Extracted topics
 * @property {{ intent: string|null, requestType: string|null, priority: string|null, originalText: string|null, confidence: number|null, timestamp: string|null }|null} [explicitRequest] - First-class explicit user request context
 */

/**
 * @typedef {object} MoodContext
 * @property {string} primaryMood - Inferred mood label
 * @property {number} valence - Emotional valence (0.0 to 1.0)
 * @property {number} arousal - Emotional arousal (0.0 to 1.0)
 * @property {string[]} emotions - Detailed emotion labels
 * @property {string} moodTrend - "stable" | "escalating" | "de-escalating"
 * @property {number} confidence - Inference confidence (0.0 to 1.0)
 */

/**
 * @typedef {object} UnifiedContextObject
 * @property {ProfileContext} profile
 * @property {ActivityContext} activity
 * @property {EnvironmentContext} environment
 * @property {ConversationContext} conversation
 * @property {MoodContext} mood
 * @property {SessionContext} session
 * @property {{ lastUpdated: string, sourceMap: Record<string, string>, dimensionalConfidence: Record<string, number>, stalenessFlags: Record<string, boolean> }} metadata
 */

/**
 * @typedef {UnifiedContextObject} UnifiedContext
 * Internal representation owned by the Context & Perception layer.
 */

/**
 * @typedef {object} ContextSnapshotMetadata
 * @property {string} snapshotVersion - Version of the public snapshot schema
 * @property {string} lastUpdated - ISO 8601 snapshot publication time
 * @property {{ earliest: string, latest: string }} observedAt - Observation window used during fusion
 * @property {number} overallConfidence - Aggregated snapshot confidence (0.0 to 1.0)
 * @property {Record<string, number>} dimensionalConfidence - Confidence per top-level domain
 * @property {number} freshnessIndex - Aggregate freshness score (0.0 to 1.0)
 * @property {Record<string, boolean>} stalenessFlags - Per-domain stale-state flags
 * @property {Record<string, string>} sourceMap - Provenance map for each top-level domain
 * @property {Array<object>} [conflicts] - Active validation conflicts, if any
 */

/**
 * @typedef {object} ContextSnapshot
 * @property {string} snapshotId - Unique identifier for the public snapshot
 * @property {string|null} userId - Stable user identifier; non-null for authenticated snapshots, null allowed for anonymous/pre-auth snapshots
 * @property {string} timestamp - ISO 8601 snapshot publication time
 * @property {ProfileContext} profile - Public profile context
 * @property {ActivityContext} activity - Public activity context
 * @property {EnvironmentContext} environment - Public environment context
 * @property {ConversationContext} conversation - Public conversation context
 * @property {MoodContext} mood - Public mood context
 * @property {SessionContext} session - Public session context
 * @property {ContextSnapshotMetadata} metadata - Snapshot freshness, provenance, and confidence metadata
 */

/**
 * @typedef {object} ContextSnapshotOptions
 * @property {string} [snapshotVersion] - Override the default snapshot version
 * @property {string} [snapshotId] - Override the generated snapshot identifier
 */

/**
 * Helper to construct a standardized ContextSignal envelope.
 * @param {Omit<ContextSignal, 'id'|'timestamp'> & Partial<ContextSignal>} params
 * @returns {ContextSignal}
 */
export function createContextSignal({
  source,
  type,
  payload = {},
  confidence = 1.0,
  ttlSeconds = 60,
  metadata = {},
  id,
  timestamp,
}) {
  return {
    id: id || `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    source: source || "unknown",
    type: type || "GENERIC_SIGNAL",
    payload,
    confidence,
    timestamp: timestamp || new Date().toISOString(),
    ttlSeconds,
    metadata,
  };
}
