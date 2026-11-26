-- =============================================================================
-- Ôn IELTS — Admin CMS Schema Migration (GĐ1)
-- 100% Non-destructive & Idempotent:
--   1. Extends public.profiles with 'editor' role & is_locked flag
--   2. Adds public.is_staff() helper & tightens public.is_admin() against locked accounts
--   3. Creates CMS tables: admin_audit_logs, media_assets, conversation_topics,
--      writing_exercises, static_pages, faqs, site_settings, seo_redirects
--   4. Adds additive CMS/SEO columns (seo_meta, status, is_premium, etc.) to existing tables
--   5. Provisions public Supabase Storage bucket 'cms-media' with staff-only write RLS
--   6. Grants base privileges to anon / authenticated / service_role (prevents 42501)
-- =============================================================================

-- 1. Extend public.profiles for admin / editor / learner + account locking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('learner', 'editor', 'admin'));

-- Update is_admin() to also require NOT is_locked
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND COALESCE(is_locked, FALSE) = FALSE
  );
$$;

-- New helper: admin or editor (unlocked)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'editor')
      AND COALESCE(is_locked, FALSE) = FALSE
  );
$$;

-- Harden profiles_update_own_safe so users cannot unlock themselves or self-escalate role/premium
DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;
CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      AND is_locked = (SELECT p.is_locked FROM public.profiles p WHERE p.id = auth.uid())
      AND premium_expires_at IS NOT DISTINCT FROM (SELECT p.premium_expires_at FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- 2. Admin Audit Logs (who modified what, when)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT 'admin',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_label TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created
  ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity
  ON public.admin_audit_logs(entity_type, created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_staff_select" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_staff_select" ON public.admin_audit_logs
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "audit_logs_staff_insert" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_staff_insert" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.is_staff());

-- 3. Media Library (Supabase Storage metadata + usage tracking)
CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket TEXT NOT NULL DEFAULT 'cms-media',
  storage_path TEXT UNIQUE NOT NULL,
  public_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  width INT,
  height INT,
  alt_text TEXT NOT NULL DEFAULT '',
  folder TEXT NOT NULL DEFAULT 'general',
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_created
  ON public.media_assets(created_at DESC);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_assets_public_select" ON public.media_assets;
CREATE POLICY "media_assets_public_select" ON public.media_assets
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "media_assets_staff_write" ON public.media_assets;
CREATE POLICY "media_assets_staff_write" ON public.media_assets
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 4. AI Conversation Topics (previously hardcoded in seed-data.ts)
CREATE TABLE IF NOT EXISTS public.conversation_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  part TEXT NOT NULL DEFAULT 'part_1' CHECK (part IN ('part_1', 'part_2', 'part_3')),
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_vi TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  vocabulary JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  system_prompt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'scheduled')),
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS conversation_topics_updated_at ON public.conversation_topics;
CREATE TRIGGER conversation_topics_updated_at
  BEFORE UPDATE ON public.conversation_topics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.conversation_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation_topics_public_select" ON public.conversation_topics;
CREATE POLICY "conversation_topics_public_select" ON public.conversation_topics
  FOR SELECT USING (status = 'published' OR public.is_staff());

DROP POLICY IF EXISTS "conversation_topics_staff_all" ON public.conversation_topics;
CREATE POLICY "conversation_topics_staff_all" ON public.conversation_topics
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 5. Writing Improvement Exercises (Band 5.5 -> 8.0+, previously hardcoded)
CREATE TABLE IF NOT EXISTS public.writing_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  topic_vi TEXT NOT NULL,
  topic_en TEXT NOT NULL,
  original_sentence TEXT NOT NULL,
  practice_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_band8 TEXT NOT NULL DEFAULT '',
  criteria TEXT[] NOT NULL DEFAULT ARRAY['Lexical Resource', 'Grammatical Range'],
  explanation_vi TEXT NOT NULL DEFAULT '',
  explanation_en TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'scheduled')),
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS writing_exercises_updated_at ON public.writing_exercises;
CREATE TRIGGER writing_exercises_updated_at
  BEFORE UPDATE ON public.writing_exercises
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.writing_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "writing_exercises_public_select" ON public.writing_exercises;
CREATE POLICY "writing_exercises_public_select" ON public.writing_exercises
  FOR SELECT USING (status = 'published' OR public.is_staff());

