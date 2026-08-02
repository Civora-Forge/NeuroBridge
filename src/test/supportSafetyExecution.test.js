import { beforeEach, describe, expect, it } from 'vitest';
import { executeSupportModule } from '@/support/execution';
import { getInterventionHistory } from '@/support/lifecycle/interventionLifecycle';

const USER_ID = 'safety-execution-user';
const request = (moduleId, explicitRequest = '') => ({ userId: USER_ID, moduleId, contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: {}, metadata: explicitRequest ? { explicitRequest } : {} });
describe('support safety execution', () => {
  beforeEach(() => localStorage.clear());
  it('keeps structured canonical modules executable', async () => {
    const results = await Promise.all(['support.task_breakdown', 'support.focus_session', 'support.gentle_activity'].map((id) => executeSupportModule(request(id))));
    expect(results.every((result) => result.ok)).toBe(true);
  });
  it('blocks high-risk explicit requests without creating ordinary records', async () => {
    const result = await executeSupportModule(request('support.cognitive_reframing', 'I want to self harm'));
    expect(result).toMatchObject({ ok: false, status: 'blocked' });
    expect(JSON.stringify(result)).not.toContain('self harm');
    expect(getInterventionHistory(USER_ID)).toEqual([]);
  });
  it('does not allow legacy or hidden Void Whisper execution', async () => {
    const result = await executeSupportModule(request('depression.void-whisper'));
    expect(result.ok).toBe(false);
    expect(getInterventionHistory(USER_ID)).toEqual([]);
  });
});
