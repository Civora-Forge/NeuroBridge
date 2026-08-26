-- Migration: Create reading_files table and storage configuration for Dyslexia Reader

-- 1. Create reading_files table
CREATE TABLE IF NOT EXISTS public.reading_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT,
  source TEXT NOT NULL CHECK (source IN ('scan', 'gallery', 'upload', 'files', 'scan-text', 'scan-pages')),
  page_count INTEGER NOT NULL DEFAULT 1,
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_text TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create index on user_id and created_at DESC for efficient history queries
CREATE INDEX IF NOT EXISTS idx_reading_files_user_created
  ON public.reading_files (user_id, created_at DESC);

-- 3. Enable Row Level Security (RLS) on reading_files
ALTER TABLE public.reading_files ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for reading_files
CREATE POLICY "Users can view their own reading files"
  ON public.reading_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading files"
  ON public.reading_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading files"
  ON public.reading_files FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reading files"
  ON public.reading_files FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Create storage bucket reader-files
INSERT INTO storage.buckets (id, name, public)
VALUES ('reader-files', 'reader-files', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage object policies for reader-files bucket
CREATE POLICY "Authenticated users can select own objects in reader-files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'reader-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can insert own objects in reader-files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'reader-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can update own objects in reader-files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'reader-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can delete own objects in reader-files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'reader-files' AND (storage.foldername(name))[1] = auth.uid()::text);
