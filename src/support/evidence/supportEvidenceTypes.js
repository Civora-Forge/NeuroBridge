export const SUPPORT_EVIDENCE_VERSION = 1;
export const PARTIAL_COMPLETION_WEIGHT = 0.5;

export function confidenceForEvidence(count, ratingCount, contradictions, mixed) {
  const base = count === 0 ? 0 : count === 1 ? 0.25 : count === 2 ? 0.4 : count <= 4 ? 0.65 : 0.85;
  const penalty = (ratingCount === 0 ? 0.1 : 0) + Math.min(0.2, contradictions * 0.05) + (mixed ? 0.05 : 0);
  return Number(Math.max(0, base - penalty).toFixed(2));
}
