/**
 * featureFlags.js — Adaptive Engine feature flags (Phase 3)
 *
 * Smallest local flag mechanism for the Adaptive Engine runtime, the UI
 * adaptive execution path, and the reflection wiring. No repository-wide
 * feature-flag convention existed at Phase 3 exploration time, so this module
 * owns three boolean switches and all are OFF by default.
 *
 * Defaults (must not be changed without explicit approval):
 *   - Adaptive Engine runtime: OFF
 *   - UI adaptive execution:   OFF
 *   - Reflection engine wiring: OFF
 *
 * Activation is explicit and never automatic:
 *   - Runtime decisions can be produced by calling `decide()` directly in
 *     tests/integration without enabling any flag.
 *   - Live UI adaptation in the application stays OFF until a caller enables
 *     `uiExecution` (Phase 4 wiring), so existing rendering is unchanged.
 *   - Reflection (Phase 5) is explicit-only: `reflect()` is a pure function
 *     that never runs inside `decide()`. The `reflection` switch gates the
 *     live `reflectUserHistory()` caller, so when it is OFF no learned
 *     signals are produced and none can be injected into decisions.
 *
 * Tests flip switches via configureAdaptiveFlags() and restore the product
 * defaults with resetAdaptiveFlags().
 *
 * Ownership: Adaptive Intelligence Engineer
 */

const DEFAULT_STATE = {
  runtime: false,
  uiExecution: false,
  reflection: false,
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
 * Whether the live reflection caller (`reflectUserHistory`) may run. When
 * false, reflection produces no signals and no learned personalization is
 * injected into runtime decisions. The pure reflection functions are not
 * gated — they are deterministic computation.
 * @returns {boolean}
 */
export function isReflectionEnabled() {
  return state.reflection;
}

/**
 * Set flags explicitly. Returns the previous state so callers can restore it.
 * @param {{ runtime?: boolean, uiExecution?: boolean, reflection?: boolean }} [overrides]
 * @returns {{ runtime: boolean, uiExecution: boolean, reflection: boolean }}
 */
export function configureAdaptiveFlags(overrides = {}) {
  const previous = {
    runtime: state.runtime,
    uiExecution: state.uiExecution,
    reflection: state.reflection,
  };
  if (typeof overrides.runtime === "boolean") {
    state.runtime = overrides.runtime;
  }
  if (typeof overrides.uiExecution === "boolean") {
    state.uiExecution = overrides.uiExecution;
  }
  if (typeof overrides.reflection === "boolean") {
    state.reflection = overrides.reflection;
  }
  return previous;
}

/**
 * Restore the product defaults (all switches OFF).
 */
export function resetAdaptiveFlags() {
  state = { ...DEFAULT_STATE };
}
