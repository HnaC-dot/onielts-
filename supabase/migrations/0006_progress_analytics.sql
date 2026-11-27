-- =============================================================================
-- Ôn IELTS — Migration 0006: Learning Progress & Question-Level Analytics
-- Adds normalized per-question answer storage (with question_type), composite
-- indexes for fast server-side aggregation/pagination, and strict RLS.
-- =============================================================================

-- 1. Normalized per-question answers table (powers mistake analytics & admin item stats)
CREATE TABLE IF NOT EXISTS public.test_attempt_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.test_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.ielts_tests(id) ON DELETE CASCADE,
  skill TEXT NOT NULL CHECK (skill IN ('reading', 'listening', 'writing', 'speaking')),
  question_id TEXT NOT NULL,
  question_number INT NOT NULL,
  question_type TEXT NOT NULL,
  user_answer TEXT NOT NULL DEFAULT '',
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempt_answers_user_type
  ON public.test_attempt_answers(user_id, question_type);

CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt
  ON public.test_attempt_answers(attempt_id, question_number);

CREATE INDEX IF NOT EXISTS idx_attempt_answers_test_q
  ON public.test_attempt_answers(test_id, question_number, is_correct);

ALTER TABLE public.test_attempt_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_attempt_answers_own_or_admin" ON public.test_attempt_answers;
CREATE POLICY "test_attempt_answers_own_or_admin" ON public.test_attempt_answers
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- 2. Enrich daily_exam_attempts with max_score & breakdown_by_type for unified analytics
ALTER TABLE public.daily_exam_attempts
  ADD COLUMN IF NOT EXISTS max_score INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS breakdown_by_type JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Allow learners to delete their own daily_exam_attempts when clearing study history
DROP POLICY IF EXISTS "daily_attempts_delete_own" ON public.daily_exam_attempts;
CREATE POLICY "daily_attempts_delete_own" ON public.daily_exam_attempts
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

-- 3. Composite indexes for paginated history & aggregated progress queries
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_skill_completed
  ON public.test_attempts(user_id, skill, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_attempts_test_id
  ON public.test_attempts(test_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_attempts_user_submitted
  ON public.daily_exam_attempts(user_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_speaking_user_created
  ON public.speaking_submissions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flashcards_user_reps
  ON public.flashcards(user_id, repetitions);
