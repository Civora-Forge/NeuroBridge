-- Agentic AI Assistant — P0-P4 rework: explicit execution state machine,
-- multi-tool-call tracing, and idempotency support for confirmed writes.
--
-- Same ownership/RLS model as 20260905000000_agent_backend_tables.sql — see
-- that file's header comment for why RLS is enabled with no policies here
-- (default-deny for PostgREST's anon/authenticated roles; the FastAPI
-- backend's own connection is the table owner and is exempt).

ALTER TABLE IF EXISTS public.agent_action_logs
  ADD COLUMN IF NOT EXISTS execution_id text,
  ADD COLUMN IF NOT EXISTS args_hash text;
CREATE INDEX IF NOT EXISTS idx_agent_action_logs_execution_id ON public.agent_action_logs (execution_id);
CREATE INDEX IF NOT EXISTS idx_agent_action_logs_args_hash ON public.agent_action_logs (args_hash);

-- The authoritative, backend-owned state machine for one user turn's agent run.
-- The frontend renders THIS record's `state`, never inferred LLM prose.
CREATE TABLE IF NOT EXISTS public.agent_executions (
  id serial PRIMARY KEY,
  execution_id text UNIQUE NOT NULL,
  conversation_id integer REFERENCES public.agent_conversations(id),
  user_id text NOT NULL,
  state text NOT NULL DEFAULT 'IDLE',
  current_step integer DEFAULT 0,
  tool_name text,
  error text,
  llm_call_count integer DEFAULT 0,
  tool_call_count integer DEFAULT 0,
  retry_count integer DEFAULT 0,
  context_retrieval_ms integer,
  llm_latency_ms integer,
  tool_latency_ms integer,
  total_latency_ms integer,
  started_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  completed_at timestamp
);
CREATE INDEX IF NOT EXISTS idx_agent_executions_user_id ON public.agent_executions (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_conversation_id ON public.agent_executions (conversation_id);

ALTER TABLE public.agent_executions ENABLE ROW LEVEL SECURITY;
