/**
 * featureFlags.js — Adaptive Engine feature flags (Phase 3)
 *
 * Smallest local flag mechanism for the Adaptive Engine runtime and the UI
 * adaptive execution path. No repository-wide feature-flag convention
 * existed at Phase 3 exploration time, so this module owns two boolean
 * switches and both are OFF by default.
 *
 * Defaults (must not be changed without explicit approval):
 *   - Adaptive Engine runtime: OFF
 *   - UI adaptive execution:   OFF
 *
 * Activation is explicit and never automatic:
 *   - Runtime decisions can be produced by calling `decide()` directly in
 *     tests/integration without enabling any flag.
 *   - Live UI adaptation in the application stays OFF until a caller enables
 *     `uiExecution` (Phase 4 wiring), so existing rendering is unchanged.
 *
 * Tests flip switches via configureAdaptiveFlags() and restore the product
 * defaults with resetAdaptiveFlags().
 *
 * Ownership: Adaptive Intelligence Engineer
 */

const DEFAULT_STATE = {
  runtime: false,
  uiExecution: false,
};

let state = { ...DEFAULT_STATE };

/**
 * Whether the Adaptive Engine runtime decision path is enabled for live use.
 * @returns {boolean}
 */
export function isAdaptiveRuntimeEnabled() {
  return state.runtime;
}

/**
 * Whether UI adaptive execution is enabled. When false, the executor treats
 * every UI action as intentionally skipped and never touches the UI.
 * @returns {boolean}
 */
export function isUIExecutionEnabled() {
  return state.uiExecution;
}

/**
 * Set flags explicitly. Returns the previous state so callers can restore it.
 * @param {{ runtime?: boolean, uiExecution?: boolean }} [overrides]
 * @returns {{ runtime: boolean, uiExecution: boolean }}
 */
export function configureAdaptiveFlags(overrides = {}) {
  const previous = { runtime: state.runtime, uiExecution: state.uiExecution };
  if (typeof overrides.runtime === "boolean") {
    state.runtime = overrides.runtime;
  }
  if (typeof overrides.uiExecution === "boolean") {
    state.uiExecution = overrides.uiExecution;
  }
  return previous;
}

/**
 * Restore the product defaults (both OFF).
 */
export function resetAdaptiveFlags() {
  state = { ...DEFAULT_STATE };
}
