import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FocusSessions from '@/pages/adhd/FocusSessions';
import { getInterventionHistory } from '@/support/lifecycle/interventionLifecycle';
import { AdaptiveRuntimeContext } from '@/components/adaptive/adaptiveRuntimeContext';
import { getFocusSessionHistory } from '@/support/lifecycle/focusSessionLifecycle';
import { abandonSupportModule, completeSupportModule, executeSupportModule } from '@/support/execution';

const auth = vi.hoisted(() => ({ user: { id: 'focus-ui-user' } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));

function renderFocus({ state, runtime } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/adhd/focus', state }]}>
      <AdaptiveRuntimeContext.Provider value={runtime ?? null}>
        <FocusSessions />
      </AdaptiveRuntimeContext.Provider>
    </MemoryRouter>,
  );
}

describe('FocusSessions lifecycle UI', () => {
  beforeEach(() => { localStorage.clear(); auth.user = { id: 'focus-ui-user' }; vi.useFakeTimers(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  async function recordTerminalSession(minutes, status) {
    const started = await executeSupportModule({ userId: auth.user.id, moduleId: 'support.focus_session', contextSnapshotId: null, triggerSource: 'manual', selectionMode: 'explicit_request', configuration: { plannedDurationMinutes: minutes, breakDurationMinutes: 5 }, metadata: {} });
    const outcome = { completionStatus: status === 'completed' ? 'completed' : 'partially_completed', metrics: { plannedDurationMinutes: minutes, completionRatio: status === 'completed' ? 1 : 0.1 }, finalConfiguration: { plannedDurationMinutes: minutes, breakDurationMinutes: 5 } };
    return status === 'completed'
      ? completeSupportModule({ userId: auth.user.id, interventionId: started.interventionId, moduleId: 'support.focus_session', outcome })
      : abandonSupportModule({ userId: auth.user.id, interventionId: started.interventionId, moduleId: 'support.focus_session', outcome });
  }

  it('does not create an intervention until Start, then creates only one', async () => {
    renderFocus();
    expect(getInterventionHistory(auth.user.id)).toEqual([]);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    expect(getInterventionHistory(auth.user.id)).toHaveLength(1);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    expect(getInterventionHistory(auth.user.id)).toHaveLength(1);
  });

  it('records milestone progress but not per-second persistence, and pauses/resumes', async () => {
    renderFocus();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    await act(async () => { vi.advanceTimersByTime(10000); });
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
    const first = renderFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await act(async () => {});
    first.unmount();
    expect(getInterventionHistory(auth.user.id)[0].intervention.status).toBe('started');

    renderFocus();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'End' })));
    const abandoned = getInterventionHistory(auth.user.id).find((entry) => entry.intervention.status === 'abandoned');
    expect(abandoned).toBeTruthy();
    expect(abandoned.outcomes[0].status).toBe('abandoned');
  });

  it('keeps unauthenticated timers local and shows the sign-in explanation', async () => {
    auth.user = null;
    renderFocus();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in to save Focus Session');
    expect(getInterventionHistory('focus-ui-user')).toEqual([]);
  });

  it('runs the Quick 15-minute preset through start, pause, resume, and reset', async () => {
    renderFocus();
    fireEvent.click(screen.getByRole('button', { name: /15 min Sprint/i }));
    expect(screen.getByText('15:00')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pause' })));
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Resume' })));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'End' })));
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
    expect(screen.getByText('15:00')).toBeTruthy();
  });

  it('continues a handed-off intervention without creating a duplicate', async () => {
    const execution = await executeSupportModule({
      userId: auth.user.id,
      moduleId: 'support.focus_session',
      contextSnapshotId: 'context-focus',
      triggerSource: 'system',
      selectionMode: 'adaptive_ranking',
      configuration: { plannedDurationMinutes: 15, breakDurationMinutes: 7 },
      metadata: { planId: 'plan-focus' },
    });
    renderFocus({ state: execution.launch.state });

    expect(screen.getByText('15:00')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start' })));
    expect(await getFocusSessionHistory(auth.user.id)).toHaveLength(1);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'End' })));
    const history = await getFocusSessionHistory(auth.user.id);
    expect(history).toHaveLength(1);
    expect(history[0].intervention.id).toBe(execution.interventionId);
    expect(history[0].outcomes[0].metrics.finalConfiguration.breakDurationMinutes).toBe(7);
  });

  it('recommends 15 minutes from persisted Focus history after a later reload, while preserving either user choice', async () => {
    await recordTerminalSession(15, 'completed');
    await recordTerminalSession(15, 'completed');
    await recordTerminalSession(15, 'completed');
    await recordTerminalSession(25, 'abandoned');
    expect(await getFocusSessionHistory(auth.user.id)).toHaveLength(4);

    const first = renderFocus();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /25 min Classic/i })); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('15 min may work better')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Use 15 min' }));
    expect(screen.getByText('15:00')).toBeTruthy();
    first.unmount();

    renderFocus();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /25 min Classic/i })); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('15 min may work better')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep 25 min' }));
    expect(screen.getByText('25:00')).toBeTruthy();
    expect(screen.queryByText('15 min may work better')).toBeNull();
  });

  it('uses legacy duration_minutes navigation state when canonical configuration is absent', () => {
    renderFocus({ state: { duration_minutes: 45, intent: 'Read chapter 3' } });
    expect(screen.getByText('45:00')).toBeTruthy();
    expect(screen.getByDisplayValue('Read chapter 3')).toBeTruthy();
  });
});
