import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExposureSessionTimer from '@/pages/ocd/ExposureSessionTimer';

/**
 * The agent's start_erp_session tool already created a real ERPSession row
 * (description + starting SUDS already decided) before navigating here.
 * Previously this page ignored location.state entirely and always opened on
 * its own "pick a compulsion type" screen — a user who then completed that
 * screen manually would create a SECOND, duplicate ERPSession row instead of
 * finishing the one the agent already started. Discovered via the same
 * audit that found the focus-session chat-overlay bug.
 */

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'ocd-agent-user' } }) }));

function renderTimer(state) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: '/ocd/exposure-session', state }]}>
        <ExposureSessionTimer />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ExposureSessionTimer — resuming the session the agent already started', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('skips the "pick a compulsion type" screen and jumps straight to the running timer', () => {
    renderTimer({ session_id: 42, title: 'Touch a doorknob', pre_suds: 65 });
    expect(screen.queryByText("1. What's the urge?")).toBeNull();
    expect(screen.getByText(/Started for you: Touch a doorknob/)).toBeTruthy();
  });

  it('still shows the normal pick screen for a manual (non-agent) visit', () => {
    renderTimer(undefined);
    expect(screen.getByText("1. What's the urge?")).toBeTruthy();
  });
});
