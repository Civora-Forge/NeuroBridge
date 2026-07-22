/**
 * Reading Metrics Storage & Management
 * 
 * Stores user interaction metrics for personalization and struggle detection.
 * Uses localStorage for persistence across sessions.
 */

const METRICS_KEY = 'neurobridge_reading_metrics';
const MAX_METRIC_ENTRIES = 1000;

/**
 * Initialize metrics structure for a new session
 */
export const createSessionMetrics = () => ({
  sessionId: Date.now(),
  startTime: Date.now(),
  endTime: null,
  totalReadTime: 0,
  struggles: [],
  interactions: [],
  adjustments: [],
  ttsActivations: 0,
  wordTaps: {},
  scrollEvents: [],
  pronunciationData: [],  // NEW: Audio/pronunciation analysis
  readingPace: {
    sentencesRead: 0,
    avgTimePerSentence: 0
  }
});

/**
 * Get all stored metrics sessions
 */
export const getStoredMetrics = () => {
  try {
    const stored = localStorage.getItem(METRICS_KEY);
    return stored ? JSON.parse(stored) : { sessions: [] };
  } catch (error) {
    console.warn('Failed to retrieve metrics:', error);
    return { sessions: [] };
  }
};

/**
 * Save metrics session
 */
export const saveMetricsSession = (sessionMetrics) => {
  try {
    const allMetrics = getStoredMetrics();
    allMetrics.sessions.push(sessionMetrics);
    
    // Keep only last MAX_METRIC_ENTRIES entries
    if (allMetrics.sessions.length > MAX_METRIC_ENTRIES) {
      allMetrics.sessions = allMetrics.sessions.slice(-MAX_METRIC_ENTRIES);
    }
    
    localStorage.setItem(METRICS_KEY, JSON.stringify(allMetrics));
    return true;
  } catch (error) {
    console.warn('Failed to save metrics:', error);
    return false;
  }
};

/**
 * Add struggle pattern to session
 */
export const recordStruggle = (sessionMetrics, struggleType, details) => {
  sessionMetrics.struggles.push({
    type: struggleType,
    timestamp: Date.now(),
    details
  });
};

/**
 * Record word tap interaction
 */
export const recordWordTap = (sessionMetrics, word) => {
  if (!sessionMetrics.wordTaps[word]) {
    sessionMetrics.wordTaps[word] = 0;
  }
  sessionMetrics.wordTaps[word]++;
};

/**
 * Record scroll event
 */
export const recordScrollEvent = (sessionMetrics, scrollDirection, timestamp) => {
  sessionMetrics.scrollEvents.push({
    direction: scrollDirection,
    timestamp,
    timeSinceLastEvent: sessionMetrics.scrollEvents.length > 0 
      ? timestamp - sessionMetrics.scrollEvents[sessionMetrics.scrollEvents.length - 1].timestamp
      : 0
  });
};

/**
 * Record TTS activation
 */
export const recordTTSActivation = (sessionMetrics) => {
  sessionMetrics.ttsActivations++;
};

/**
 * Record adaptive adjustment applied
 */
export const recordAdjustment = (sessionMetrics, adjustmentType, details) => {
  sessionMetrics.adjustments.push({
    type: adjustmentType,
    timestamp: Date.now(),
    details
  });
};
/**
 * Record pronunciation analysis result
 */
export const recordPronunciationAnalysis = (sessionMetrics, analysis) => {
  sessionMetrics.pronunciationData.push({
    timestamp: Date.now(),
    accuracy: analysis.accuracy,
    confidence: analysis.confidence,
    speakingRate: analysis.speakingRate,
    matchedWords: analysis.matchedWords,
    skippedWordsCount: analysis.skippedWords.length,
    mispronunciationsCount: analysis.mispronounced.length,
    issues: analysis.issues,
    duration: analysis.duration
  });
};
/**
 * Get average metrics from past sessions
 */
export const getAverageMetrics = (sessionCount = 10) => {
  const allMetrics = getStoredMetrics();
  const recentSessions = allMetrics.sessions.slice(-sessionCount);
  
  if (recentSessions.length === 0) {
    return null;
  }
  
  const avgTimePerSentence = recentSessions.reduce((sum, s) => sum + (s.readingPace.avgTimePerSentence || 0), 0) / recentSessions.length;
  const avgTTSActivations = recentSessions.reduce((sum, s) => sum + (s.ttsActivations || 0), 0) / recentSessions.length;
  const totalStruggleEvents = recentSessions.reduce((sum, s) => sum + (s.struggles?.length || 0), 0);
  
  return {
    avgTimePerSentence,
    avgTTSActivations,
    totalStruggleEvents,
    sessionCount: recentSessions.length
  };
};

/**
 * Clear all stored metrics (for testing or user request)
 */
export const clearAllMetrics = () => {
  try {
    localStorage.removeItem(METRICS_KEY);
    return true;
  } catch (error) {
    console.warn('Failed to clear metrics:', error);
    return false;
  }
};
