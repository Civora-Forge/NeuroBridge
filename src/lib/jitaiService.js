/**
 * jitaiService.js — Module B: Just-In-Time Adaptive Intervention (JITAI)
 *
 * Architecture:
 *  In production this module connects to:
 *    • Apple HealthKit   (iOS)  — HRV via HKQuantityTypeIdentifierHeartRateVariabilitySDNN
 *    • Health Connect    (Android) — HRV via HealthPermission.HEART_RATE_VARIABILITY_RMSSD
 *    • Garmin Connect IQ (wearable) — EDA via Body Battery + StressLevel APIs
 *    • Device IMU        — accelerometer via DeviceMotionEvent (Web) or CMMotionManager (iOS)
 *
 *  This file provides a self-contained mock that:
 *    1. Simulates real-time HRV, EDA, and accelerometer readings with Brownian motion
 *    2. Runs a Trigger Detection Classifier every 3 seconds
 *    3. Emits typed intervention events to subscribers
 *
 * ─── Trigger Detection Logic ─────────────────────────────────────────────────
 *  Classifier rule table (can be replaced with trained ML model):
 *
 *  Condition                               | Intervention
 *  ----------------------------------------+--------------------------------
 *  HRV < 35ms  AND  repetitive movement    | ERP_DELAY_PROMPT    (OCD+DCD)
 *  EDA > 5μS   AND  repetitive movement    | ERP_DELAY_PROMPT    (OCD+DCD)
 *  HRV < 35ms  OR   EDA > 5μS  (no reps)  | SENSORY_CIRCUIT_BREAKER
 *  Repetitive movement only (low arousal)  | MOTOR_REST          (DCD)
 *  HRV 35-45ms AND  EDA 2-4μS            | GROUNDING           (mild alert)
 *
 * ─── Fading Tier Architecture (Module C bridge) ──────────────────────────────
 *  fadingTier: 1 = full AR overlay, 2 = outline only, 3 = ghost hands, 4 = none
 *  Tier advances when successfulMotorSequences >= TIER_THRESHOLDS[tier]
 */

export const JITAI_EVENTS = {
  /** OCD: Detected compulsive checking pattern + physiological arousal */
  ERP_DELAY_PROMPT: "erp_delay_prompt",
  /** General: Acute stress spike without repetitive movement — calming break */
  SENSORY_CIRCUIT_BREAKER: "sensory_circuit_breaker",
  /** DCD: Repetitive motions detected → rest before learned helplessness */
  MOTOR_REST: "motor_rest",
  /** Mild: Early-warning arousal — pre-empt escalation with grounding */
  GROUNDING: "grounding",
};

// AR fading tier thresholds (successful motor sequences needed to advance)
const TIER_THRESHOLDS = { 1: 0, 2: 5, 3: 12, 4: 25 };

// ─── Biometric simulation state ───────────────────────────────────────────────
let _state = {
  hrv: 65,              // ms   — healthy: 50–100. Stress: drops below 35
  eda: 0.8,             // μS   — baseline: 0.1–2. Acute stress: >5
  accelMag: 0.05,       // g    — ambient: <0.2. Repetitive movement: >0.8 sustained
  repetitiveCycles: 0,  // count of high-accel ticks in last 30-tick window
  successfulMotorSequences: 0,
  fadingTier: 1,
};

let _subscribers = new Set();
let _monitorId = null;
let _cooldownUntil = 0; // ms timestamp — suppress interventions during cooldown

/**
 * Brownian motion step for a value, clamped to [min, max].
 * sigma controls volatility.
 */
function _walk(value, sigma, min, max) {
  return Math.max(min, Math.min(max, value + (Math.random() - 0.5) * 2 * sigma));
}

