-- Wellbeing Garden & Self-Care Interactions Schema
-- Migration: 20260909000000_wellbeing_garden_tables.sql

CREATE TABLE IF NOT EXISTS public.wellbeing_gardens (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  season integer NOT NULL DEFAULT 1 CHECK (season >= 1),
  current_day_in_season integer NOT NULL DEFAULT 1 CHECK (current_day_in_season BETWEEN 1 AND 30),
  total_engagement_days integer NOT NULL DEFAULT 1 CHECK (total_engagement_days >= 1),
  leaves integer NOT NULL DEFAULT 1 CHECK (leaves BETWEEN 1 AND 6),
  flowers integer NOT NULL DEFAULT 0 CHECK (flowers >= 0),
  last_engagement_date text,
  encouraging_message text NOT NULL DEFAULT 'You don''t have to be perfect. You can keep growing.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_garden UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.wellbeing_garden_history (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  season integer NOT NULL CHECK (season >= 1),
  completed_at timestamptz NOT NULL DEFAULT now(),
  total_engagement_days integer NOT NULL,
  total_leaves integer NOT NULL DEFAULT 6,
  total_flowers integer NOT NULL DEFAULT 0,
  stage_title text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wellbeing_interactions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  interaction_type text NOT NULL,
  source text NOT NULL DEFAULT 'unknown',
  contributed_to_growth boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient user query performance
CREATE INDEX IF NOT EXISTS idx_wellbeing_gardens_user ON public.wellbeing_gardens(user_id);
CREATE INDEX IF NOT EXISTS idx_wellbeing_garden_history_user ON public.wellbeing_garden_history(user_id, season);
CREATE INDEX IF NOT EXISTS idx_wellbeing_interactions_user ON public.wellbeing_interactions(user_id, created_at);

-- Row Level Security (RLS)
ALTER TABLE public.wellbeing_gardens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellbeing_garden_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellbeing_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wellbeing_gardens
CREATE POLICY "Users can manage their own garden" ON public.wellbeing_gardens
  FOR ALL USING (auth.uid()::text = user_id OR user_id = 'default')
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'default');

-- RLS Policies for wellbeing_garden_history
CREATE POLICY "Users can manage their own garden history" ON public.wellbeing_garden_history
  FOR ALL USING (auth.uid()::text = user_id OR user_id = 'default')
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'default');

-- RLS Policies for wellbeing_interactions
CREATE POLICY "Users can manage their own wellbeing interactions" ON public.wellbeing_interactions
  FOR ALL USING (auth.uid()::text = user_id OR user_id = 'default')
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'default');
