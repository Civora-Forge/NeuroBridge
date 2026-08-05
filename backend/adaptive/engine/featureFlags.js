/**
 * featureFlags.js — Adaptive Engine feature flags (Phase 3)
 *
 * Smallest local flag mechanism for the Adaptive Engine runtime, the UI
 * adaptive execution path, and the reflection wiring. No repository-wide
 * feature-flag convention existed at Phase 3 exploration time, so this module
 * owns three boolean switches.
 *
 * Activation is explicit and config-driven, never hardcoded ON: each switch's
 * product default is read from the Vite environment (`VITE_NEUROBRIDGE_ADAPTIVE_*`)
 * at module load and defaults to OFF when unset. Production activation is
 * expressed in `.env.production` (currently only stage A: `runtime`), so it
 * can be rolled back by editing config without touching code.
 *
 * Staged activation plan:
 *   - Stage A (current): `runtime` ON for production builds via config. The
 *     live app produces decisions + traces only; it never auto-executes
 *     (execution is the explicit `execute()` step, gated by `uiExecution`).
 *   - Stage B (future): `reflection` — learned signals feeding Tier 9.
 *   - Stage C (future): `uiExecution` — UI executor applying actions to live
 *     rendering. Deliberately OFF: changing live rendering behind a flag still
 *     needs the executor integration review; unsupported executors (timing /
 *     notification / assistance / content / task / interaction / pacing) have
 *     no implementation and stay OFF.
 *
 * The pure resolver `resolveDefaultFlags(env)` is exported for tests; the
 * module default reads the real environment. `decide()` itself is flag-free:
 * tests/integration may call it directly regardless of switch state.
 *
 * Tests flip switches via configureAdaptiveFlags() and restore the product
 * defaults (the env-driven defaults) with resetAdaptiveFlags().
 *
 * Ownership: Adaptive Intelligence Engineer
 */

function readEnv() {
  try {
    if (typeof import.meta === "undefined" || !import.meta.env) return {};
    return import.meta.env;
  } catch {
    return {};
  }
}

function flagFromEnv(env, name) {
  if (env === null || typeof env !== "object") return false;
  const value = env[name];
  return value === true || value === "true" || value === "1";
}

/**
 * Resolve the product defaults from an environment object. Pure and
 * deterministic; honors `true`, `"true"`, and `"1"`, and defaults OFF for
 * anything else.
 * @param {object} [env] - Environment record (defaults to `import.meta.env`).
 * @returns {{ runtime: boolean, uiExecution: boolean, reflection: boolean }}
 */
export function resolveDefaultFlags(env = readEnv()) {
  return {
    runtime: flagFromEnv(env, "VITE_NEUROBRIDGE_ADAPTIVE_RUNTIME"),
    uiExecution: flagFromEnv(env, "VITE_NEUROBRIDGE_ADAPTIVE_UI_EXECUTION"),
    reflection: flagFromEnv(env, "VITE_NEUROBRIDGE_ADAPTIVE_REFLECTION"),
  };
}

const DEFAULT_STATE = resolveDefaultFlags();

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
