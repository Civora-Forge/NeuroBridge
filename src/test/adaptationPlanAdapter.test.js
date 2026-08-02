import { describe, expect, it } from 'vitest';
import { normalizeAdaptationPlan } from '@/support/integration';
describe('adaptation plan adapter', () => { it('preserves Role 2 selection and configuration', () => { const plan = normalizeAdaptationPlan({ id: 'p', userId: 'u', moduleId: 'support.task_breakdown', contextSnapshotId: 'c', configuration: { style: 'gentle' }, alternatives: ['x'] }); expect(plan).toMatchObject({ planId: 'p', selectedModuleId: 'support.task_breakdown', contextSnapshotId: 'c', configuration: { style: 'gentle' }, alternatives: ['x'] }); }); });
