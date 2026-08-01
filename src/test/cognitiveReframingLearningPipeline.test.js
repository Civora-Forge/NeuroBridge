import { describe, expect, it } from 'vitest';
import { getSupportEvidence } from '@/support/evidence';
describe('cognitive reframing learning boundary', () => { it('returns user-scoped neutral evidence without sensitive content', () => { const evidence = getSupportEvidence('reframing-user', ['support.cognitive_reframing']); expect(evidence.modules[0].moduleId).toBe('support.cognitive_reframing'); expect(JSON.stringify(evidence)).not.toContain('thought'); }); });
