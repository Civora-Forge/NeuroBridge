import { describe, expect, it } from 'vitest';
import { buildFocusSessionOutcome, completionRatio, durationToSeconds, elapsedSeconds, validateFocusSessionConfiguration } from '@/support/modules/focusSession/focusSessionService';

describe('focus session service', () => {
  it('validates configuration and timer calculations', () => {
    expect(validateFocusSessionConfiguration({ plannedDurationMinutes: 15, breakDurationMinutes: 5 })).toMatchObject({ plannedDurationMinutes: 15, breakDurationMinutes: 5 });
    expect(durationToSeconds(15)).toBe(900);
    expect(elapsedSeconds(900, 450)).toBe(450);
    expect(completionRatio(900, 450)).toBe(0.5);
  });
  it('builds privacy-safe natural completion outcomes', () => {
    const outcome = buildFocusSessionOutcome({ configuration: { plannedDurationMinutes: 15 }, secondsRemaining: 0, pauseCount: 1, resumeCount: 1, completedNaturally: true });
    expect(outcome).toMatchObject({ completionStatus: 'completed', metrics: { plannedDurationMinutes: 15, completedNaturally: true, completionRatio: 1 }, finalConfiguration: { plannedDurationMinutes: 15 } });
    expect(JSON.stringify(outcome)).not.toContain('intent');
  });
  it('builds a partial outcome for an explicit reset', () => {
    const outcome = buildFocusSessionOutcome({ configuration: { plannedDurationMinutes: 15 }, secondsRemaining: 450 });
    expect(outcome).toMatchObject({ completionStatus: 'partially_completed', metrics: { completionRatio: 0.5, completedNaturally: false } });
  });
});
