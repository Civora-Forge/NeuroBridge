import { describe, expect, it } from 'vitest';
import { assessSupportInput } from '@/support/safety';
import { buildCognitiveReframingOutcome, buildReframingClipboardPayload, canProcessReframingInput } from '@/support/modules/cognitiveReframing/cognitiveReframingService';
describe('cognitive reframing privacy boundary', () => {
  const safe = assessSupportInput({ moduleId: 'support.cognitive_reframing', inputType: 'free_text', text: 'I made one mistake' });
  const blocked = assessSupportInput({ moduleId: 'support.cognitive_reframing', inputType: 'free_text', text: 'I want to kill myself' });
  it('accepts sensitive text and blocks high-risk text before processing', () => { expect(canProcessReframingInput(safe)).toBe(true); expect(canProcessReframingInput(blocked)).toBe(false); });
  it('uses a structured outcome without text', () => { const outcome = buildCognitiveReframingOutcome({ stagesCompleted: 3, confirmed: true }); expect(outcome).toMatchObject({ completionStatus: 'completed', metrics: { stagesCompleted: 3, safetyLevel: 'sensitive' } }); expect(JSON.stringify(outcome)).not.toContain('mistake'); });
  it('copies original thought only with explicit opt-in and never for blocked input', () => { expect(buildReframingClipboardPayload({ label: 'Prompt', reframe: 'Balanced view', originalThought: 'private', safety: safe })).not.toContain('private'); expect(buildReframingClipboardPayload({ label: 'Prompt', reframe: 'Balanced view', originalThought: 'private', includeOriginalThought: true, safety: safe })).toContain('private'); expect(buildReframingClipboardPayload({ label: 'Prompt', reframe: 'Balanced view', safety: blocked })).toBeNull(); });
});
