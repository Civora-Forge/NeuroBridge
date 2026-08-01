import { getSupportModuleById, SUPPORT_MODULES } from "@/support/framework/supportModuleRegistry";
import {
  PolicyScope,
  validateModuleContext,
  validateSupportModuleDefinition,
} from "@/support/schemas/supportSchemas";

function normalizeModulePolicies(moduleId, policies) {
  if (!Array.isArray(policies) || policies.length === 0) {
    return [];
  }
  return policies.map((policy) =>
    policy.scope === PolicyScope.MODULE && !policy.moduleId ? { ...policy, moduleId } : policy,
  );
}

export function buildModuleContextFromDefinition(definition, runtime = {}) {
  const validated = validateSupportModuleDefinition(definition);

  const context = {
    moduleId: validated.id,
    title: validated.title,
    category: validated.category,
    interventionTypes: validated.interventionTypes,
    route: validated.route,
    tags: validated.tags,
    disorders: validated.disorders,
    expectedOutcomeMetrics: validated.expectedOutcomeMetrics,
    safetyLevel: validated.safetyLevel,
    repetitionLimit: validated.repetitionLimit?.maxCount,
    supportedRoles: validated.supportedRoles,
    coreFeatures: validated.coreFeatures,
    supportedAdaptationDimensions: validated.supportedAdaptationDimensions,
    restrictedDimensions: validated.restrictedDimensions,
    constraints: validated.constraints,
    goals: validated.goals,
    modulePolicies: normalizeModulePolicies(validated.id, validated.modulePolicies),
  };

  if (runtime.moduleState !== undefined) {
    context.moduleState = runtime.moduleState;
  }
  if (runtime.currentTask !== undefined) {
    context.currentTask = runtime.currentTask;
  }
  if (runtime.currentGoal !== undefined) {
    context.currentGoal = runtime.currentGoal;
  }

  return validateModuleContext(context);
}

export function buildModuleContext(moduleId, runtime = {}) {
  const definition = getSupportModuleById(moduleId);
  if (!definition) {
    throw new Error(`No support module definition found for moduleId: ${moduleId}`);
  }
  return buildModuleContextFromDefinition(definition, runtime);
}

export function listModuleContexts() {
  return SUPPORT_MODULES.map((module) => buildModuleContext(module.id));
}
