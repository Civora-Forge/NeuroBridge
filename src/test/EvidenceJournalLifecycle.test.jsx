import { describe, expect, it } from 'vitest';
import { assessSupportInput } from '@/support/safety';
describe('Evidence Journal safety', () => { it('blocks high-risk text before a save can begin', () => { expect(assessSupportInput({ moduleId: 'support.evidence_journal', inputType: 'free_text', text: 'I want to self harm' }).allowed).toBe(false); }); });
