-- =============================================================================
-- Dyslexia Module: Missing Tables Migration
-- Creates: reading_sessions, word_metrics, phoneme_errors, cognitive_profiles
-- Alters:  reader_preferences (add missing columns used by ARM prefs)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. reading_sessions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reading_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id       UUID REFERENCES public.reading_files(id) ON DELETE SET NULL,
  original_text TEXT,
  wpm           NUMERIC(10,2) NOT NULL DEFAULT 0,
  reading_comfort_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  duration_seconds      NUMERIC(10,2) DEFAULT 0,
  tts_used              BOOLEAN NOT NULL DEFAULT false,
  simplification_used   BOOLEAN NOT NULL DEFAULT false,
  difficulty_interactions INTEGER NOT NULL DEFAULT 0,
  word_count            INTEGER NOT NULL DEFAULT 0,
  start_position        INTEGER NOT NULL DEFAULT 0,
  end_position          INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_created
  ON public.reading_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_file_id
  ON public.reading_sessions (file_id);

ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their reading sessions"
  ON public.reading_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their reading sessions"
  ON public.reading_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their reading sessions"
  ON public.reading_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their reading sessions"
  ON public.reading_sessions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_sessions TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. word_metrics
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.word_metrics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.reading_sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word         TEXT NOT NULL,
  dwell_time   NUMERIC(10,3) NOT NULL DEFAULT 0,
  reread_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_word_metrics_session_id
  ON public.word_metrics (session_id);

CREATE INDEX IF NOT EXISTS idx_word_metrics_user_id
  ON public.word_metrics (user_id, dwell_time DESC);

ALTER TABLE public.word_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their word metrics"
  ON public.word_metrics FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their word metrics"
  ON public.word_metrics FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.word_metrics TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. phoneme_errors
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.phoneme_errors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phoneme     TEXT NOT NULL,
  error_count INTEGER NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phoneme)
);

CREATE INDEX IF NOT EXISTS idx_phoneme_errors_user_errors
  ON public.phoneme_errors (user_id, error_count DESC);

ALTER TABLE public.phoneme_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their phoneme errors"
  ON public.phoneme_errors FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their phoneme errors"
  ON public.phoneme_errors FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their phoneme errors"
  ON public.phoneme_errors FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.phoneme_errors TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. cognitive_profiles
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cognitive_profiles (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reading_speed_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
  phonological_score      NUMERIC(5,2) NOT NULL DEFAULT 0,
  writing_stability_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  confidence_trend        NUMERIC(5,2) NOT NULL DEFAULT 0,
  visual_discrimination_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  generated_plan          JSONB DEFAULT NULL,
  session_count           INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cognitive_profiles_user_created
  ON public.cognitive_profiles (user_id, created_at DESC);

ALTER TABLE public.cognitive_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their cognitive profiles"
  ON public.cognitive_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their cognitive profiles"
  ON public.cognitive_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their cognitive profiles"
  ON public.cognitive_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.cognitive_profiles TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Alter reader_preferences — add columns used by ARM that were missing
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.reader_preferences
  ADD COLUMN IF NOT EXISTS word_spacing    DOUBLE PRECISION DEFAULT 0.1,
  ADD COLUMN IF NOT EXISTS background_color TEXT DEFAULT '#FAF3A0',
  ADD COLUMN IF NOT EXISTS text_color       TEXT DEFAULT '#1E2022',
  ADD COLUMN IF NOT EXISTS dark_mode        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_contrast    BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. reading_difficulty_interactions — track word/sentence difficulty events
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reading_difficulty_interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES public.reading_sessions(id) ON DELETE SET NULL,
  file_id     UUID REFERENCES public.reading_files(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'word_difficulty_hover', 'word_difficulty_click',
    'sentence_difficulty_view', 'simplification_requested',
    'simplification_applied', 'simplification_dismissed',
    'tts_started', 'tts_paused', 'tts_stopped',
    'settings_changed', 'recommendation_shown',
    'recommendation_applied', 'recommendation_dismissed'
  )),
  target_text  TEXT,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rdi_user_created
  ON public.reading_difficulty_interactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rdi_user_type
  ON public.reading_difficulty_interactions (user_id, interaction_type);

ALTER TABLE public.reading_difficulty_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their difficulty interactions"
  ON public.reading_difficulty_interactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their difficulty interactions"
  ON public.reading_difficulty_interactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.reading_difficulty_interactions TO authenticated;
