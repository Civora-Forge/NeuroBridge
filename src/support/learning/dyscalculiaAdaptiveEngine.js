/**
 * Dyscalculia Adaptive Engine
 * 
 * Core system for tracking user performance and adapting module difficulty/presentation
 */

const DEFAULT_USER_PROFILE = {
  accuracy_rate: 0,
  hesitation_time: 0,
  error_patterns: [],
  preferred_representation: 'dots', // 'dots', 'blocks', 'number_line'
  anxiety_flag: false,
  session_count: 0,
  consecutive_correct: 0,
  consecutive_incorrect: 0,
  exit_count: 0,
  total_interaction_time: 0,
  representation_history: {},
  last_session_date: null,
};

const REPRESENTATION_TYPES = {
  DOTS: 'dots',
  BLOCKS: 'blocks',
  NUMBER_LINE: 'number_line'
};

const SCAFFOLD_LEVELS = {
  MINIMAL: 1,
  MODERATE: 2,
  FULL: 3
};

/**
 * Initialize or retrieve user math profile from localStorage
 */
export const initializeUserProfile = (userId = 'default') => {
  const storageKey = `dyscalculia_user_profile_${userId}`;
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to parse stored profile:', e);
  }
  
  const newProfile = { ...DEFAULT_USER_PROFILE };
  localStorage.setItem(storageKey, JSON.stringify(newProfile));
  return newProfile;
};

/**
 * Save user profile updates
 */
export const saveUserProfile = (profile, userId = 'default') => {
  const storageKey = `dyscalculia_user_profile_${userId}`;
  try {
    localStorage.setItem(storageKey, JSON.stringify(profile));
    return profile;
  } catch (e) {
    console.error('Failed to save user profile:', e);
    return profile;
  }
};

/**
 * Update accuracy metrics after response
 */
export const recordResponse = (profile, isCorrect, responseTimeMs, mathProblem) => {
  const updatedProfile = { ...profile };
  
  // Update consecutive counters
  if (isCorrect) {
    updatedProfile.consecutive_correct += 1;
    updatedProfile.consecutive_incorrect = 0;
  } else {
    updatedProfile.consecutive_incorrect += 1;
    updatedProfile.consecutive_correct = 0;
    updatedProfile.error_patterns.push({
      problem: mathProblem,
      timestamp: new Date().toISOString()
    });
  }
  
  // Update hesitation time (rolling average)
  if (updatedProfile.hesitation_time === 0) {
    updatedProfile.hesitation_time = responseTimeMs;
  } else {
    updatedProfile.hesitation_time = 
      (updatedProfile.hesitation_time * 0.7) + (responseTimeMs * 0.3);
  }
  
  // Update overall accuracy rate
  const totalAttempts = updatedProfile.session_count + 1;
  const currentCorrect = Math.round(updatedProfile.accuracy_rate * updatedProfile.session_count);
  updatedProfile.accuracy_rate = (currentCorrect + (isCorrect ? 1 : 0)) / totalAttempts;
  updatedProfile.session_count = totalAttempts;
  
  updatedProfile.total_interaction_time += responseTimeMs;
  updatedProfile.last_session_date = new Date().toISOString();
  
  return updatedProfile;
};

/**
 * Determine if visual aids should be enabled based on performance
 */
export const shouldEnableVisualAids = (profile) => {
  // Enable if 2+ consecutive errors on symbolic form
  if (profile.consecutive_incorrect >= 2) {
    return true;
  }
  
  // Enable if accuracy drops below 50%
  if (profile.accuracy_rate < 0.5) {
    return true;
  }
  
  // Enable if hesitation time is very high (>5s)
  if (profile.hesitation_time > 5000) {
    return true;
  }
  
  return false;
};

/**
 * Determine if visual aids can be reduced based on consistent success
 */
export const canReduceVisualAids = (profile) => {
  // Only reduce if 3+ consecutive correct AND accuracy >75%
  return profile.consecutive_correct >= 3 && profile.accuracy_rate >= 0.75;
};

/**
 * Determine scaffold level based on performance
 */
export const determineScaffoldLevel = (profile) => {
  if (profile.consecutive_incorrect >= 3 || profile.accuracy_rate < 0.4) {
    return SCAFFOLD_LEVELS.FULL; // Max support
  }
  
  if (profile.consecutive_incorrect >= 1 || profile.accuracy_rate < 0.65) {
    return SCAFFOLD_LEVELS.MODERATE; // Medium support
  }
  
  return SCAFFOLD_LEVELS.MINIMAL; // Minimal support
};

/**
 * Check if Calm Mode should be triggered
 */
export const shouldActivateCalmMode = (profile) => {
  // Trigger if exited 2+ times mid-session
  if (profile.exit_count >= 2) {
    return true;
  }
  
  // Trigger if 3+ consecutive incorrect
  if (profile.consecutive_incorrect >= 3) {
    return true;
  }
  
  // Trigger if hesitation time >8 seconds
  if (profile.hesitation_time > 8000) {
    return true;
  }
  
  // Explicit anxiety flag
  if (profile.anxiety_flag) {
    return true;
  }
  
  return false;
};

/**
 * Record session exit for anxiety tracking
 */
export const recordSessionExit = (profile) => {
  const updatedProfile = { ...profile };
  updatedProfile.exit_count += 1;
  return updatedProfile;
};

/**
 * Set/update preference for visual representation
 */
export const setPreferredRepresentation = (profile, representation) => {
  const updatedProfile = { ...profile };
  updatedProfile.preferred_representation = representation;
  
  // Track history
  updatedProfile.representation_history[representation] = 
    (updatedProfile.representation_history[representation] || 0) + 1;
  
  return updatedProfile;
};

/**
 * Get adaptive difficulty configuration based on profile
 */
export const getAdaptiveDifficulty = (profile, baseDifficulty = 'intermediate') => {
  if (profile.accuracy_rate < 0.4) {
    return 'beginner';
  }
  
  if (profile.accuracy_rate >= 0.8 && profile.consecutive_correct >= 3) {
    return 'advanced';
  }
  
  return baseDifficulty;
};

/**
 * Get all adaptive recommendations based on current profile
 */
export const getAdaptiveRecommendations = (profile) => {
  const recommendations = {
    visual_aids_enabled: shouldEnableVisualAids(profile),
    calm_mode_active: shouldActivateCalmMode(profile),
    can_reduce_scaffolding: canReduceVisualAids(profile),
    scaffold_level: determineScaffoldLevel(profile),
    difficulty: getAdaptiveDifficulty(profile),
    preferred_representation: profile.preferred_representation,
    number_sense_reduction: profile.consecutive_correct >= 3,
    anxiety_support_needed: profile.consecutive_incorrect >= 2 || profile.exit_count >= 1,
  };
  
  return recommendations;
};

/**
 * Reset session counters (for between activities)
 */
export const resetSessionCounters = (profile) => {
  const updatedProfile = { ...profile };
  updatedProfile.consecutive_correct = 0;
  updatedProfile.consecutive_incorrect = 0;
  updatedProfile.exit_count = 0;
  return updatedProfile;
};

export default {
  DEFAULT_USER_PROFILE,
  REPRESENTATION_TYPES,
  SCAFFOLD_LEVELS,
  initializeUserProfile,
  saveUserProfile,
  recordResponse,
  shouldEnableVisualAids,
  canReduceVisualAids,
  determineScaffoldLevel,
  shouldActivateCalmMode,
  recordSessionExit,
  setPreferredRepresentation,
  getAdaptiveDifficulty,
  getAdaptiveRecommendations,
  resetSessionCounters,
};
