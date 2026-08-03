/**
 * uiAdapter.js — UI Adapter / UI executor (Phase 3)
 *
 * Translates adaptation decisions into the actual user experience.
 *
 * The adapter is a UI EXECUTOR only. It consumes `AdaptationAction` objects
 * produced by the Planner (target === "UI") and maps them to a concrete UI
 * configuration. It never decides what to adapt, and it never mutates
 * UserState or module domain state.
 *
 * Supported UI modes:
 * - normal: Full interface with all options
 * - focus: Streamlined for task completion
 * - minimal: Reduced choices, primary action only
 * - low_stimulation: Reduced animation, color, density
 * - overwhelm: Emergency simplification
 * - guided: Step-by-step with heavy guidance
 * - reading: Optimized for text consumption
 * - high_contrast: Enhanced visibility
 *
 * Fail-safe behavior: an action with an unknown mode is rejected with a
 * structured error instead of silently applying a different mode.
 *
 * Ownership: Adaptive Experience Engineer
 */

import { AdaptationActionType, AdaptationDimension } from "@/support/schemas/supportSchemas";

/**
 * @typedef {object} UIConfiguration
 * @property {string} mode - The active UI mode
 * @property {number} complexity - Information density (0-1)
 * @property {boolean} animations - Whether animations are enabled
 * @property {boolean} reducedMotion - Reduced motion mode
 * @property {number} visibleModules - Number of modules to show
 * @property {string} navigationStyle - "full" | "simplified" | "minimal"
 * @property {object} typography - Typography overrides
 * @property {object} colors - Color overrides
 */

/**
 * The canonical UI modes this adapter knows how to execute.
 */
export const SUPPORTED_UI_MODES = {
  normal: "normal",
  focus: "focus",
  minimal: "minimal",
  low_stimulation: "low_stimulation",
  overwhelm: "overwhelm",
  guided: "guided",
  reading: "reading",
  high_contrast: "high_contrast",
};

/**
 * Mode → UIConfiguration. Entries are the source of truth for both the
 * legacy `adaptUI(uiMode)` surface and the action executor.
 */
export const MODE_CONFIGURATIONS = {
  normal: {
    mode: "normal",
    complexity: 1.0,
    animations: true,
    reducedMotion: false,
    visibleModules: 8,
    navigationStyle: "full",
    typography: {},
    colors: {},
  },
  focus: {
    mode: "focus",
    complexity: 0.5,
    animations: true,
    reducedMotion: false,
    visibleModules: 1,
    navigationStyle: "simplified",
    typography: {},
    colors: {},
  },
  minimal: {
    mode: "minimal",
    complexity: 0.3,
    animations: true,
    reducedMotion: false,
    visibleModules: 2,
    navigationStyle: "minimal",
    typography: {},
    colors: {},
  },
  low_stimulation: {
    mode: "low_stimulation",
    complexity: 0.6,
    animations: false,
    reducedMotion: true,
    visibleModules: 4,
    navigationStyle: "simplified",
    typography: {},
    colors: {},
  },
  overwhelm: {
    mode: "overwhelm",
    complexity: 0.1,
    animations: false,
    reducedMotion: true,
    visibleModules: 1,
    navigationStyle: "minimal",
    typography: {},
    colors: {},
  },
  guided: {
    mode: "guided",
    complexity: 0.4,
    animations: true,
    reducedMotion: false,
    visibleModules: 3,
    navigationStyle: "simplified",
    typography: {},
    colors: {},
  },
  reading: {
    mode: "reading",
    complexity: 0.5,
    animations: true,
    reducedMotion: false,
    visibleModules: 5,
    navigationStyle: "simplified",
    typography: { letterSpacing: "wide", lineHeight: "relaxed" },
    colors: {},
  },
  high_contrast: {
    mode: "high_contrast",
    complexity: 0.8,
    animations: true,
    reducedMotion: false,
    visibleModules: 8,
    navigationStyle: "full",
    typography: {},
    colors: { contrast: "high" },
  },
};

/**
 * Return a fresh copy of the configuration for a mode (callers may mutate it).
 * @param {string} mode
 * @returns {UIConfiguration}
 */
