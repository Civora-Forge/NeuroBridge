import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AnxietyPage from '@/pages/AnxietyPage';

/**
 * The agent's start_grounding_activity tool already picked and started a
 * real exercise before navigating here (see backend/services/agent_tools.py
 * _start_grounding_activity) — this page previously ignored location.state
 * entirely (confirmed via audit: no useLocation import at all), so the
 * exercise the agent "started" never actually became visible without the
 * user re-picking it manually. Discovered via the same audit that found the
 * focus-session chat-overlay bug.
 */

// jsdom has no IntersectionObserver — framer-motion's whileInView needs one.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'anxiety-agent-user' } }) }));
vi.mock('@/hooks/useSensoryReducedMotion', () => ({ useSensoryReducedMotion: () => ({ reduced: true, gentle: true }) }));
vi.mock('@/hooks/useFeatureAdaptation', () => ({ useFeatureAdaptation: () => ({ configuration: null }) }));
vi.mock('@/context/ContextProvider', () => ({ useContextStateOptional: () => null }));

function renderAnxietyPage(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/anxiety', state }]}>
      <AnxietyPage />
    </MemoryRouter>,
  );
}

describe('AnxietyPage — auto-opening the exercise the agent already started', () => {
  afterEach(() => cleanup());

  it('opens the intervention modal for a Box Breathing session started by the agent', () => {
    renderAnxietyPage({ exercise_type: 'Box Breathing' });
    expect(screen.getByRole('dialog', { name: 'Intervention' })).toBeTruthy();
  });

  it('opens the intervention modal for a 5-4-3-2-1 Senses session started by the agent', () => {
    renderAnxietyPage({ exercise_type: '5-4-3-2-1 Senses' });
    expect(screen.getByRole('dialog', { name: 'Intervention' })).toBeTruthy();
  });

  it('does not open any modal when the user just navigated here manually', () => {
    renderAnxietyPage(undefined);
    expect(screen.queryByRole('dialog', { name: 'Intervention' })).toBeNull();
  });

  it('does not open any modal for an unrecognized exercise_type', () => {
    renderAnxietyPage({ exercise_type: 'Something Unexpected' });
    expect(screen.queryByRole('dialog', { name: 'Intervention' })).toBeNull();
  });
});
