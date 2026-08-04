/**
 * safetyGate.js — Production safety gate for the Adaptive Engine (D5)
 *
 * Closes the Phase 3 deviation where the engine's Safety stage defaulted to
 * ALLOW for every candidate and never consulted the existing safety primitive.
 *
 * This gate reuses `assessSupportSafety` from `src/support/framework/
 * interventionSelection.js` (spec §12; export location preserved, no move) and
 * maps its result onto the engine's SafetyResult contract:
 *
 *   - level standard  → disposition ALLOW
 *   - level caution   → disposition MODIFY (generic guardrails attached)
 *   - level escalate  → disposition ESCALATE (candidate removed from the
 *                       executable plan; the caller must surface it)
 *   - allowed:false   → disposition BLOCK (defensive, non-escalation case)
 *
 * Fail-closed behavior (spec hardening): if the underlying safety primitive
 * throws or returns an unusable result, the gate produces a BLOCK/ESCALATE
 * result with reason `safety_check_unavailable` — it never silently ALLOWs.
 *
 * `moduleContext.safetyLevel` acts as a floor (spec §12 "(+module safetyLevel)"):
 * a module that declares CAUTION raises ALLOW results to MODIFY, and a module
 * that declares ESCALATE blocks its own candidates regardless of the textual
 * assessment. Safety outranks every policy tier because this stage runs after
 * conflict/preference and removes BLOCK/ESCALATE candidates before planning.
 *
 * The gate is deterministic (no clock, no persistence) and passes only
 * module-declared metadata (moduleId / safetyLevel / interventionTypes) plus
 * the engine's own reason string to the safety primitive — never raw PHI.
 *
 * DI is preserved: callers may still inject `options.safety` into `decide()`;
 * when absent the engine uses this production default.
 *
 * Ownership: Adaptive Intelligence Engineer
 */

import {
  SafetyLevel,
  SafetyResultSchema,
} from "@/support/schemas/supportSchemas";
import { assessSupportSafety } from "@/support/framework/interventionSelection";

/** Generic guardrails attached when a candidate is lowered to MODIFY. */
const CAUTION_GUARDRAILS = {
  reducedIntensity: true,
  requireConfirmation: true,
};

const MODULE_LEVEL_SEVERITY = {
  [SafetyLevel.STANDARD]: 0,
  [SafetyLevel.CAUTION]: 1,
  [SafetyLevel.ESCALATE]: 2,
};

const MODULE_LEVEL_DISPOSITION = {
  [SafetyLevel.CAUTION]: "MODIFY",
  [SafetyLevel.ESCALATE]: "ESCALATE",
};

const UNKNOWN_LEVEL_RESULT = {
  level: SafetyLevel.ESCALATE,
  disposition: "BLOCK",
  reasons: ["unknown_safety_level"],
  guardrails: {},
};

const UNAVAILABLE_RESULT = {
  level: SafetyLevel.ESCALATE,
  disposition: "BLOCK",
  reasons: ["safety_check_unavailable"],
  guardrails: {},
  suggestedAction: "Blocked: the safety gate could not run for this candidate.",
};

/**
 * Deterministic textual input for `assessSupportSafety`, built only from the
 * engine's own generic action vocabulary (target + mode) and the reason string
 * produced by the planner. Contains no user-identifiable content.
 */
function buildActionRequest(entry) {
  const parts = [];
  if (typeof entry?.action?.target === "string") {
    parts.push(entry.action.target);
  }
  const mode = entry?.action?.parameters?.mode;
  if (typeof mode === "string" && mode.trim().length > 0) {
    parts.push(mode);
  }
  if (typeof entry?.reason === "string" && entry.reason.trim().length > 0) {
    parts.push(entry.reason);
  }
  return parts.join(" ");
}

/**
 * The context passed to the safety primitive is restricted to module-declared
 * metadata. No snapshot, no UserState, no PHI.
 */
