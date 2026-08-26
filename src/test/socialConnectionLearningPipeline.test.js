import { describe, expect, it } from 'vitest';
import { getSupportEvidence } from '@/support/evidence';
describe('social connection evidence', () => { it('returns neutral user-scoped evidence before structured history exists', () => { expect(getSupportEvidence('social-user', ['support.social_connection']).modules[0].moduleId).toBe('support.social_connection'); }); });
