/**
 * Struggle Detection Engine
 * 
 * Implements rule-based logic to detect reading difficulties based on:
 * - Time per sentence (decoding difficulty)
 * - Word tapping frequency (word-level struggle)
 * - Backward scrolling (comprehension issues)
 * - TTS activation patterns (auditory dependency)
 */

const THRESHOLDS = {
  TIME_PER_SENTENCE_MS: 8000, // > 8 seconds = possible decoding difficulty
  WORD_TAP_THRESHOLD: 2, // >= 2 taps = word-level struggle
  SCROLL_BACK_THRESHOLD_MS: 5000, // scroll back within 5 seconds = comprehension issue
  TTS_ACTIVATION_COUNT: 3 // >= 3 activations in session = auditory dependency
};

export const STRUGGLE_TYPES = {
  DECODING_DIFFICULTY: 'decoding_difficulty',
  WORD_STRUGGLE: 'word_struggle',
  COMPREHENSION_ISSUE: 'comprehension_issue',
  AUDITORY_DEPENDENCY: 'auditory_dependency'
};

/**
 * Track sentence reading with timing
 */
export class SentenceTracker {
  constructor() {
    this.sentences = new Map(); // sentenceIndex -> { startTime, endTime }
    this.currentSentenceIndex = 0;
  }

  startSentence(index) {
    this.currentSentenceIndex = index;
    this.sentences.set(index, { startTime: Date.now(), endTime: null });
  }

  endSentence(index) {
    if (this.sentences.has(index)) {
      this.sentences.get(index).endTime = Date.now();
    }
  }

  getSentenceReadTime(index) {
    const sentence = this.sentences.get(index);
    if (sentence?.startTime && sentence?.endTime) {
      return sentence.endTime - sentence.startTime;
    }
    return 0;
  }

  getAverageReadTime() {
    const times = Array.from(this.sentences.values())
      .filter(s => s.startTime && s.endTime)
      .map(s => s.endTime - s.startTime);
    
    if (times.length === 0) return 0;
    return times.reduce((a, b) => a + b, 0) / times.length;
  }
}

/**
 * Detect decoding difficulty
 * Rule: If time per sentence > X seconds → Possible decoding difficulty
 */
export const detectDecodingDifficulty = (sentenceIndex, readTime) => {
  if (readTime > THRESHOLDS.TIME_PER_SENTENCE_MS) {
    return {
      detected: true,
      severity: calculateSeverity(readTime, THRESHOLDS.TIME_PER_SENTENCE_MS),
      readTime,
      threshold: THRESHOLDS.TIME_PER_SENTENCE_MS,
      recommendation: 'slow_down_pace'
    };
  }
  return { detected: false };
};

/**
 * Detect word-level struggle
 * Rule: If same word tapped >= 2 times → Word-level struggle
 */
export const detectWordStruggle = (word, tapCount) => {
  if (tapCount >= THRESHOLDS.WORD_TAP_THRESHOLD) {
    return {
      detected: true,
      word,
      tapCount,
      severity: calculateSeverity(tapCount, THRESHOLDS.WORD_TAP_THRESHOLD),
      recommendation: 'highlight_word'
    };
  }
  return { detected: false };
};

/**
 * Detect comprehension issues
 * Rule: If user scrolls back within 5 seconds → Comprehension issue
 */
export const detectComprehensionIssue = (scrollBackEvent, previousEventTimestamp) => {
  const timeSinceLastEvent = scrollBackEvent.timestamp - previousEventTimestamp;
  
  if (timeSinceLastEvent < THRESHOLDS.SCROLL_BACK_THRESHOLD_MS && scrollBackEvent.direction === 'up') {
    return {
      detected: true,
      timeSinceLastEvent,
      threshold: THRESHOLDS.SCROLL_BACK_THRESHOLD_MS,
      severity: calculateSeverity(
        THRESHOLDS.SCROLL_BACK_THRESHOLD_MS - timeSinceLastEvent,
        THRESHOLDS.SCROLL_BACK_THRESHOLD_MS
      ),
      recommendation: 'increase_line_spacing'
    };
  }
  return { detected: false };
};

