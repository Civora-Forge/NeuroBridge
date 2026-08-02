import { describe, expect, it } from 'vitest';
import { assessSupportInput } from '@/support/safety';
import { buildEvidenceJournalOutcome, canSaveEvidenceEntry, normalizeEvidenceCategory } from '@/support/modules/evidenceJournal/evidenceJournalService';
describe('evidence journal service', () => { it('uses sensitive safety and structured outcomes', () => { const safety = assessSupportInput({ moduleId: 'support.evidence_journal', inputType: 'free_text', text: 'I attended class' }); expect(canSaveEvidenceEntry(safety)).toBe(true); expect(normalizeEvidenceCategory('bad')).toBe('survival'); expect(JSON.stringify(buildEvidenceJournalOutcome({ created: 1, saved: 1, categories: ['growth'] }))).not.toContain('attended'); }); });
