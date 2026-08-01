export const MEMORY_VERSION = 1;
export const SUPPORTED_REFLECTION_VERSION = 1;

export const MemoryCategory = {
  PREFERRED_CONFIGURATION: "preferred_configuration",
  SUCCESSFUL_STRATEGY: "successful_strategy",
  UNSUCCESSFUL_CONFIGURATION: "unsuccessful_configuration",
  COMPLETION_PATTERN: "completion_pattern",
  FEEDBACK_PATTERN: "feedback_pattern",
};

export const MemoryStatus = {
  ACTIVE: "active",
  SUPERSEDED: "superseded",
  DELETED: "deleted",
};

export function confidenceForEvidence(evidenceCount, contradictionCount) {
  const base = evidenceCount >= 5 ? 0.85 : evidenceCount >= 3 ? 0.65 : evidenceCount >= 2 ? 0.4 : 0;
  return Number(Math.max(0, base - Math.min(0.3, contradictionCount * 0.1)).toFixed(2));
}

export function confidenceLevel(confidence) {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "moderate";
  return "low";
}
