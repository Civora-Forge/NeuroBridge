import { describe, expect, it } from 'vitest';
import { buildSocialConnectionOutcome } from '@/support/modules/socialConnection/socialConnectionService';
describe('Social Connection lifecycle', () => { it('requires confirmation before completion', () => { expect(buildSocialConnectionOutcome({ prepared: true }).completionStatus).toBe('partially_completed'); expect(buildSocialConnectionOutcome({ prepared: true, confirmed: true }).completionStatus).toBe('completed'); }); });
