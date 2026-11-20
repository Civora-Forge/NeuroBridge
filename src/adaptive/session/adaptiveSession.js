/**
 * adaptiveSession.js — Sign-out / privacy boundary for adaptive state (Task 6)
 *
 * `clearAllLocalAppData()` wipes NeuroBridge's localStorage keys on sign-out,
 * but the adaptive system also keeps state in memory and sessionStorage:
 *   - consent decisions / recommendation dismissals (sessionStorage),
 *   - per-user hysteresis state (memory),
 *   - the Task 4 learning memory fallback (memory, when storage failed),
 *   - the Task 5 profile cache and temporary "for now" state (memory).
 * `resetAdaptiveSession(userId)` clears all of it so nothing survives into the
 * next user's session in the same tab. Account copies (Supabase) are not
 * touched — signing out is not deleting.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import { resetExecutionStore } from "@/adaptive/execution/uiExecution";
import { clearAdaptationLearning } from "@/adaptive/learning/adaptationLearning";
import { clearPersonalizationSession } from "@/adaptive/personalization/profileStore";
import { clearAdaptiveHysteresis, resetAdaptiveHysteresis } from "@backend/adaptive/engine/hysteresis";

export function resetAdaptiveSession(userId) {
  const steps = [
    () => resetExecutionStore(),
    () => (userId ? clearAdaptiveHysteresis(userId) : resetAdaptiveHysteresis()),
    () => clearAdaptiveHysteresis("default"),
    () => userId && clearAdaptationLearning(userId),
    () => clearPersonalizationSession(),
  ];
  for (const step of steps) {
    try {
      step();
    } catch {
      // Best effort: one failing store must not keep the others populated.
    }
  }
}