/**
 * Detect auditory dependency
 * Rule: If TTS is activated repeatedly → Auditory dependency
 */
export const detectAuditoryDependency = (ttsActivationCount) => {
  if (ttsActivationCount >= THRESHOLDS.TTS_ACTIVATION_COUNT) {
    return {
      detected: true,
      activationCount: ttsActivationCount,
      threshold: THRESHOLDS.TTS_ACTIVATION_COUNT,
      recommendation: 'reduce_reading_load'
    };
  }
  return { detected: false };
};

/**
 * Calculate severity score (0-1)
 */
const calculateSeverity = (value, threshold) => {
  const ratio = Math.min(value / threshold, 2); // Cap at 2x
  return Math.min(ratio / 2, 1); // Normalize to 0-1
};

/**
 * Generate adaptive adjustments based on detected struggles
 */
export const generateAdaptiveAdjustments = (strugglesDetected) => {
  const adjustments = {
    fontSize: 100, // default 100%
    lineSpacing: 1.5, // default
    letterSpacing: 0, // px
    highlightWords: [],
    enableDyslexicFont: false,
    slowDownPace: false,
    reduceReadingLoad: false,
    enableAudioSupport: false
  };

  for (const struggle of strugglesDetected) {
    switch (struggle.type) {
      case STRUGGLE_TYPES.DECODING_DIFFICULTY:
        // Increase font size and line spacing for decoding issues
        adjustments.fontSize = Math.min(100 + (struggle.severity * 30), 150);
        adjustments.lineSpacing = 1.5 + (struggle.severity * 0.5);
        adjustments.letterSpacing = struggle.severity * 2;
        adjustments.enableDyslexicFont = true;
        adjustments.slowDownPace = true;
        break;

      case STRUGGLE_TYPES.WORD_STRUGGLE:
        // Highlight problematic words
        if (struggle.word) {
          adjustments.highlightWords.push({
            word: struggle.word,
            severity: struggle.severity
          });
        }
        break;

      case STRUGGLE_TYPES.COMPREHENSION_ISSUE:
        // Increase line/paragraph spacing for comprehension
        adjustments.lineSpacing = Math.max(adjustments.lineSpacing, 2 + (struggle.severity * 0.5));
        break;

      case STRUGGLE_TYPES.AUDITORY_DEPENDENCY:
        // Slowly reduce reading load, encourage visual reading
        adjustments.reduceReadingLoad = true;
        adjustments.enableAudioSupport = true;
        break;
    }
  }

  return adjustments;
};

/**
 * Analyze patterns from session metrics
 */
export const analyzeReadingPatterns = (sessionMetrics) => {
  const patterns = {
    averageReadingPace: 0,
    strugglingWords: [],
    comprehensionIssues: 0,
    ttsDependence: 0
  };

  // Analyze word struggles
  const wordTaps = sessionMetrics.wordTaps || {};
  patterns.strugglingWords = Object.entries(wordTaps)
    .filter(([_, count]) => count >= THRESHOLDS.WORD_TAP_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10) // Top 10 struggling words
    .map(([word, count]) => ({ word, tapCount: count }));

  // Analyze comprehension
  patterns.comprehensionIssues = (sessionMetrics.scrollEvents || [])
    .filter(e => e.direction === 'up' && e.timeSinceLastEvent < THRESHOLDS.SCROLL_BACK_THRESHOLD_MS)
    .length;

  // Analyze TTS dependency
  patterns.ttsDependence = sessionMetrics.ttsActivations || 0;

  // Average reading pace
  patterns.averageReadingPace = sessionMetrics.readingPace?.avgTimePerSentence || 0;

  return patterns;
};
