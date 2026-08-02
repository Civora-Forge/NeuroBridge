export const PERSONALIZATION_HINT_VERSION = 1;

export const HintAdvisoryLevel = {
  OBSERVATIONAL: "observational",
  USABLE: "usable",
  STRONG: "strong",
};

export function advisoryLevel(confidence) {
  if (confidence >= 0.85) return HintAdvisoryLevel.STRONG;
  if (confidence >= 0.65) return HintAdvisoryLevel.USABLE;
  return HintAdvisoryLevel.OBSERVATIONAL;
}

export function canApplyHint(hint) {
  return hint?.advisory === HintAdvisoryLevel.USABLE || hint?.advisory === HintAdvisoryLevel.STRONG;
}
