import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeAdaptationPlan, normalizeAdaptationPlan } from '@/support/integration';

const focusPlan = {
  id: 'plan-focus',
  userId: 'adapter-user',
  moduleId: 'support.focus_session',
  contextSnapshotId: 'context-focus',
  configuration: { plannedDurationMinutes: 15, breakDurationMinutes: 7 },
};

describe('adaptation plan adapter', () => {
  beforeEach(() => localStorage.clear());

  it('preserves Role 2 selection and configuration', () => {
    const plan = normalizeAdaptationPlan({ id: 'p', userId: 'u', moduleId: 'support.task_breakdown', contextSnapshotId: 'c', configuration: { style: 'gentle' }, alternatives: ['x'] });
    expect(plan).toMatchObject({ planId: 'p', selectedModuleId: 'support.task_breakdown', contextSnapshotId: 'c', configuration: { style: 'gentle' }, alternatives: ['x'] });
  });

  it('navigates successful Focus execution with its launch state', async () => {
    const navigate = vi.fn();
    const result = await executeAdaptationPlan(focusPlan, { navigate });

    expect(result.ok).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/adhd/focus', {
      state: expect.objectContaining({
        interventionId: result.interventionId,
        moduleId: 'support.focus_session',
        planId: 'plan-focus',
        contextSnapshotId: 'context-focus',
        configuration: { plannedDurationMinutes: 15, breakDurationMinutes: 7 },
      }),
    });
  });

  it('does not navigate deferred, failed, or non-Focus executions without a launch', async () => {
    const navigate = vi.fn();
    await executeAdaptationPlan({ ...focusPlan, moduleId: 'support.visual_timeline' }, { navigate });
    await executeAdaptationPlan({ ...focusPlan, moduleId: 'support.unknown' }, { navigate });
    await executeAdaptationPlan({ ...focusPlan, moduleId: 'support.task_breakdown' }, { navigate });

    expect(navigate).not.toHaveBeenCalled();
  });
});
