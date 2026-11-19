import { deriveMemoryFromReflections, isLearningEnabled } from "@/support/memory";
import { getRole4Repository } from "@/support/persistence/role4Repository";
import { reflectInterventionAsync } from "@/support/reflection";
import { reflectFocusIntervention } from "@/support/reflection";

const REFLECTABLE_STATUSES = new Set(["completed", "partially_completed", "abandoned"]);

/**
 * Runs post-terminal learning without allowing optional learning failures to affect care delivery.
 */
export async function processInterventionOutcome(intervention, options = {}) {
  const result = { attempted: false, reflection: null, memory: null, errors: [] };
  if (!intervention?.userId || !intervention?.moduleId || !REFLECTABLE_STATUSES.has(intervention.status)) {
    return { ...result, skipped: "not_reflectable" };
  }
  if (!isLearningEnabled(intervention.userId)) return { ...result, skipped: "learning_disabled" };

  result.attempted = true;
  const repository = options.repository || await getRole4Repository(intervention.userId);
  try {
    result.reflection = await reflectInterventionAsync(intervention, { repository });
  } catch (error) {
    result.errors.push({ stage: "reflection", message: error instanceof Error ? error.message : "Reflection failed" });
    return result;
  }
  try {
    const [reflections, memories] = await Promise.all([
      repository.listReflections(intervention.userId, intervention.moduleId),
      repository.listMemories(intervention.userId, intervention.moduleId),
    ]);
    const memoriesById = new Map(memories.map((memory) => [memory.id, memory]));
    result.memory = deriveMemoryFromReflections(intervention.userId, intervention.moduleId, {
      reflections,
      getMemory: (id) => memoriesById.get(id) ?? null,
      persist: (record) => record,
    });
    await Promise.all([...result.memory.created, ...result.memory.updated].map((memory) => repository.upsertMemory(memory)));
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
  const repository = options.repository || await getRole4Repository(intervention.userId);
  try {
    result.reflection = await reflectFocusIntervention(intervention, { ...options, repository });
  } catch (error) {
    result.errors.push({ stage: "reflection", message: error instanceof Error ? error.message : "Reflection failed" });
    return result;
  }
  try {
    const [reflections, memories] = await Promise.all([
      repository.listReflections(intervention.userId, intervention.moduleId),
      repository.listMemories(intervention.userId, intervention.moduleId),
    ]);
    const memoriesById = new Map(memories.map((memory) => [memory.id, memory]));
    result.memory = deriveMemoryFromReflections(intervention.userId, intervention.moduleId, {
      reflections,
      getMemory: (id) => memoriesById.get(id) ?? null,
      persist: (record) => record,
    });
    await Promise.all([
      ...result.memory.created,
      ...result.memory.updated,
    ].map((memory) => repository.upsertMemory(memory)));
  } catch (error) {
    result.errors.push({ stage: "memory", message: error instanceof Error ? error.message : "Memory derivation failed" });
  }
  return result;
}
