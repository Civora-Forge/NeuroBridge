/**
 * Pronunciation Analysis Engine
 * 
 * Analyzes user's spoken pronunciation against expected text.
 * Detects mispronunciations, skipped words, and pace issues.
 */

const PRONUNCIATION_THRESHOLDS = {
  MIN_CONFIDENCE: 0.5, // 50% confidence minimum
  MIN_WORD_DURATION_MS: 200, // At least 200ms per word
  MAX_WORD_DURATION_MS: 3000, // At most 3 seconds per word
};

export const PRONUNCIATION_ISSUES = {
  SKIPPED_WORD: 'skipped_word',
  MISPRONOUNCED: 'mispronounced',
  LOW_CONFIDENCE: 'low_confidence',
  STUTTERING: 'stuttering',
  RUSHED_SPEECH: 'rushed_speech',
  SLOW_SPEECH: 'slow_speech'
};

/**
 * Compare user's transcript with expected text
 */
export const analyzeTranscript = (expectedText, userTranscript, confidence, duration) => {
  const analysis = {
    accuracy: 0,
    issues: [],
    matchedWords: 0,
    skippedWords: [],
    mispronounced: [],
    confidence,
    duration,
    speakingRate: 0
  };

  if (!userTranscript || !expectedText) {
    return analysis;
  }

  // Normalize texts for comparison
  const expectedWords = normalizeText(expectedText).split(/\s+/);
  const userWords = normalizeText(userTranscript).split(/\s+/);

  // Calculate word-by-word accuracy
  let matchCount = 0;
  let skipCount = 0;

  for (let i = 0; i < expectedWords.length; i++) {
    const expected = expectedWords[i].toLowerCase();

    // Find matching word in user transcript
    const matchIndex = userWords.findIndex(
      (word) =>
        word.toLowerCase() === expected ||
        calculateSimilarity(word.toLowerCase(), expected) > 0.8
    );

    if (matchIndex === -1) {
      // Word was skipped
      skipCount++;
      analysis.skippedWords.push({
        word: expected,
        position: i
      });
      analysis.issues.push({
        type: PRONUNCIATION_ISSUES.SKIPPED_WORD,
        word: expected,
        position: i
      });
    } else {
      // Word was matched but may be mispronounced
      matchCount++;

      // Check if pronunciations are similar (Levenshtein distance)
      const similarity = calculateSimilarity(
        userWords[matchIndex].toLowerCase(),
        expected
      );

      if (similarity < 0.8 && similarity > 0.5) {
        analysis.mispronounced.push({
          expected: expected,
          actual: userWords[matchIndex],
          similarity: precision(similarity, 2)
        });
        analysis.issues.push({
          type: PRONUNCIATION_ISSUES.MISPRONOUNCED,
          expected,
          actual: userWords[matchIndex],
          similarity
        });
      }
    }
  }

  // Calculate accuracy
  analysis.accuracy = matchCount / expectedWords.length;
  analysis.matchedWords = matchCount;

  // Detect confidence issues
  if (confidence < PRONUNCIATION_THRESHOLDS.MIN_CONFIDENCE * 100) {
    analysis.issues.push({
      type: PRONUNCIATION_ISSUES.LOW_CONFIDENCE,
      confidence
    });
  }

  // Analyze speaking rate
  const wordsSpoken = userWords.length;
  const durationSeconds = duration;
  const wordsPerMinute = durationSeconds > 0 
    ? Math.round((wordsSpoken / durationSeconds) * 60)
    : 0;

  analysis.speakingRate = wordsPerMinute;

  // Detect rate issues
  if (wordsPerMinute < 80) {
    // Below 80 WPM is generally slow
    analysis.issues.push({
      type: PRONUNCIATION_ISSUES.SLOW_SPEECH,
      rate: wordsPerMinute
    });
  } else if (wordsPerMinute > 180) {
    // Above 180 WPM is rushed
    analysis.issues.push({
      type: PRONUNCIATION_ISSUES.RUSHED_SPEECH,
      rate: wordsPerMinute
    });
  }

  return analysis;
};

