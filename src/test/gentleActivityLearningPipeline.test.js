import { beforeEach, describe, expect, it } from 'vitest';
import { abandonSupportModule, completeSupportModule, executeSupportModule, rateSupportModule } from '@/support/execution';
import { reflectIntervention } from '@/support/reflection';
import { deriveMemoryFromReflections, listUserMemories, setLearningEnabled } from '@/support/memory';
import { getPersonalizationHints } from '@/support/personalization';
import { getSupportEvidence } from '@/support/evidence';
import { validateReflection, validateSupportEvidenceResponse } from '@/support/schemas/supportSchemas';

const USER_ID = 'gentle-pipeline-user';
const MODULE_ID = 'support.gentle_activity';

async function activity(index, { status = 'completed', completed = 5, rating, energyBefore = 2, energyAfter = 3 } = {}) {
  const started = await executeSupportModule({ userId: USER_ID, moduleId: MODULE_ID, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: { pacing: 'gentle', totalSteps: 5 }, metadata: { idempotencyKey: `gentle-${index}` } });
  const outcome = { completionStatus: status === 'completed' ? 'completed' : 'partially_completed', durationMs: 60000, metrics: { totalSteps: 5, stepsCompleted: completed, completionRate: completed / 5, energyBefore, energyAfter, energyDelta: energyAfter - energyBefore, completedNaturally: status === 'completed' }, finalConfiguration: { pacing: 'gentle', totalSteps: 5 } };
  const terminal = status === 'abandoned' ? await abandonSupportModule({ userId: USER_ID, interventionId: started.interventionId, moduleId: MODULE_ID, outcome }) : await completeSupportModule({ userId: USER_ID, interventionId: started.interventionId, moduleId: MODULE_ID, outcome });
  if (rating) await rateSupportModule({ userId: USER_ID, interventionId: started.interventionId, moduleId: MODULE_ID, outcome: { userRating: rating } });
  return reflectIntervention(terminal.intervention);
}

describe('Gentle Activity learning pipeline', () => {
  beforeEach(() => localStorage.clear());
  it('reflects sanitized completion, steps, natural completion, and bounded energy change', async () => {
    const completed = await activity(1, { rating: 5 });
    const abandoned = await activity(2, { status: 'abandoned', completed: 4, energyAfter: 1 });
    expect(validateReflection(completed)).toEqual(completed);
    expect(completed.insights).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'gentle_activity_completion', value: 1 }), expect.objectContaining({ type: 'gentle_activity_step_pattern', value: 5 }), expect.objectContaining({ type: 'gentle_activity_energy_change', value: 'improved' })]));
    expect(abandoned.outcomeSummary.completionStatus).toBe('abandoned');
    expect(JSON.stringify([completed, abandoned])).not.toMatch(/touch something|journal|conversation|diagnos/i);
  });
  it('derives thresholded completion and high-step abandonment memory with supported hints', async () => {
    await activity(1, { status: 'partially_completed', completed: 2 });
    expect(deriveMemoryFromReflections(USER_ID, MODULE_ID).created).toEqual([]);
    await activity(2, { status: 'partially_completed', completed: 2 });
    deriveMemoryFromReflections(USER_ID, MODULE_ID);
    const partial = listUserMemories(USER_ID, { moduleId: MODULE_ID }).find((memory) => memory.key === 'gentle_activity_completion_band');
    expect(partial).toMatchObject({ value: { observedAssociation: 'partial' }, confidence: 0.4 });
    await activity(3, { status: 'abandoned', completed: 4 });
    await activity(4, { status: 'abandoned', completed: 4 });
    await activity(5, { status: 'partially_completed', completed: 2 });
    deriveMemoryFromReflections(USER_ID, MODULE_ID);
    expect(getPersonalizationHints(USER_ID, MODULE_ID).hints).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'reduceStepCount' }), expect.objectContaining({ key: 'useLowEffortProtocol' })]));
  });
  it('returns generic evidence and suppresses memory-derived data when learning is disabled', async () => {
    await activity(1, { rating: 5 }); await activity(2, { status: 'abandoned', completed: 4 });
    deriveMemoryFromReflections(USER_ID, MODULE_ID);
    const evidence = getSupportEvidence(USER_ID, [MODULE_ID]);
    const entry = evidence.modules[0];
    expect(entry).toMatchObject({ startedCount: 2, completedCount: 1, abandonedCount: 1, completionRate: 0.5, averageUserRating: 5 });
    expect(entry.effectivenessRate).toBe(1);
    expect(validateSupportEvidenceResponse(evidence)).toEqual(evidence);
    expect(JSON.parse(JSON.stringify(evidence))).toEqual(evidence);
    setLearningEnabled(USER_ID, false);
    const disabled = getSupportEvidence(USER_ID, [MODULE_ID]).modules[0];
    expect(disabled.evidenceCount).toBe(2); expect(disabled.personalizationHints).toEqual([]); expect(disabled.preferredConfiguration).toBeNull(); expect(disabled.unsuccessfulConfigurations).toEqual([]);
  });
  it('keeps users isolated and deterministic', async () => {
    await activity(1);
    const first = getSupportEvidence(USER_ID, [MODULE_ID]);
    expect(getSupportEvidence('other-gentle-user', [MODULE_ID]).modules[0].evidenceCount).toBe(0);
    expect(getSupportEvidence(USER_ID, [MODULE_ID])).toEqual(first);
  });
});
