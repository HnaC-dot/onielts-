-- =============================================================================
-- Ôn IELTS — Migration 0007: Content Production Toolkit
-- Adds:
--   1. public.content_calendar_items (editorial calendar: blog / test / video)
--   2. public.newsletter_subscribers (blog email subscriptions + CSV export)
--   3. blog_posts.updated_at column (display real updated date on /blog/[slug])
-- All new tables enable Row Level Security with strict staff/public policies.
-- =============================================================================

-- 1. Editorial Content Calendar
CREATE TABLE IF NOT EXISTS public.content_calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('blog', 'test', 'video')),
  workflow_status TEXT NOT NULL DEFAULT 'idea'
    CHECK (workflow_status IN ('idea', 'writing', 'review', 'scheduled', 'published')),
  assignee_name TEXT NOT NULL DEFAULT '',
  planned_date DATE NOT NULL,
  linked_href TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_calendar_planned_status
  ON public.content_calendar_items(planned_date, workflow_status);

ALTER TABLE public.content_calendar_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_calendar_staff_all" ON public.content_calendar_items;
CREATE POLICY "content_calendar_staff_all" ON public.content_calendar_items
  FOR ALL USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 2. Blog Newsletter Subscribers
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source_slug TEXT,
  locale TEXT NOT NULL DEFAULT 'vi',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_subscribed_at
  ON public.newsletter_subscribers(subscribed_at DESC);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_public_insert" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_public_insert" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (
    length(trim(email)) >= 5
    AND position('@' in email) > 1
  );

DROP POLICY IF EXISTS "newsletter_staff_select" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_staff_select" ON public.newsletter_subscribers
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "newsletter_staff_update" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_staff_update" ON public.newsletter_subscribers
  FOR UPDATE USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "newsletter_staff_delete" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_staff_delete" ON public.newsletter_subscribers
  FOR DELETE USING (public.is_staff());

-- 3. Track real updated timestamp on blog_posts for public "Ngày cập nhật" display & Article JSON-LD
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
