import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MVHProtocol from '@/pages/depression/MVHProtocol';
import { getInterventionHistory } from '@/support/lifecycle/interventionLifecycle';

const auth = vi.hoisted(() => ({ user: { id: 'gentle-ui-user' } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

describe('Gentle Activity lifecycle UI', () => {
  beforeEach(() => { localStorage.clear(); auth.user = { id: 'gentle-ui-user' }; });
  afterEach(cleanup);
  it('does not start on render, starts on first action, and persists aggregate progress without labels', async () => {
    render(<MVHProtocol />);
    expect(getInterventionHistory(auth.user.id)).toEqual([]);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /I did this/i })));
    const history = getInterventionHistory(auth.user.id);
    expect(history).toHaveLength(1);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /I did this/i })));
    const progress = getInterventionHistory(auth.user.id)[0].lifecycleEvents.filter((event) => event.metadata?.progress);
    expect(progress.length).toBeGreaterThan(0);
    expect(JSON.stringify(getInterventionHistory(auth.user.id))).not.toContain('Touch something cold');
  });
  it('abandons explicit active reset but keeps unauthenticated use local', async () => {
    render(<MVHProtocol />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /I did this/i })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reset activity' })));
    expect(getInterventionHistory(auth.user.id)[0].intervention.status).toBe('abandoned');
    const persistedCount = getInterventionHistory(auth.user.id).length;
    cleanup(); auth.user = null;
    render(<MVHProtocol />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /I did this/i })));
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in to save activity');
    expect(getInterventionHistory('gentle-ui-user')).toHaveLength(persistedCount);
  });
});
