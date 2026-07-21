import { SUPPORT_MODULE_REGISTRY } from "@/lib/adaptive/disorderFeatureRegistry";

const DEFAULT_THRESHOLD = 2;
const DEFAULT_MIN_MODULES = 3;

export function buildTagProfile({ selectedChallenges = [], answersByQuestionId = {}, challengeOptions = [], questions = [] }) {
  const tagProfile = {};

  const selectedChallengeSet = new Set(selectedChallenges);
  for (const challenge of challengeOptions) {
    if (!selectedChallengeSet.has(challenge.id)) continue;
    for (const tag of challenge.tags || []) {
      tagProfile[tag] = (tagProfile[tag] || 0) + 1;
    }
  }

  for (const question of questions) {
    const selectedOptionId = answersByQuestionId[question.id];
    if (!selectedOptionId) continue;
    const selectedOption = question.options.find((option) => option.id === selectedOptionId);
    if (!selectedOption) continue;
    const weight = Number(selectedOption.weight ?? 1);

    for (const tag of selectedOption.tags || []) {
      tagProfile[tag] = (tagProfile[tag] || 0) + weight;
    }
  }

  return tagProfile;
}

export function scoreModules(tagProfile, modules = SUPPORT_MODULE_REGISTRY) {
  return modules
    .map((module) => {
      const score = (module.tags || []).reduce((sum, tag) => sum + (tagProfile[tag] || 0), 0);
      return { ...module, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function selectModules(tagProfile, modules = SUPPORT_MODULE_REGISTRY, threshold = DEFAULT_THRESHOLD, minimumModules = DEFAULT_MIN_MODULES) {
  const scored = scoreModules(tagProfile, modules);
  const selected = scored.filter((module) => module.score >= threshold);

  if (selected.length >= minimumModules) {
    return selected;
  }

  return scored.slice(0, minimumModules);
}

export function deriveDisordersFromModules(modules) {
  return [...new Set(modules.flatMap((module) => module.disorders || []))];
}

export function buildPersonalizationProfile(input) {
  const tagProfile = buildTagProfile(input);
  const selectedModules = selectModules(tagProfile, input.modules || SUPPORT_MODULE_REGISTRY);

  return {
    tagProfile,
    selectedModules,
    enabledModules: selectedModules.map((module) => module.id),
    inferredDisorders: deriveDisordersFromModules(selectedModules),
  };
}
