/**
 * reEvaluationScheduler.js — Bounded scheduling of engine re-evaluations (Task 6)
 *
 * The engine returns `plan.reEvaluateAt` (confirmation windows, minimum
 * durations, periodic review). The runtime refreshes the context snapshot at
 * that time. Without a bound, a decision whose re-evaluation time is already
 * due (or keeps being rescheduled immediately) would refresh at the minimum
 * delay forever — a runaway loop. This scheduler keeps exactly one pending
 * timer, clamps the delay, and caps the number of scheduled refreshes in a
 * sliding window; once the budget is spent, scheduling resumes only after the
 * window has passed (ordinary user / context changes still re-decide).
 *
 * Ownership: Adaptive Experience Engineer
 */

export const RE_EVALUATION_LIMITS = Object.freeze({
  minDelayMs: 1000,
  maxDelayMs: 10 * 60 * 1000,
  maxRefreshesPerWindow: 12,
  windowMs: 60 * 1000,
});

/**
 * @param {object} options
 * @param {() => void} options.refresh - Called when a re-evaluation is due.
 * @param {() => number} [options.now]
 * @param {(fn: () => void, ms: number) => any} [options.setTimer]
 * @param {(handle: any) => void} [options.clearTimer]
 * @param {Partial<typeof RE_EVALUATION_LIMITS>} [options.limits]
 */
export function createReEvaluationScheduler({
  refresh,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
  limits = {},
} = {}) {
  const config = { ...RE_EVALUATION_LIMITS, ...limits };
  let handle = null;
  let fired = [];

  const cancel = () => {
    if (handle !== null) clearTimer(handle);
    handle = null;
  };

  return {
    /**
     * Schedule a refresh at `reEvaluateAt` (epoch ms); replaces any pending
     * one. Returns whether a timer was scheduled.
     */
    schedule(reEvaluateAt) {
      cancel();
      if (typeof reEvaluateAt !== "number" || !Number.isFinite(reEvaluateAt) || typeof refresh !== "function") {
        return false;
      }
      const at = now();
      fired = fired.filter((time) => at - time < config.windowMs);
      if (fired.length >= config.maxRefreshesPerWindow) return false; // budget spent
      const delay = Math.min(Math.max(reEvaluateAt - at, config.minDelayMs), config.maxDelayMs);
      handle = setTimer(() => {
        handle = null;
        fired.push(now());
        refresh();
      }, delay);
      return true;
    },
    cancel,
    /** Clear the pending timer and the budget (user switch / unmount). */
    reset() {
      cancel();
      fired = [];
    },
    pending: () => handle !== null,
  };
}
