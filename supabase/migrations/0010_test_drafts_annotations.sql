-- =============================================================================
-- Ôn IELTS — Migration 0010: Test Session Drafts & Annotations (Exam Upgrade GĐ3)
-- Strictly additive & idempotent. Never modifies migrations 0001–0009.
-- Stores per-user auto-saved exam drafts (answers, flagged items, scratchpad
-- notes, timer, active section) and passage highlight/note annotations (JSONB)
-- scoped by (user_id, test_slug, mode_key).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.test_session_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_slug TEXT NOT NULL,
  mode_key TEXT NOT NULL DEFAULT 'full',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  flagged JSONB NOT NULL DEFAULT '{}'::jsonb,
  annotations JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes_text TEXT NOT NULL DEFAULT '',
  timer_seconds INT NOT NULL DEFAULT 0 CHECK (timer_seconds >= 0 AND timer_seconds <= 86400),
  active_section_idx INT NOT NULL DEFAULT 0 CHECK (active_section_idx >= 0 AND active_section_idx <= 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, test_slug, mode_key)
);

CREATE INDEX IF NOT EXISTS idx_test_session_drafts_user_updated
  ON public.test_session_drafts (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_test_session_drafts_updated_at ON public.test_session_drafts;
CREATE TRIGGER trg_test_session_drafts_updated_at
  BEFORE UPDATE ON public.test_session_drafts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.test_session_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "test_session_drafts_owner_all" ON public.test_session_drafts;
CREATE POLICY "test_session_drafts_owner_all"
  ON public.test_session_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.test_session_drafts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_session_drafts TO authenticated;
GRANT ALL ON public.test_session_drafts TO service_role;
