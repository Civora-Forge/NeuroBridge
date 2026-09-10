-- Real backend persistence for the ASD daily-routine/visual-schedule
-- capability (previously the ASD module had zero real backend state at
-- all). Exactly one row per user should have is_current = true.

CREATE TABLE IF NOT EXISTS public.asd_routine_steps (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  is_current boolean DEFAULT false,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asd_routine_steps_user_id ON public.asd_routine_steps (user_id);

ALTER TABLE public.asd_routine_steps ENABLE ROW LEVEL SECURITY;
