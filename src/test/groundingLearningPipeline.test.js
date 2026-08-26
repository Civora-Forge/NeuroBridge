import { describe, expect, it } from 'vitest';
import { buildGroundingOutcome } from '@/support/modules/grounding/groundingService';
import { getSupportEvidence } from '@/support/evidence';

describe('grounding learning boundary', () => {
  it('keeps outcomes structured and evidence user-scoped', () => {
    const outcome = buildGroundingOutcome({ configuration: { totalSteps: 4, techniqueOrder: ['a', 'b', 'c', 'd'], suggestedDurations: [1, 1, 1, 1] }, completedSteps: 2, currentTechniqueId: 'b' });
    expect(JSON.stringify(outcome)).not.toContain('emotion');
    expect(getSupportEvidence('grounding-user-a', ['support.grounding']).modules[0].moduleId).toBe('support.grounding');
    expect(JSON.parse(JSON.stringify(outcome))).toEqual(outcome);
  });
});
