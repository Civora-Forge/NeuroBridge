-- Agentic AI Assistant — backend schema.
--
-- These tables are owned by the FastAPI backend (backend/models/*.py) and are
-- normally provisioned automatically via SQLAlchemy's Base.metadata.create_all
-- on backend startup. This migration exists so the schema is documented and
-- reproducible here too, for whenever DATABASE_URL points at this Supabase
-- Postgres instance (matching the project's existing migration convention).
--
-- Ownership columns store the real Supabase auth.users UUID as text (verified
-- server-side per-request via backend/auth.py — there is no local shadow
-- "users" table). Authorization for these tables is enforced by the FastAPI
-- app layer (every route filters by the authenticated user's id) — proven by
-- backend/tests/test_*_isolation.py, not just asserted here.
--
-- IMPORTANT — RLS on these tables is about a DIFFERENT threat than usual:
-- if DATABASE_URL points at the same Postgres instance as this Supabase
-- project (the natural production setup), these tables live in the same
-- `public` schema Supabase's PostgREST layer auto-exposes over REST to
-- anyone holding the anon key — which is public, already bundled into the
-- frontend. Without RLS, `GET {SUPABASE_URL}/rest/v1/exposure_hierarchies`
-- would leak every user's data straight through PostgREST, completely
-- bypassing the FastAPI auth layer. We enable RLS with *no* policies on every
-- FastAPI-owned table below: that's a default-deny for PostgREST's `anon`/
-- `authenticated` roles, while the FastAPI backend keeps working, because the
-- role that ran `create_all` is the table owner and owners are exempt from
-- RLS unless FORCE ROW LEVEL SECURITY is also set (deliberately not used
-- here). This requires backend DATABASE_URL to use that owning/superuser-
-- style connection (Supabase's standard direct/pooled connection string) —
-- not the `anon`/`authenticated` roles used for anon-key REST access.

-- Drop the legacy integer-keyed shadow "users" table and its FKs, if present
-- from an earlier deploy of the prototype agent (no real user data was ever
-- stored there — every row used the hardcoded owner_id = 1).
ALTER TABLE IF EXISTS public.exposure_hierarchies DROP CONSTRAINT IF EXISTS exposure_hierarchies_owner_id_fkey;
ALTER TABLE IF EXISTS public.erp_sessions DROP CONSTRAINT IF EXISTS erp_sessions_owner_id_fkey;
ALTER TABLE IF EXISTS public.suds_logs DROP CONSTRAINT IF EXISTS suds_logs_owner_id_fkey;
ALTER TABLE IF EXISTS public.ocd_journal_entries DROP CONSTRAINT IF EXISTS ocd_journal_entries_owner_id_fkey;
ALTER TABLE IF EXISTS public.adhd_task_breakdowns DROP CONSTRAINT IF EXISTS adhd_task_breakdowns_user_id_fkey;
ALTER TABLE IF EXISTS public.adhd_focus_sessions DROP CONSTRAINT IF EXISTS adhd_focus_sessions_user_id_fkey;
ALTER TABLE IF EXISTS public.anxiety_grounding_sessions DROP CONSTRAINT IF EXISTS anxiety_grounding_sessions_user_id_fkey;
ALTER TABLE IF EXISTS public.agent_conversations DROP CONSTRAINT IF EXISTS agent_conversations_user_id_fkey;
ALTER TABLE IF EXISTS public.agent_learnings DROP CONSTRAINT IF EXISTS agent_learnings_user_id_fkey;
ALTER TABLE IF EXISTS public.asd_social_scenarios DROP CONSTRAINT IF EXISTS asd_social_scenarios_user_id_fkey;
DROP TABLE IF EXISTS public.users;

-- Widen legacy integer owner/user id columns to text (Supabase UUID), if this
-- migration is applied against a database that already has the old prototype
-- schema. No-op on a fresh database (columns won't exist yet, IF EXISTS guards
-- both the table and the ALTER).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('exposure_hierarchies', 'owner_id'),
      ('erp_sessions', 'owner_id'),
      ('suds_logs', 'owner_id'),
      ('ocd_journal_entries', 'owner_id'),
      ('adhd_task_breakdowns', 'user_id'),
      ('adhd_focus_sessions', 'user_id'),
      ('anxiety_grounding_sessions', 'user_id'),
      ('agent_conversations', 'user_id'),
      ('agent_learnings', 'user_id'),
      ('asd_social_scenarios', 'user_id')
    ) AS cols(table_name, column_name)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE text USING %I::text',
        t.table_name, t.column_name, t.column_name
      );
    END IF;
  END LOOP;
END $$;

-- New columns on erp_sessions to support the agent's start/record/complete flow
-- (in addition to the pre-existing "fill in everything at once" flow the UI already uses).
ALTER TABLE IF EXISTS public.erp_sessions
  ALTER COLUMN post_suds DROP NOT NULL,
  ALTER COLUMN duration_seconds DROP NOT NULL,
  ALTER COLUMN resisted_compulsion DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS exposure_task_id integer REFERENCES public.exposure_tasks(id),
  ADD COLUMN IF NOT EXISTS completed_at timestamp;

ALTER TABLE IF EXISTS public.suds_logs
  ADD COLUMN IF NOT EXISTS session_id integer REFERENCES public.erp_sessions(id);

-- New observability + personalization tables.
CREATE TABLE IF NOT EXISTS public.agent_action_logs (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  conversation_id integer REFERENCES public.agent_conversations(id),
  tool_name text,
  tool_args jsonb,
  risk_level text,
  status text NOT NULL,
  error_message text,
  latency_ms integer,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_action_logs_user_id ON public.agent_action_logs (user_id);

CREATE TABLE IF NOT EXISTS public.intervention_outcomes (
  id serial PRIMARY KEY,
  user_id text NOT NULL,
  module text NOT NULL,
  tool_name text,
  outcome_type text NOT NULL,
  rating integer,
  meta jsonb,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_user_id ON public.intervention_outcomes (user_id);

-- Default-deny RLS on every FastAPI-owned table (see the big comment at the top of
-- this file for why — this is about blocking PostgREST exposure, not about the
-- FastAPI app's own authorization, which is a separate, already-tested layer).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'exposure_hierarchies', 'exposure_tasks', 'erp_sessions', 'suds_logs', 'ocd_journal_entries',
      'adhd_task_breakdowns', 'adhd_task_steps', 'adhd_focus_sessions',
      'anxiety_grounding_sessions',
      'agent_conversations', 'agent_messages', 'agent_learnings', 'agent_action_logs', 'intervention_outcomes',
      'asd_social_scenarios'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;
