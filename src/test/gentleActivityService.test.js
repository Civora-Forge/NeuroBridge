import { describe, expect, it } from 'vitest';
import { buildGentleActivityOutcome, completionRatio, validateEnergy, validateGentleActivityConfiguration } from '@/support/modules/gentleActivity/gentleActivityService';

describe('gentle activity service', () => {
  it('validates configuration, energy, and aggregate completion', () => {
    expect(validateGentleActivityConfiguration({ pacing: 'steady', totalSteps: 4 })).toEqual({ pacing: 'steady', totalSteps: 4 });
    expect(validateEnergy(5)).toBe(5);
    expect(validateEnergy(6)).toBeNull();
    expect(completionRatio(2, 4)).toBe(0.5);
  });
  it('builds privacy-safe structured outcomes', () => {
    const outcome = buildGentleActivityOutcome({ configuration: { totalSteps: 4 }, completedSteps: 2, energyBefore: 2, energyAfter: 4 });
    expect(outcome).toMatchObject({ completionStatus: 'partially_completed', metrics: { totalSteps: 4, stepsCompleted: 2, completionRate: 0.5, energyDelta: 2 } });
    expect(JSON.stringify(outcome)).not.toContain('Touch something cold');
  });
});
