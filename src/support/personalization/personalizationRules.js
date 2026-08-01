import { advisoryLevel } from "./personalizationTypes";

function observedAssociation(memory) {
  return memory.value?.observedAssociation;
}

function hint(memory, key, value, reasonCode) {
  if (memory.confidence < 0.4) return null;
  return {
    id: `hint-${memory.id}`,
    key,
    value,
    sourceMemoryIds: [memory.id],
    evidenceCount: memory.evidenceCount,
    confidence: memory.confidence,
    advisory: advisoryLevel(memory.confidence),
    reasonCode: memory.contradictionCount > 0 ? "conflicting_evidence" : reasonCode,
  };
}

export function buildTaskBreakdownHints(memories) {
  return memories.flatMap((memory) => {
    const observed = observedAssociation(memory);
    if (memory.category === "preferred_configuration" && memory.key === "selected_style"
      && ["Bare Minimum", "Standard", "Hero Mode"].includes(observed)) {
      return [hint(memory, "selectedStyle", observed, "preferred_style_observed")].filter(Boolean);
    }
    if (memory.category === "successful_strategy" && memory.key === "timer_associated_completion"
      && observed === "high_completion") {
      return [hint(memory, "timerEnabled", true, "timer_associated_high_completion")].filter(Boolean);
    }
    if (memory.category === "completion_pattern" && memory.key === "completion_rate_band"
      && observed === "partial") {
      return [hint(memory, "suggestSmallerFirstStep", true, "repeated_partial_completion")].filter(Boolean);
    }
    if (memory.category === "unsuccessful_configuration" && memory.key === "high_step_count_outcome"
      && observed === "abandoned") {
      return [hint(memory, "avoidHighStepCount", true, "high_step_count_abandonment")].filter(Boolean);
    }
    if (memory.category === "unsuccessful_configuration" && memory.key === "low_satisfaction_style") {
      return [hint(memory, "avoidSelectedStyle", observed, "low_satisfaction_style")].filter(Boolean);
    }
    if (memory.category === "feedback_pattern" && memory.key === "satisfaction_band" && observed === "low") {
      return [hint(memory, "lowHelpfulnessObserved", true, "repeated_low_helpfulness")].filter(Boolean);
    }
    return [];
  });
}