function buildSafetyContext(moduleContext) {
  if (moduleContext === null || typeof moduleContext !== "object") {
    return {};
  }
  const context = {};
  if (typeof moduleContext.moduleId === "string") {
    context.moduleId = moduleContext.moduleId;
  }
  if (typeof moduleContext.safetyLevel === "string") {
    context.safetyLevel = moduleContext.safetyLevel;
  }
  if (Array.isArray(moduleContext.interventionTypes)) {
    context.interventionTypes = moduleContext.interventionTypes;
  }
  return context;
}

/** Map an assessSupportSafety result onto the SafetyResult contract. */
function mapAssessment(assessment) {
  if (assessment === null || typeof assessment !== "object") {
    return { ...UNKNOWN_LEVEL_RESULT };
  }
  const reasons = Array.isArray(assessment.reasonCodes)
    ? assessment.reasonCodes
    : [];
  const message =
    typeof assessment.message === "string" && assessment.message.length > 0
      ? assessment.message
      : undefined;

  let result;
  switch (assessment.level) {
    case SafetyLevel.STANDARD:
      result = {
        level: SafetyLevel.STANDARD,
        disposition: "ALLOW",
        reasons,
        guardrails: {},
      };
      break;
    case SafetyLevel.CAUTION:
      result = {
        level: SafetyLevel.CAUTION,
        disposition: "MODIFY",
        reasons,
        guardrails: { ...CAUTION_GUARDRAILS },
      };
      break;
    case SafetyLevel.ESCALATE:
      result = {
        level: SafetyLevel.ESCALATE,
        disposition: "ESCALATE",
        reasons,
        guardrails: {},
      };
      break;
    default:
      return { ...UNKNOWN_LEVEL_RESULT };
  }

  if (message !== undefined) {
    result.suggestedAction = message;
  }

  // `allowed: false` at a non-escalation level (defensive) still blocks.
  if (assessment.allowed === false && result.disposition !== "ESCALATE") {
    return {
      ...result,
      level: SafetyLevel.ESCALATE,
      disposition: "BLOCK",
      reasons: [...result.reasons, "safety_disallowed"],
    };
  }
  return result;
}

/** Raise a result to the module-declared safetyLevel floor. */
function applyModuleFloor(result, moduleContext) {
  const moduleLevel = moduleContext?.safetyLevel;
  if (typeof moduleLevel !== "string" || !(moduleLevel in MODULE_LEVEL_SEVERITY)) {
    return result;
  }
  if (MODULE_LEVEL_SEVERITY[moduleLevel] <= MODULE_LEVEL_SEVERITY[result.level]) {
    return result;
  }
  const raised = {
    ...result,
    level: moduleLevel,
    disposition: MODULE_LEVEL_DISPOSITION[moduleLevel],
    reasons: [...result.reasons, `module_safety_level:${moduleLevel}`],
  };
  if (moduleLevel === SafetyLevel.CAUTION) {
    raised.guardrails = { ...CAUTION_GUARDRAILS };
  }
  return raised;
}

/**
 * Production safety gate. Signature matches the engine's Safety extension
 * point: `(entry, moduleContext) => SafetyResult`.
 *
 * @param {object} entry - A triggered-policy entry (policy-apply output).
 * @param {object|null} moduleContext - ModuleContext (may be null/generic).
 * @returns {import("../../../support/schemas/supportSchemas.js").SafetyResultSchema}
 */
export function safetyGate(entry, moduleContext) {
  try {
    const assessment = assessSupportSafety({
      explicitRequest: buildActionRequest(entry),
      context: buildSafetyContext(moduleContext),
    });
    return SafetyResultSchema.parse(applyModuleFloor(mapAssessment(assessment), moduleContext));
  } catch {
    return { ...UNAVAILABLE_RESULT };
  }
}

/**
 * Object-form surface mirroring the engine's `engine.safety` wording.
 */
export const engineSafety = { evaluate: safetyGate };
