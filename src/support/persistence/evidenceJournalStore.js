import { EvidenceJournalEntrySchema } from '@/support/schemas/supportSchemas';
import { encodeStorageId, normalizeUserId } from '@/support/schemas/storageKeys';

const storageKey = (userId) => `nb_role4_journal:v1:${encodeStorageId(userId)}:evidence_entries`;
const storage = () => { if (typeof localStorage === 'undefined') throw new Error('Evidence Journal requires localStorage'); return localStorage; };
const read = (userId) => { try { const value = JSON.parse(storage().getItem(storageKey(userId)) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
const write = (userId, entries) => storage().setItem(storageKey(userId), JSON.stringify(entries));
export function listEvidenceJournalEntries(userId) { return read(userId).map((entry) => EvidenceJournalEntrySchema.safeParse(entry)).filter((result) => result.success).map((result) => result.data).filter((entry) => entry.userId === normalizeUserId(userId)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); }
export function saveEvidenceJournalEntry(userId, entry) { const normalizedUserId = normalizeUserId(userId); const parsed = EvidenceJournalEntrySchema.parse({ ...entry, userId: entry.userId ?? normalizedUserId }); if (parsed.userId !== normalizedUserId) throw new Error('Journal entry userId does not match storage userId'); const entries = read(normalizedUserId); const index = entries.findIndex((item) => item?.id === parsed.id); write(normalizedUserId, index < 0 ? [parsed, ...entries] : entries.map((item, i) => i === index ? parsed : item)); return parsed; }
export function deleteEvidenceJournalEntry(userId, entryId) { const normalizedUserId = normalizeUserId(userId); const entries = read(normalizedUserId); const next = entries.filter((entry) => entry?.id !== String(entryId)); write(normalizedUserId, next); return entries.length !== next.length; }
export function clearEvidenceJournalEntries(userId) { write(normalizeUserId(userId), []); }
