import { describe, expect, it } from 'vitest';
import { getSupportEvidence } from '@/support/evidence';
describe('evidence journal learning boundary', () => { it('has neutral structured evidence without journal content', () => expect(getSupportEvidence('journal-user', ['support.evidence_journal']).modules[0].moduleId).toBe('support.evidence_journal')); });
