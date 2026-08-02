import { describe, expect, it } from 'vitest';
import { assessSupportInput } from '@/support/safety';

describe('support safety gateway', () => {
  it('allows structured low-risk authenticated input with aggregate persistence', () => {
    const result = assessSupportInput({ userId: 'safe-user', moduleId: 'support.task_breakdown', inputType: 'structured_input' });
    expect(result).toMatchObject({ allowed: true, level: 'safe', persistencePolicy: { persistRawText: false, persistAggregateMetrics: true, retentionMode: 'user_scoped' } });
  });
  it('restricts safe sensitive text and keeps anonymous input ephemeral', () => {
    const result = assessSupportInput({ moduleId: 'support.cognitive_reframing', inputType: 'free_text', text: 'I feel stuck' });
    expect(result).toMatchObject({ allowed: true, level: 'sensitive', requiresConfirmation: true, persistencePolicy: { persistRawText: false, retentionMode: 'ephemeral' } });
  });
  it('blocks high-risk text without returning it', () => {
    const result = assessSupportInput({ userId: 'safe-user', moduleId: 'support.cognitive_reframing', inputType: 'free_text', text: 'I want to kill myself' });
    expect(result).toMatchObject({ allowed: false, level: 'high_risk', requiresEscalation: true });
    expect(JSON.stringify(result)).not.toContain('kill myself');
  });
  it('fails safely for unknown input or modules and is deterministic', () => {
    const input = { userId: 'safe-user', moduleId: 'support.unknown', inputType: 'unknown' };
    expect(assessSupportInput(input)).toEqual(assessSupportInput(input));
    expect(assessSupportInput(input).reasonCodes).toContain('unknown_input_or_module');
    expect(JSON.parse(JSON.stringify(assessSupportInput(input)))).toEqual(assessSupportInput(input));
  });
});
