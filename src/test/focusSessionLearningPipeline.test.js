import { beforeEach, describe, expect, it } from 'vitest';
import { abandonSupportModule, completeSupportModule, executeSupportModule, rateSupportModule } from '@/support/execution';
import { reflectIntervention } from '@/support/reflection';
import { deriveMemoryFromReflections, listUserMemories, setLearningEnabled } from '@/support/memory';
import { getPersonalizationHints } from '@/support/personalization';
import { getSupportEvidence } from '@/support/evidence';
import { validateReflection, validateSupportEvidenceResponse } from '@/support/schemas/supportSchemas';

const USER_ID = 'focus-pipeline-user';
const MODULE_ID = 'support.focus_session';

async function session(index, { status = 'completed', minutes = 15, ratio = 1, pauses = 0, natural = true, rating } = {}) {
  const started = await executeSupportModule({ userId: USER_ID, moduleId: MODULE_ID, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: { plannedDurationMinutes: minutes, breakDurationMinutes: 5, breakEnabled: true, soundEnabled: false }, metadata: { idempotencyKey: `focus-${index}` } });
  const outcome = { completionStatus: status === 'completed' ? 'completed' : 'partially_completed', durationMs: Math.round(minutes * 60_000 * ratio), metrics: { plannedDurationMinutes: minutes, actualDurationMs: Math.round(minutes * 60_000 * ratio), pauseCount: pauses, resumeCount: pauses, completionRatio: ratio, interruptions: 0, completedNaturally: natural, breakStarted: false, breakCompleted: false }, finalConfiguration: { plannedDurationMinutes: minutes, breakDurationMinutes: 5, breakEnabled: true, soundEnabled: false } };
  const terminal = status === 'abandoned'
    ? await abandonSupportModule({ userId: USER_ID, interventionId: started.interventionId, moduleId: MODULE_ID, outcome })
    : await completeSupportModule({ userId: USER_ID, interventionId: started.interventionId, moduleId: MODULE_ID, outcome });
  if (rating) await rateSupportModule({ userId: USER_ID, interventionId: started.interventionId, moduleId: MODULE_ID, outcome: { userRating: rating } });
  return reflectIntervention(terminal.intervention);
}

describe('Focus Session learning pipeline', () => {
  beforeEach(() => localStorage.clear());

  it('reflects completed and abandoned aggregate Focus Sessions without private content', async () => {
    const completed = await session(1, { rating: 5 });
    const abandoned = await session(2, { status: 'abandoned', minutes: 45, ratio: 0.2, natural: false });
    expect(validateReflection(completed)).toEqual(completed);
    expect(completed.insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'focus_session_completion', value: 1 }),
      expect.objectContaining({ type: 'focus_session_duration', value: 15 }),
      expect.objectContaining({ type: 'focus_session_pause_pattern', value: 0 }),
      expect.objectContaining({ type: 'focus_session_natural_completion', value: true }),
    ]));
    expect(abandoned.outcomeSummary.completionStatus).toBe('abandoned');
    expect(JSON.stringify([completed, abandoned])).not.toMatch(/task|note|audio|transcript|conversation/i);
  });

  it('derives thresholded Focus Session memory and advisory hints from repeated reflected evidence', async () => {
    await session(1);
    expect(deriveMemoryFromReflections(USER_ID, MODULE_ID).created).toEqual([]);
    await session(2);
    const two = deriveMemoryFromReflections(USER_ID, MODULE_ID);
    expect(two.created.some((memory) => memory.key === 'naturally_completed_duration' && memory.confidence === 0.4)).toBe(true);
    await session(3);
    const three = deriveMemoryFromReflections(USER_ID, MODULE_ID);
    expect(three.updated.some((memory) => memory.key === 'naturally_completed_duration' && memory.confidence === 0.65)).toBe(true);
    const hints = getPersonalizationHints(USER_ID, MODULE_ID);
    expect(hints.hints).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'preferredDurationMinutes', value: 15 })]));
    expect(hints.hints.find((hint) => hint.key === 'preferredBreakMinutes')).toBeUndefined();
  });

  it('derives long-abandonment and partial-completion patterns, then exposes generic evidence', async () => {
    await session(1, { status: 'abandoned', minutes: 45, ratio: 0.2, natural: false });
    await session(2, { status: 'abandoned', minutes: 45, ratio: 0.2, natural: false });
    await session(3, { status: 'partially_completed', minutes: 15, ratio: 0.4, natural: false });
    await session(4, { status: 'partially_completed', minutes: 15, ratio: 0.4, natural: false });
    await session(5, { status: 'partially_completed', minutes: 15, ratio: 0.4, natural: false });
    const derived = deriveMemoryFromReflections(USER_ID, MODULE_ID);
    const partialMemory = listUserMemories(USER_ID, { moduleId: MODULE_ID }).find((memory) => memory.key === 'focus_completion_ratio_band');
    expect(derived.created.some((memory) => memory.key === 'focus_completion_ratio_band')).toBe(true);
    expect(partialMemory).toMatchObject({ category: 'completion_pattern', value: { observedAssociation: 'partial' }, status: 'active' });
    expect(partialMemory.confidence).toBeGreaterThanOrEqual(0.4);
    const hints = getPersonalizationHints(USER_ID, MODULE_ID);
    expect(hints.hints).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'avoidLongSessions' }), expect.objectContaining({ key: 'useShorterSession' })]));
    const evidence = getSupportEvidence(USER_ID, [MODULE_ID]);
    const entry = evidence.modules[0];
    expect(entry).toMatchObject({ startedCount: 5, completedCount: 0, abandonedCount: 2, completionRate: 0.3, averageUserRating: null });
    expect(entry.effectivenessRate).toBeNull();
    expect(validateSupportEvidenceResponse(evidence)).toEqual(evidence);
    expect(JSON.parse(JSON.stringify(evidence))).toEqual(evidence);
    setLearningEnabled(USER_ID, false);
    const disabled = getSupportEvidence(USER_ID, [MODULE_ID]).modules[0];
    expect(disabled.evidenceCount).toBe(5);
    expect(disabled.personalizationHints).toEqual([]);
    expect(disabled.preferredConfiguration).toBeNull();
    expect(disabled.unsuccessfulConfigurations).toEqual([]);
  });

  it('keeps users isolated and produces deterministic public results', async () => {
    await session(1, { rating: 5 });
    const first = getSupportEvidence(USER_ID, [MODULE_ID]);
    expect(getSupportEvidence('other-focus-user', [MODULE_ID]).modules[0].evidenceCount).toBe(0);
    expect(getSupportEvidence(USER_ID, [MODULE_ID])).toEqual(first);
  });
});
