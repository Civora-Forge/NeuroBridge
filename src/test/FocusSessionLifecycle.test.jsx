import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FocusSessions from '@/pages/adhd/FocusSessions';
import { getInterventionHistory } from '@/support/lifecycle/interventionLifecycle';

const auth = vi.hoisted(() => ({ user: { id: 'focus-ui-user' } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

describe('FocusSessions lifecycle UI', () => {
  beforeEach(() => { localStorage.clear(); auth.user = { id: 'focus-ui-user' }; vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('does not create an intervention until Start, then creates only one', async () => {
    render(<FocusSessions />);
    expect(getInterventionHistory(auth.user.id)).toEqual([]);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start focus block/i })));
    expect(getInterventionHistory(auth.user.id)).toHaveLength(1);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    expect(getInterventionHistory(auth.user.id)).toHaveLength(1);
  });

  it('records milestone progress but not per-second persistence, and pauses/resumes', async () => {
    render(<FocusSessions />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start focus block/i })));
    await act(async () => { vi.advanceTimersByTime(10_000); });
    let history = getInterventionHistory(auth.user.id)[0];
    expect(history.lifecycleEvents.filter((event) => event.metadata?.progress).length).toBe(0);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    expect(getInterventionHistory(auth.user.id)[0].intervention.status).toBe('paused');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Resume' })));
    expect(getInterventionHistory(auth.user.id)[0].intervention.status).toBe('in_progress');
    await act(async () => { vi.advanceTimersByTime(25 * 60 * 1000); });
    history = getInterventionHistory(auth.user.id)[0];
    expect(history.lifecycleEvents.filter((event) => event.metadata?.progress).length).toBeLessThanOrEqual(3);
    expect(history.intervention.status).toBe('completed');
    expect(history.outcomes[0].metrics.completedNaturally).toBe(true);
  });

  it('abandons only an active reset and never on unmount', async () => {
    const first = render(<FocusSessions />);
    fireEvent.click(screen.getByRole('button', { name: /Start focus block/i }));
    await act(async () => {});
    first.unmount();
    expect(getInterventionHistory(auth.user.id)[0].intervention.status).toBe('started');

    render(<FocusSessions />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start focus block/i })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reset' })));
    const abandoned = getInterventionHistory(auth.user.id).find((entry) => entry.intervention.status === 'abandoned');
    expect(abandoned).toBeTruthy();
    expect(abandoned.outcomes[0].status).toBe('abandoned');
  });

  it('keeps unauthenticated timers local and shows the sign-in explanation', async () => {
    auth.user = null;
    render(<FocusSessions />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Start focus block/i })));
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in to save Focus Session');
    expect(getInterventionHistory('focus-ui-user')).toEqual([]);
  });
});
