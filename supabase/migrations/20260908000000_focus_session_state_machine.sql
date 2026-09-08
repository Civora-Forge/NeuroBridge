-- Extends adhd_focus_sessions with real, agent-controllable session state
-- (RUNNING/PAUSED/STOPPED/COMPLETED + timing) so the agent's
-- pause/resume/stop/update tools have an authoritative record independent
-- of any particular browser tab, instead of the previously-vestigial
-- 'planned'/'completed'/'abandoned' status that nothing ever wrote.

ALTER TABLE IF EXISTS public.adhd_focus_sessions
  ALTER COLUMN status SET DEFAULT 'RUNNING',
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS accumulated_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;
