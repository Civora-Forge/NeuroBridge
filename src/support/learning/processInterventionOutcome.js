import { deriveMemoryFromReflections, isLearningEnabled } from "@/support/memory";
import { reflectIntervention } from "@/support/reflection";
import { reflectFocusIntervention } from "@/support/reflection";

const REFLECTABLE_STATUSES = new Set(["completed", "partially_completed", "abandoned"]);

/**
 * Runs post-terminal learning without allowing optional learning failures to affect care delivery.
 */
export function processInterventionOutcome(intervention) {
  const result = { attempted: false, reflection: null, memory: null, errors: [] };
  if (!intervention?.userId || !intervention?.moduleId || !REFLECTABLE_STATUSES.has(intervention.status)) {
    return { ...result, skipped: "not_reflectable" };
  }
  if (!isLearningEnabled(intervention.userId)) return { ...result, skipped: "learning_disabled" };

  result.attempted = true;
  try {
    result.reflection = reflectIntervention(intervention);
  } catch (error) {
    result.errors.push({ stage: "reflection", message: error instanceof Error ? error.message : "Reflection failed" });
    return result;
  }
  try {
    result.memory = deriveMemoryFromReflections(intervention.userId, intervention.moduleId);
  } catch (error) {
    result.errors.push({ stage: "memory", message: error instanceof Error ? error.message : "Memory derivation failed" });
  }
  return result;
}

export async function processFocusInterventionOutcome(intervention, options = {}) {
  const result = { attempted: false, reflection: null, memory: null, errors: [] };
  if (!intervention?.userId || intervention?.moduleId !== "support.focus_session" || !new Set([...REFLECTABLE_STATUSES, "rated"]).has(intervention.status)) {
    return { ...result, skipped: "not_reflectable" };
  }
  if (!isLearningEnabled(intervention.userId)) return { ...result, skipped: "learning_disabled" };

  result.attempted = true;
  try {
    result.reflection = await reflectFocusIntervention(intervention, options);
  } catch (error) {
    result.errors.push({ stage: "reflection", message: error instanceof Error ? error.message : "Reflection failed" });
    return result;
  }
  try {
    result.memory = deriveMemoryFromReflections(intervention.userId, intervention.moduleId);
  } catch (error) {
    result.errors.push({ stage: "memory", message: error instanceof Error ? error.message : "Memory derivation failed" });
  }
  return result;
}
