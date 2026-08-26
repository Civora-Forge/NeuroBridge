import { describe, expect, it } from 'vitest';
import { executeAdaptationPlan } from '@/support/integration';
describe('adaptation plan execution', () => { it('executes selected integrated module and never selects deferred fallback', async () => { const result = await executeAdaptationPlan({ planId: 'p', userId: 'adapter-user', selectedModuleId: 'support.task_breakdown', triggerSource: 'manual', selectionMode: 'adaptive_ranking', configuration: {}, fallbacks: ['support.grounding'] }); expect(result.ok).toBe(true); expect(result.plan.fallbacks).toEqual(['support.grounding']); }); });