DROP POLICY IF EXISTS "writing_exercises_staff_all" ON public.writing_exercises;
CREATE POLICY "writing_exercises_staff_all" ON public.writing_exercises
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 6. Static & Legal Pages (/about, /legal/*)
CREATE TABLE IF NOT EXISTS public.static_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_vi TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  sections_vi JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections_en JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'scheduled')),
  seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS static_pages_updated_at ON public.static_pages;
CREATE TRIGGER static_pages_updated_at
  BEFORE UPDATE ON public.static_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.static_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "static_pages_public_select" ON public.static_pages;
CREATE POLICY "static_pages_public_select" ON public.static_pages
  FOR SELECT USING (status = 'published' OR public.is_staff());

DROP POLICY IF EXISTS "static_pages_staff_all" ON public.static_pages;
CREATE POLICY "static_pages_staff_all" ON public.static_pages
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 7. FAQs
CREATE TABLE IF NOT EXISTS public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_vi TEXT NOT NULL,
  question_en TEXT NOT NULL DEFAULT '',
  answer_vi TEXT NOT NULL,
  answer_en TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS faqs_updated_at ON public.faqs;
CREATE TRIGGER faqs_updated_at
  BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faqs_public_select" ON public.faqs;
CREATE POLICY "faqs_public_select" ON public.faqs
  FOR SELECT USING (is_published = TRUE OR public.is_staff());

DROP POLICY IF EXISTS "faqs_staff_all" ON public.faqs;
CREATE POLICY "faqs_staff_all" ON public.faqs
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 8. Site & Global SEO Settings (admin-only write)
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS site_settings_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings_public_select" ON public.site_settings;
CREATE POLICY "site_settings_public_select" ON public.site_settings
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "site_settings_admin_all" ON public.site_settings;
CREATE POLICY "site_settings_admin_all" ON public.site_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9. SEO 301/302 Redirects
CREATE TABLE IF NOT EXISTS public.seo_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_path TEXT UNIQUE NOT NULL,
  destination_path TEXT NOT NULL,
  status_code INT NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  hit_count INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS seo_redirects_updated_at ON public.seo_redirects;
CREATE TRIGGER seo_redirects_updated_at
  BEFORE UPDATE ON public.seo_redirects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.seo_redirects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seo_redirects_public_select" ON public.seo_redirects;
CREATE POLICY "seo_redirects_public_select" ON public.seo_redirects
  FOR SELECT USING (is_active = TRUE OR public.is_staff());

DROP POLICY IF EXISTS "seo_redirects_staff_all" ON public.seo_redirects;
CREATE POLICY "seo_redirects_staff_all" ON public.seo_redirects
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 10. Additive CMS & SEO columns on existing content tables (non-destructive)
ALTER TABLE public.ielts_tests
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.dictation_lessons
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.pronunciation_sounds
  ADD COLUMN IF NOT EXISTS mouth_image_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.learn_videos
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS seo_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Allow editors to manage content tables as well as admins
DROP POLICY IF EXISTS "ielts_tests_staff_all" ON public.ielts_tests;
CREATE POLICY "ielts_tests_staff_all" ON public.ielts_tests
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "blog_posts_staff_all" ON public.blog_posts;
CREATE POLICY "blog_posts_staff_all" ON public.blog_posts
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "courses_staff_all" ON public.courses;
CREATE POLICY "courses_staff_all" ON public.courses
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "dictation_staff_all" ON public.dictation_lessons;
CREATE POLICY "dictation_staff_all" ON public.dictation_lessons
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "pronunciation_staff_all" ON public.pronunciation_sounds;
CREATE POLICY "pronunciation_staff_all" ON public.pronunciation_sounds
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "learn_videos_staff_all" ON public.learn_videos;
CREATE POLICY "learn_videos_staff_all" ON public.learn_videos
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 11. Supabase Storage bucket for CMS Media (public read, staff write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cms-media',
  'cms-media',
  TRUE,
  26214400,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_cms_media_public_read" ON storage.objects;
CREATE POLICY "storage_cms_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'cms-media');

DROP POLICY IF EXISTS "storage_cms_media_staff_write" ON storage.objects;
CREATE POLICY "storage_cms_media_staff_write" ON storage.objects
  FOR ALL USING (bucket_id = 'cms-media' AND public.is_staff())
  WITH CHECK (bucket_id = 'cms-media' AND public.is_staff());

-- 12. Base SQL Grants for PostgREST roles (prevents 42501 on all newly added tables)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated, service_role;
