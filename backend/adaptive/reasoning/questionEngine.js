import { QUESTIONS_REGISTRY } from "@/data/questionsRegistry";

export function getQuestionsForChallenges(challengeIds = []) {
  const merged = [];
  const seen = new Set();

  for (const challengeId of challengeIds) {
    for (const question of QUESTIONS_REGISTRY[challengeId] || []) {
      if (seen.has(question.id)) continue;
      seen.add(question.id);
      merged.push(question);
    }
  }

  if (merged.length > 0) {
    return merged;
  }

  return [
    ...(QUESTIONS_REGISTRY.adhd || []),
    ...(QUESTIONS_REGISTRY.anxiety || []),
    ...(QUESTIONS_REGISTRY.depression || []),
  ].slice(0, 8);
}
