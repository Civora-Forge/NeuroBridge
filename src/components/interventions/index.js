/**
 * src/components/interventions/index.js — Role 3 Intervention Layer Barrel Exports
 */

export { default as InterventionModal } from "./InterventionModal";
export { default as InterventionResolver, resolveInterventionDefinition, getInterventionMeta, INTERVENTION_REGISTRY } from "./InterventionResolver";
export { default as AdaptiveRecommendationPopup } from "./AdaptiveRecommendationPopup";
export { default as SafeFallbackIntervention } from "./fallback/SafeFallbackIntervention";

// ASD Interventions
export { default as SensoryResetIntervention } from "./asd/SensoryResetIntervention";
export { default as GroundingActivityIntervention } from "./asd/GroundingActivityIntervention";
export { default as TransitionSupportIntervention } from "./asd/TransitionSupportIntervention";

// Anxiety Interventions
export { default as GuidedBreathingIntervention } from "./anxiety/GuidedBreathingIntervention";
export { default as GroundingExerciseIntervention } from "./anxiety/GroundingExerciseIntervention";
export { default as CalmSpaceIntervention } from "./anxiety/CalmSpaceIntervention";