export function buildConfig(mode) {
  const source = MODE_CONFIGURATIONS[mode] ?? MODE_CONFIGURATIONS.normal;
  return {
    ...source,
    typography: { ...source.typography },
    colors: { ...source.colors },
  };
}

/**
 * Legacy surface: generate UI configuration from a UI mode string.
 * Unknown modes fail safely to `normal`.
 * @param {string} uiMode - The recommended UI mode
 * @param {import("../../../backend/adaptive/state/userStateModel.js").UserState} [userState]
 * @returns {UIConfiguration}
 */
export function adaptUI(uiMode, userState) {
  const mode = SUPPORTED_UI_MODES[uiMode] ? uiMode : SUPPORTED_UI_MODES.normal;
  return buildConfig(mode);
}

/**
 * Execute a single UI AdaptationAction.
 *
 * Accepts only `{ type: "MODIFY", target: "UI", parameters: { mode } }`.
 * Returns a structured result; unsupported/malformed actions fail safely
 * with an explicit error. Never mutates `userState` or module state, never
 * persists, never makes network requests.
 *
 * @param {import("../../../support/schemas/supportSchemas.js").AdaptationActionSchema} action
 * @param {import("../../../backend/adaptive/state/userStateModel.js").UserState} [userState]
 * @returns {{ ok: boolean, applied: boolean, actionId?: string, mode?: string, config?: UIConfiguration, error?: string }}
 */
export function adaptUIAction(action, userState) {
  const actionId = action?.actionId;
  const fail = (error) => ({ ok: false, applied: false, actionId, error });

  if (action === null || action === undefined || typeof action !== "object") {
    return fail("UI action is required");
  }
  if (action.target !== AdaptationDimension.UI) {
    return fail(`not a UI action (target: ${action.target ?? "missing"})`);
  }
  if (action.type !== AdaptationActionType.MODIFY) {
    return fail(`unsupported UI action type: ${action.type}`);
  }
  const mode = action.parameters?.mode;
  if (typeof mode !== "string" || mode.trim().length === 0) {
    return fail("UI action requires a non-empty parameters.mode");
  }
  if (!MODE_CONFIGURATIONS[mode]) {
    return fail(`unsupported UI mode: ${mode}`);
  }
  return { ok: true, applied: true, actionId, mode, config: buildConfig(mode) };
}

/**
 * Revert a reversible UI action back to the `normal` configuration.
 * Non-UI or non-reversible actions are rejected explicitly.
 *
 * @param {import("../../../support/schemas/supportSchemas.js").AdaptationActionSchema} action
 * @param {import("../../../backend/adaptive/state/userStateModel.js").UserState} [userState]
 * @returns {{ ok: boolean, reverted: boolean, actionId?: string, mode?: string, config?: UIConfiguration, alreadyNormal?: boolean, error?: string }}
 */
export function revertUIAction(action, userState) {
  const actionId = action?.actionId;
  const fail = (error) => ({ ok: false, reverted: false, actionId, error });

  if (action === null || action === undefined || typeof action !== "object") {
    return fail("UI action is required");
  }
  if (action.target !== AdaptationDimension.UI) {
    return fail(`not a UI action (target: ${action.target ?? "missing"})`);
  }
  if (action.reversible === false) {
    return fail("action is not reversible");
  }
  const mode = action.parameters?.mode;
  if (typeof mode === "string" && mode === SUPPORTED_UI_MODES.normal) {
    return {
      ok: true,
      reverted: true,
      alreadyNormal: true,
      actionId,
      mode: SUPPORTED_UI_MODES.normal,
      config: buildConfig(SUPPORTED_UI_MODES.normal),
    };
  }
  return {
    ok: true,
    reverted: true,
    actionId,
    mode: SUPPORTED_UI_MODES.normal,
    config: buildConfig(SUPPORTED_UI_MODES.normal),
  };
}

/**
 * Get CSS class modifications for a given UI configuration.
 * @param {UIConfiguration} config
 * @returns {object} CSS class overrides
 */
export function getUIClasses(config) {
  // TODO: Map configuration to Tailwind classes
  return {};
}