/**
 * Normalize text for comparison
 */
const normalizeText = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};

/**
 * Calculate similarity between two strings (0-1)
 * Uses Levenshtein distance algorithm
 */
const calculateSimilarity = (str1, str2) => {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
};

/**
 * Levenshtein distance between two strings
 */
const levenshteinDistance = (str1, str2) => {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * Detect stuttering patterns in transcript
 */
export const detectStuttering = (userWords) => {
  if (!Array.isArray(userWords)) return 0;

  let stutterCount = 0;

  for (let i = 0; i < userWords.length - 1; i++) {
    // Check if consecutive words start with same letters
    if (
      userWords[i].length > 1 &&
      userWords[i + 1].length > 1 &&
      userWords[i][0] === userWords[i + 1][0]
    ) {
      stutterCount++;
    }
  }

  return stutterCount;
};

/**
 * Generate personalized pronunciation recommendations
 */
export const generatePronunciationRecommendations = (analysis) => {
  const recommendations = [];

  // Accuracy recommendations
  if (analysis.accuracy < 0.7) {
    recommendations.push({
      type: 'accuracy',
      priority: 'high',
      message: '📝 Focus on saying each word clearly. Try reading slower.',
      action: 'slow_down'
    });
  } else if (analysis.accuracy < 0.85) {
    recommendations.push({
      type: 'accuracy',
      priority: 'medium',
      message: '⭐ Good effort! Practice tricky words individually.',
      action: 'word_drills'
    });
  } else {
    recommendations.push({
      type: 'accuracy',
      priority: 'low',
      message: '✨ Excellent pronunciation!',
      action: 'maintain'
    });
  }

  // Confidence recommendations
  if (analysis.confidence < 50) {
    recommendations.push({
      type: 'confidence',
      priority: 'high',
      message: '🎤 Speak louder and closer to the microphone.',
      action: 'volume_up'
    });
  }

  // Speaking rate recommendations
  if (analysis.speakingRate < 80) {
    recommendations.push({
      type: 'pace',
      priority: 'medium',
      message: '⏱️ Try to read a bit faster - you\'re reading slowly.',
      action: 'increase_pace'
    });
  } else if (analysis.speakingRate > 180) {
    recommendations.push({
      type: 'pace',
      priority: 'medium',
      message: '⏱️ Slow down a bit - you\'re reading too fast.',
      action: 'decrease_pace'
    });
  }

  // Skipped words
  if (analysis.skippedWords.length > 0) {
    recommendations.push({
      type: 'skipped_words',
      priority: 'high',
      message: `📌 You skipped ${analysis.skippedWords.length} word(s). Read every word.`,
      action: 'focus_all_words'
    });
  }

  // Mispronounced words
  if (analysis.mispronounced.length > 0) {
    recommendations.push({
      type: 'pronunciation',
      priority: 'medium',
      message: `🔤 ${analysis.mispronounced.length} word(s) may need work. Practice these individually.`,
      action: 'drill_words',
      targetWords: analysis.mispronounced.map((m) => m.expected)
    });
  }

  return recommendations;
};

/**
 * Calculate severity score for pronunciation issues
 */
export const calculateIssueSeverity = (analysis) => {
  let severity = 0;

  // Accuracy weight (40%)
  if (analysis.accuracy < 0.5) severity += 40;
  else if (analysis.accuracy < 0.7) severity += 20;
  else if (analysis.accuracy < 0.85) severity += 10;

  // Confidence weight (20%)
  if (analysis.confidence < 50) severity += 20;
  else if (analysis.confidence < 70) severity += 10;

  // Rate weight (20%)
  if (analysis.speakingRate < 80 || analysis.speakingRate > 180) {
    severity += 10;
  }

  // Issues weight (20%)
  const issueCount = analysis.issues.length;
  severity += Math.min((issueCount / 5) * 20, 20);

  return Math.min(severity, 100);
};

/**
 * Helper to round to specific decimals
 */
const precision = (num, decimals) => {
  return parseFloat(num.toFixed(decimals));
};
