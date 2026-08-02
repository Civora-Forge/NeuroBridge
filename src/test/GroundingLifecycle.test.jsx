import { describe, expect, it } from 'vitest';
import { buildGroundingOutcome } from '@/support/modules/grounding/groundingService';

describe('Grounding lifecycle outcome', () => {
  it('records only aggregate confirmed-technique progress', () => {
    const outcome = buildGroundingOutcome({ configuration: { totalSteps: 4, techniqueOrder: ['a', 'b', 'c', 'd'], suggestedDurations: [4, 2, 3, 5] }, completedSteps: 4, suggestedDurationsReached: 2, techniquesCompletedEarly: 2, currentTechniqueId: 'd', startedAt: Date.now() - 10 });
    expect(outcome).toMatchObject({ completionStatus: 'completed', metrics: { totalTechniques: 4, techniquesCompleted: 4, completedNaturally: true } });
    expect(JSON.stringify(outcome)).not.toContain('Name 5 things');
  });
});
