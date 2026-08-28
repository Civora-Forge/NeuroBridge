/**
 * InterventionResolver.jsx — Role 3 Recommendation Resolver
 *
 * Responsibilities:
 *   - Ingests recommendation ID / key from Adaptive Engine
 *   - Resolves to the corresponding interactive Role 3 intervention component
 *   - Gracefully resolves unknown / malformed keys to SafeFallbackIntervention
 *   - Provides friendly title & description metadata for the Adaptive popup
 */

import GuidedBreathingIntervention from "./anxiety/GuidedBreathingIntervention";
import GroundingExerciseIntervention from "./anxiety/GroundingExerciseIntervention";
import CalmSpaceIntervention from "./anxiety/CalmSpaceIntervention";
import SensoryResetIntervention from "./asd/SensoryResetIntervention";
import GroundingActivityIntervention from "./asd/GroundingActivityIntervention";
import TransitionSupportIntervention from "./asd/TransitionSupportIntervention";
import SafeFallbackIntervention from "./fallback/SafeFallbackIntervention";

export const INTERVENTION_REGISTRY = {
  // Anxiety Interventions
  guided_breathing: {
    id: "guided_breathing",
    title: "Guided Breathing",
    description: "Take a short pause and breathe at a steady, calming pace.",
    domain: "anxiety",
    component: GuidedBreathingIntervention,
    aliases: ["breathing", "box_breathing", "physiological_breathing", "478_breathing", "pacing"],
  },
  grounding_exercise: {
    id: "grounding_exercise",
    title: "5-4-3-2-1 Grounding",
    description: "Use your 5 senses to gently bring your focus back to the present.",
    domain: "anxiety",
    component: GroundingExerciseIntervention,
    aliases: ["54321_grounding", "anxiety_grounding", "physiological_grounding", "grounding"],
  },
  calm_space: {
    id: "calm_space",
    title: "Calm Space",
    description: "A minimal, quiet sanctuary with zero pressure. Take all the time you need.",
    domain: "anxiety",
    component: CalmSpaceIntervention,
    aliases: ["calm_pause", "calm_mode", "calm", "sanctuary"],
  },

  // ASD Interventions
  sensory_reset: {
    id: "sensory_reset",
    title: "Sensory Reset",
    description: "A low-stimulation space to rest your eyes, ears, and mind.",
    domain: "asd",
    component: SensoryResetIntervention,
    aliases: ["sensory", "low_stimulation", "overwhelm", "sensory_reduction", "safe_space"],
  },
  grounding_activity: {
    id: "grounding_activity",
    title: "Grounding Activity",
    description: "A 5-step gentle check-in to help you feel steady and settled.",
    domain: "asd",
    component: GroundingActivityIntervention,
    aliases: ["asd_grounding", "regulation", "regulation_activity", "pause_check"],
  },
  transition_support: {
    id: "transition_support",
    title: "Now · Next · Then",
    description: "Step-by-step guidance to make switching activities smooth and clear.",
    domain: "asd",
    component: TransitionSupportIntervention,
    aliases: ["transition", "routine", "routine_support", "schedule_transition", "now_next_then"],
  },
};

/**
 * Resolve recommendation ID or action string to the canonical intervention definition.
 * Returns fallback definition if ID is unknown or null.
 */
export function resolveInterventionDefinition(recommendationId) {
  if (!recommendationId || typeof recommendationId !== "string") {
    return {
      id: "fallback",
      title: "Gentle Pause",
      description: "Take a short pause to rest and reset.",
      domain: "general",
      component: SafeFallbackIntervention,
      aliases: [],
    };
  }

  const normalized = recommendationId.toLowerCase().trim().replace(/[-:]/g, "_");

  // Direct match
  if (INTERVENTION_REGISTRY[normalized]) {
    return INTERVENTION_REGISTRY[normalized];
  }

  // Alias match
  for (const item of Object.values(INTERVENTION_REGISTRY)) {
    if (item.aliases.includes(normalized) || item.aliases.some((a) => normalized.includes(a))) {
      return item;
    }
  }

  // Domain-based inference
  if (normalized.includes("breath") || normalized.includes("pacing")) {
    return INTERVENTION_REGISTRY.guided_breathing;
  }
  if (normalized.includes("sensory") || normalized.includes("overwhelm") || normalized.includes("stimulation")) {
    return INTERVENTION_REGISTRY.sensory_reset;
  }
  if (normalized.includes("transition") || normalized.includes("routine")) {
    return INTERVENTION_REGISTRY.transition_support;
  }
  if (normalized.includes("ground")) {
    return INTERVENTION_REGISTRY.grounding_exercise;
  }
  if (normalized.includes("calm")) {
    return INTERVENTION_REGISTRY.calm_space;
  }

  // Safe fallback
  return {
    id: "fallback",
    title: "Gentle Pause",
    description: "Take a short pause to rest and reset.",
    domain: "general",
    component: SafeFallbackIntervention,
    aliases: [],
  };
}

/**
 * Get friendly metadata (title & description) for a recommendation ID
 */
export function getInterventionMeta(recommendationId) {
  const def = resolveInterventionDefinition(recommendationId);
  return {
    id: def.id,
    title: def.title,
    description: def.description,
    domain: def.domain,
  };
}

/**
 * Component Resolver — Renders the resolved intervention
 */
export default function InterventionResolver({ recommendationId, onComplete, onCancel, autoStart = false }) {
  const definition = resolveInterventionDefinition(recommendationId);
  const Component = definition.component;

  return (
    <Component
      onComplete={onComplete}
      onCancel={onCancel}
      autoStart={autoStart}
    />
  );
}
