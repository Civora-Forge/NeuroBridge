import { describe, expect, it } from 'vitest';
import { buildGroundingOutcome, groundingProgress, validateGroundingConfiguration } from '@/support/modules/grounding/groundingService';
describe('grounding service', () => {
  it('normalizes configuration and produces a structured outcome', () => {
    expect(validateGroundingConfiguration({ totalSteps: 4 })).toMatchObject({ totalSteps: 4, pacing: 'timed' });
    expect(groundingProgress(5, 4)).toBe(1);
    expect(buildGroundingOutcome({ configuration: { totalSteps: 4, techniqueOrder: ['a'], suggestedDurations: [1] }, completedSteps: 4, suggestedDurationsReached: 2, techniquesCompletedEarly: 2 }).metrics).toMatchObject({ totalTechniques: 4, completionRate: 1, completedNaturally: true });
  });
});