function _generateReading() {
  _state.hrv          = _walk(_state.hrv, 4, 20, 100);
  _state.eda          = _walk(_state.eda, 0.25, 0.1, 12);
  _state.accelMag     = _walk(_state.accelMag, 0.12, 0.0, 2.0);

  // Repetitive cycle counter — high accel tick increments, decay otherwise
  if (_state.accelMag > 0.75) {
    _state.repetitiveCycles = Math.min(20, _state.repetitiveCycles + 1);
  } else {
    _state.repetitiveCycles = Math.max(0, _state.repetitiveCycles - 0.6);
  }

  return {
    hrv: +_state.hrv.toFixed(1),
    eda: +_state.eda.toFixed(2),
    accelMag: +_state.accelMag.toFixed(3),
    repetitiveCycles: Math.round(_state.repetitiveCycles),
    fadingTier: _state.fadingTier,
    timestamp: Date.now(),
  };
}

/**
 * Trigger Detection Classifier — rule-based.
 * Returns a JITAI_EVENTS constant or null if no intervention warranted.
 */
function _classify(reading) {
  const now = Date.now();
  if (now < _cooldownUntil) return null; // respect cooldown

  const highArousal = reading.hrv < 35 || reading.eda > 5;
  const mildArousal = reading.hrv < 48 || reading.eda > 2.5;
  const repetitive  = reading.repetitiveCycles > 8;

  let event = null;

  if (highArousal && repetitive) {
    // Classic OCD + DCD overlap: physiological spike while performing
    // repetitive motor behaviour — push ERP delay prompt
    event = JITAI_EVENTS.ERP_DELAY_PROMPT;
  } else if (highArousal) {
    event = JITAI_EVENTS.SENSORY_CIRCUIT_BREAKER;
  } else if (repetitive) {
    event = JITAI_EVENTS.MOTOR_REST;
  } else if (mildArousal) {
    event = JITAI_EVENTS.GROUNDING;
  }

  if (event) {
    // 90-second cooldown so interventions don't stack
    _cooldownUntil = now + 90_000;
  }

  return event;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the biometric monitor. Safe to call multiple times.
 * @param {number} intervalMs - polling interval (default 3000ms)
 */
export function startJITAIMonitor(intervalMs = 3000) {
  if (_monitorId != null) return;
  _monitorId = setInterval(() => {
    const reading = _generateReading();
    const intervention = _classify(reading);
    _subscribers.forEach((cb) => cb({ reading, intervention }));
  }, intervalMs);
}

/** Stop the monitor. */
export function stopJITAIMonitor() {
  if (_monitorId != null) {
    clearInterval(_monitorId);
    _monitorId = null;
  }
}

/**
 * Subscribe to biometric readings and intervention events.
 * @param {Function} callback - ({ reading, intervention }) => void
 * @returns {Function} unsubscribe function
 */
export function subscribeToJITAI(callback) {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

/**
 * Notify the service that the user completed a motor sequence successfully.
 * Used to advance the AR fading tier (Module C criterion-based fading).
 */
export function recordMotorSuccess() {
  _state.successfulMotorSequences += 1;
  // Advance fading tier when threshold hit
  const nextTier = _state.fadingTier + 1;
  if (nextTier <= 4 && _state.successfulMotorSequences >= TIER_THRESHOLDS[nextTier]) {
    _state.fadingTier = nextTier;
  }
}

/** Expose current fading tier for AR module. */
export function getFadingTier() {
  return _state.fadingTier;
}

/** TEST HELPER: inject a stress spike to verify intervention UI. */
export function simulateStressSpike() {
  _state.hrv             = 28;
  _state.eda             = 7.2;
  _state.repetitiveCycles = 14;
  _cooldownUntil         = 0; // reset cooldown so spike fires
}

/** TEST HELPER: inject repetitive-movement-only state. */
export function simulateRepetitiveMovement() {
  _state.hrv              = 60;
  _state.eda              = 1.2;
  _state.repetitiveCycles = 16;
  _cooldownUntil          = 0;
}

/** Get a snapshot of current biometric state (read-only). */
export function getBiometricSnapshot() {
  return { ..._state };
}
