/**
 * contextSnapshotAdapter.js — Public ContextSnapshot Adapter
 *
 * Converts the internal UnifiedContext used by Role 1 into the stable public
 * ContextSnapshot contract consumed by downstream modules.
 *
 * This adapter is intentionally stateless and does not mutate the source object.
 */

const DEFAULT_SNAPSHOT_VERSION = "1.0.0";

function createSnapshotId(timestamp, userId) {
  const timePart = String(timestamp || new Date().toISOString()).replace(/[:.]/g, "-");
  const userPart = userId ? String(userId) : "anonymous";
  const randomPart = Math.random().toString(36).slice(2, 7);
  return `snap_${timePart}_${userPart}_${randomPart}`;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildProfile(profile = {}) {
  return {
    userId: profile.userId ?? null,
    disorders: Array.isArray(profile.disorders) ? [...profile.disorders] : [],
    sensorySensitivities: Array.isArray(profile.sensorySensitivities) ? [...profile.sensorySensitivities] : [],
    communicationPreference: profile.communicationPreference || "adaptive",
    baselineValence: typeof profile.baselineValence === "number" ? profile.baselineValence : 0.5,
  };
}

function buildActivity(activity = {}) {
  return {
    currentModule: activity.currentModule || "dashboard",
    activity: activity.activity || "idle",
    startedAt: activity.startedAt || new Date().toISOString(),
    durationSeconds: typeof activity.durationSeconds === "number" ? activity.durationSeconds : 0,
    previousActivity: activity.previousActivity ?? null,
    recentEvents: Array.isArray(activity.recentEvents) ? clone(activity.recentEvents) : [],
  };
}

function buildEnvironment(environment = {}) {
  return {
    currentTime: environment.currentTime || new Date().toISOString(),
    timeOfDay: environment.timeOfDay || "unknown",
    dayOfWeek: environment.dayOfWeek || "unknown",
    isOnline: typeof environment.isOnline === "boolean" ? environment.isOnline : true,
    device: clone(environment.device) || {
      deviceType: "unknown",
      browser: "unknown",
      platform: "unknown",
      screenSize: { width: 0, height: 0 },
    },
    battery: environment.battery ?? null,
    location: environment.location ?? null,
    weather: environment.weather ?? null,
  };
}

function buildConversation(conversation = {}) {
  return {
    lastUserMessage: conversation.lastUserMessage ?? null,
    sentimentScore: typeof conversation.sentimentScore === "number" ? conversation.sentimentScore : null,
    detectedIntent: conversation.detectedIntent ?? null,
    urgency: conversation.urgency || "unknown",
    keyTopics: Array.isArray(conversation.keyTopics) ? [...conversation.keyTopics] : [],
    emotionalCues: Array.isArray(conversation.emotionalCues) ? [...conversation.emotionalCues] : [],
    analysis: clone(conversation.analysis) ?? null,
  };
}

function buildMood(mood = {}) {
  return {
    primaryMood: mood.primaryMood || "unknown",
    valence: typeof mood.valence === "number" ? mood.valence : 0.5,
    arousal: typeof mood.arousal === "number" ? mood.arousal : 0.5,
    emotions: Array.isArray(mood.emotions) ? [...mood.emotions] : [],
    moodTrend: mood.moodTrend || "stable",
    confidence: typeof mood.confidence === "number" ? mood.confidence : 0.5,
    sources: Array.isArray(mood.sources) ? [...mood.sources] : [],
  };
}

function buildSession(session = {}) {
  return {
    sessionId: session.sessionId || `sess_${Date.now()}`,
    startTime: session.startTime || new Date().toISOString(),
    durationSeconds: typeof session.durationSeconds === "number" ? session.durationSeconds : 0,
    currentScreen: session.currentScreen || "dashboard",
    navigationHistory: Array.isArray(session.navigationHistory) ? clone(session.navigationHistory) : [],
  };
}

function buildMetadata(unifiedContext = {}, snapshotVersion, timestamp, userId) {
  const metadata = unifiedContext.metadata || {};
  const lastUpdated = metadata.lastUpdated || timestamp || new Date().toISOString();
  const dimensionalConfidence = clone(metadata.dimensionalConfidence) || {};
  const confidenceValues = Object.values(dimensionalConfidence).filter((value) => typeof value === "number");
  const overallConfidence =
    typeof metadata.overallConfidence === "number"
      ? metadata.overallConfidence
      : confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0.5;

  return {
    snapshotVersion: snapshotVersion || metadata.snapshotVersion || DEFAULT_SNAPSHOT_VERSION,
    lastUpdated,
    observedAt: clone(metadata.observedAt) || {
      earliest: unifiedContext.session?.startTime || lastUpdated,
      latest: lastUpdated,
    },
    overallConfidence: +Number(overallConfidence || 0).toFixed(2),
    dimensionalConfidence,
    freshnessIndex: typeof metadata.freshnessIndex === "number" ? metadata.freshnessIndex : 0.5,
    stalenessFlags: clone(metadata.stalenessFlags) || {},
    sourceMap: clone(metadata.sourceMap) || {},
    conflicts: Array.isArray(metadata.conflicts) ? clone(metadata.conflicts) : [],
    snapshotId: undefined,
    userId,
  };
}

/**
 * Convert an internal UnifiedContext into the public ContextSnapshot contract.
 *
 * @param {import("./types/contextTypes.js").UnifiedContext | import("./types/contextTypes.js").UnifiedContextObject | null | undefined} unifiedContext
 * @param {import("./types/contextTypes.js").ContextSnapshotOptions} [options]
 * @returns {import("./types/contextTypes.js").ContextSnapshot}
 */
export function toContextSnapshot(unifiedContext, options = {}) {
  const source = unifiedContext || {};
  const userId = source.profile?.userId ?? null;
  const timestamp = source.metadata?.lastUpdated || new Date().toISOString();
  const metadata = buildMetadata(source, options.snapshotVersion, timestamp, userId);
  const snapshotId = options.snapshotId || metadata.snapshotId || createSnapshotId(timestamp, userId);

  return {
    snapshotId,
    userId,
    timestamp,
    profile: buildProfile(source.profile),
    activity: buildActivity(source.activity),
    environment: buildEnvironment(source.environment),
    conversation: buildConversation(source.conversation),
    mood: buildMood(source.mood),
    session: buildSession(source.session),
    metadata: {
      snapshotVersion: metadata.snapshotVersion,
      lastUpdated: metadata.lastUpdated,
      observedAt: metadata.observedAt,
      overallConfidence: metadata.overallConfidence,
      dimensionalConfidence: metadata.dimensionalConfidence,
      freshnessIndex: metadata.freshnessIndex,
      stalenessFlags: metadata.stalenessFlags,
      sourceMap: metadata.sourceMap,
      conflicts: metadata.conflicts,
    },
  };
}

export const ContextSnapshotAdapter = Object.freeze({
  toContextSnapshot,
  fromUnifiedContext: toContextSnapshot,
  DEFAULT_SNAPSHOT_VERSION,
});