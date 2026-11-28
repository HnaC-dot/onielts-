-- =============================================================================
-- 0011: Strictly additive per-post Blog title size override
-- Default NULL = inherit global Blog heading typography setting from Appearance CMS.
-- Never deletes or modifies any existing blog_posts rows.
-- =============================================================================
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS title_size TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'blog_posts_title_size_check'
  ) THEN
    ALTER TABLE public.blog_posts
      ADD CONSTRAINT blog_posts_title_size_check
      CHECK (title_size IS NULL OR title_size IN ('lg', 'xl'));
  END IF;
END
$$;
