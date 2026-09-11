/**
 * Turns an already-applied feature configuration into calm, user-facing copy.
 * This is deliberately a presentation boundary: it compares visible before/after
 * values and never reads an engine plan, score, policy, or strategy identifier.
 */

function changed(before, after) {
  return before !== after;
}

function sameOrder(before = [], after = []) {
  return before.length === after.length && before.every((value, index) => value === after[index]);
}

function explanation(title, message, appliedChanges) {
  return { title, message, appliedChanges };
}

export function buildAdaptationExplanation({ feature, baseline = {}, applied = {} } = {}) {
  if (feature === "anxiety") {
    const before = baseline.recommendations ?? [];
    const after = applied.recommendations ?? [];
    if (!before.length || !after.length || sameOrder(before, after)) return null;
    const movedFirst = after[0];
    return explanation(
      "Recommendations adjusted",
      `We've moved ${movedFirst} higher in your recommendations.`,
      [`Recommended first: ${movedFirst}`],
    );
  }

  if (feature === "gentleActivity") {
    if (!changed(baseline.stepCount, applied.stepCount)) return null;
    return explanation(
      "Adapted for you",
      "We've shortened this activity to make the next steps feel more manageable.",
      [`Steps: ${baseline.stepCount} to ${applied.stepCount}`],
    );
  }

  if (feature === "grounding") {
    const orderChanged = !sameOrder(baseline.techniques, applied.techniques);
    const pacingChanged = changed(baseline.slowPacing, applied.slowPacing) && applied.slowPacing;
    if (!orderChanged && !pacingChanged) return null;
    const changes = [];
    if (orderChanged) changes.push(`Recommended first: ${applied.techniques?.[0]}`);
    if (pacingChanged) changes.push("Pace: Take it slowly");
    return explanation(
      "Adapted for you",
      orderChanged
        ? `We've put ${applied.techniques?.[0]} first for this practice.`
        : "This practice is set up with a slower pace.",
      changes,
    );
  }

  if (feature === "socialScenario") {
    const difficultyChanged = changed(baseline.difficulty, applied.difficulty);
    const cuesEnabled = !baseline.supportiveCues && applied.supportiveCues;
    if (!difficultyChanged && !cuesEnabled) return null;
    const changes = [];
    if (difficultyChanged) changes.push(`Difficulty: ${baseline.difficulty} to ${applied.difficulty}`);
    if (cuesEnabled) changes.push("Supportive cues: On");
    return explanation(
      "Adapted for you",
      difficultyChanged && cuesEnabled
        ? "This scenario is a little easier and includes supportive cues."
        : difficultyChanged
          ? `This scenario is set to ${applied.difficulty}.`
          : "This scenario includes supportive cues.",
      changes,
    );
  }

  if (feature === "conversation") {
    const difficultyChanged = changed(baseline.difficulty, applied.difficulty);
    const hintsEnabled = !baseline.hintsEnabled && applied.hintsEnabled;
    const pacingChanged = changed(baseline.pacing, applied.pacing) && applied.pacing === "slow";
    if (!difficultyChanged && !hintsEnabled && !pacingChanged) return null;
    const changes = [];
    if (difficultyChanged) changes.push(`Level: ${baseline.difficulty} to ${applied.difficulty}`);
    if (hintsEnabled) changes.push("Hints: On");
    if (pacingChanged) changes.push("Pace: Take your time");
    return explanation(
      difficultyChanged && Number(applied.difficulty) > Number(baseline.difficulty)
        ? "Ready for a little more?"
        : "Practice adjusted",
      difficultyChanged && Number(applied.difficulty) > Number(baseline.difficulty)
        ? "Your next conversation is set at a higher level."
        : "Your next conversation is set up with the support it needs.",
      changes,
    );
  }

  return null;
}
