-- =============================================================================
-- Ôn IELTS — Migration 0009: Security & RLS Hardening (Giai đoạn 2)
-- Non-destructive & idempotent. Never modifies migrations 0001–0008.
-- Closes all RLS & column-privilege exposures identified in security audit:
--   1. public.ielts_tests: revoke anon/authenticated SELECT on `test_data` JSONB
--      so answer keys cannot be dumped via PostgREST (metadata columns remain readable)
--   2. public.daily_exam_attempts: block client score/completion tampering and
--      hide other users' `answers` & `user_id` (adds safe leaderboard view)
--   3. public.profiles: lock server-managed columns (`streak_count`, `last_active_date`,
--      `email_verified`, `referred_by`, `referral_code`) against self-tampering
--   4. public.site_settings: restrict public SELECT strictly to public keys
--      (`general`, `seo`, `referral`, `appearance_published`) — hides `appearance_history`
--      (admin emails) & `appearance_draft`
--   5. public.feature_requests: revoke anon/authenticated SELECT on PII/internal columns
--      (`email`, `user_id`, `admin_note`) & require server API for inserts
--   6. public.contact_messages & public.newsletter_subscribers: require rate-limited
--      server APIs (via service_role) instead of direct anon PostgREST spam inserts
--   7. public.promo_codes: close authenticated enumeration of all active discount codes
--   8. public.flashcards: enforce parent `flashcard_sets.user_id = auth.uid()` ownership
--      to eliminate cross-user set_id injection at DB layer
--   9. public.pronunciation_sounds & public.blog_posts: enforce `is_published`, `status`,
--      and `scheduled_at` visibility rules
--  10. public.admin_audit_logs & storage `cms-media`: restrict audit-log SELECT and
--      direct Storage writes to active admins only (all uploads pass /api/admin/media)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. IELTS TESTS: Hide answer keys (`test_data`) from anon/authenticated PostgREST
-- -----------------------------------------------------------------------------
REVOKE SELECT ON public.ielts_tests FROM anon, authenticated;

GRANT SELECT (
  id,
  slug,
  skill,
  module,
  title_vi,
  title_en,
  description_vi,
  description_en,
  duration_minutes,
  difficulty,
  audio_url,
  is_published,
  is_daily_eligible,
  is_premium,
  seo_meta,
  created_by,
  created_at,
  updated_at
) ON public.ielts_tests TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. DAILY EXAM ATTEMPTS: Prevent leaderboard cheating & answer snooping
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "daily_attempts_select_completed_or_own" ON public.daily_exam_attempts;
DROP POLICY IF EXISTS "daily_attempts_select_own_or_admin" ON public.daily_exam_attempts;
CREATE POLICY "daily_attempts_select_own_or_admin" ON public.daily_exam_attempts
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "daily_attempts_insert_own" ON public.daily_exam_attempts;
DROP POLICY IF EXISTS "daily_attempts_insert_own_unscored" ON public.daily_exam_attempts;
CREATE POLICY "daily_attempts_insert_own_unscored" ON public.daily_exam_attempts
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = user_id
      AND is_completed = FALSE
      AND raw_score = 0
      AND band_score = 0
      AND duration_seconds = 0
    )
  );

DROP POLICY IF EXISTS "daily_attempts_update_own_uncompleted" ON public.daily_exam_attempts;
DROP POLICY IF EXISTS "daily_attempts_update_admin_only" ON public.daily_exam_attempts;
CREATE POLICY "daily_attempts_update_admin_only" ON public.daily_exam_attempts
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Safe public leaderboard view exposing zero answers or user_ids
CREATE OR REPLACE VIEW public.daily_exam_leaderboard_public AS
SELECT
  id,
  daily_exam_id,
  display_name,
  raw_score,
  max_score,
  band_score,
  duration_seconds,
  submitted_at
FROM public.daily_exam_attempts
WHERE is_completed = TRUE;

GRANT SELECT ON public.daily_exam_leaderboard_public TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. PROFILES: Lock server-managed streak, verification & referral columns
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;
CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      AND is_locked IS NOT DISTINCT FROM (SELECT p.is_locked FROM public.profiles p WHERE p.id = auth.uid())
      AND premium_expires_at IS NOT DISTINCT FROM (SELECT p.premium_expires_at FROM public.profiles p WHERE p.id = auth.uid())
      AND streak_count IS NOT DISTINCT FROM (SELECT p.streak_count FROM public.profiles p WHERE p.id = auth.uid())
      AND last_active_date IS NOT DISTINCT FROM (SELECT p.last_active_date FROM public.profiles p WHERE p.id = auth.uid())
      AND email_verified IS NOT DISTINCT FROM (SELECT p.email_verified FROM public.profiles p WHERE p.id = auth.uid())
      AND referred_by IS NOT DISTINCT FROM (SELECT p.referred_by FROM public.profiles p WHERE p.id = auth.uid())
      AND referral_code IS NOT DISTINCT FROM (SELECT p.referral_code FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 4. SITE SETTINGS: Restrict public SELECT to public configuration keys only
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "site_settings_public_select" ON public.site_settings;
CREATE POLICY "site_settings_public_select" ON public.site_settings
  FOR SELECT USING (
    key IN ('general', 'seo', 'referral', 'appearance_published')
    OR public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- 5. FEATURE REQUESTS: Hide submitter PII & require server API for inserts
-- -----------------------------------------------------------------------------
REVOKE SELECT, INSERT ON public.feature_requests FROM anon, authenticated;

GRANT SELECT (
  id,
  title,
  description,
  votes,
  status,
  created_at
) ON public.feature_requests TO anon, authenticated;

DROP POLICY IF EXISTS "feature_requests_insert_any" ON public.feature_requests;

-- -----------------------------------------------------------------------------
-- 6. CONTACT MESSAGES & NEWSLETTER: Block direct PostgREST spam bypass
-- -----------------------------------------------------------------------------
REVOKE INSERT ON public.contact_messages FROM anon, authenticated;
DROP POLICY IF EXISTS "contact_messages_insert_any" ON public.contact_messages;

REVOKE INSERT ON public.newsletter_subscribers FROM anon, authenticated;
DROP POLICY IF EXISTS "newsletter_public_insert" ON public.newsletter_subscribers;

-- -----------------------------------------------------------------------------
-- 7. PROMO CODES: Prevent authenticated users from dumping all active codes
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "promo_codes_auth_select_active" ON public.promo_codes;

-- -----------------------------------------------------------------------------
-- 8. FLASHCARDS: Prevent cross-user set_id injection at RLS layer
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "flashcards_write_own" ON public.flashcards;
CREATE POLICY "flashcards_write_own" ON public.flashcards
  FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1
        FROM public.flashcard_sets s
        WHERE s.id = flashcards.set_id
          AND s.user_id = auth.uid()
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 9. PRONUNCIATION SOUNDS & BLOG POSTS: Enforce publish & schedule visibility
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "pronunciation_public_select" ON public.pronunciation_sounds;
CREATE POLICY "pronunciation_public_select" ON public.pronunciation_sounds
  FOR SELECT USING (is_published = TRUE OR public.is_staff());

DROP POLICY IF EXISTS "blog_posts_public_published" ON public.blog_posts;
CREATE POLICY "blog_posts_public_published" ON public.blog_posts
  FOR SELECT USING (
    (
      is_published = TRUE
      AND COALESCE(status, 'published') <> 'draft'
      AND (scheduled_at IS NULL OR scheduled_at <= NOW())
    )
    OR public.is_staff()
  );

-- -----------------------------------------------------------------------------
-- 10. ADMIN AUDIT LOGS & CMS MEDIA STORAGE: Admin-only audit read & safe upload path
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_staff_select" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.admin_audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.admin_audit_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "storage_cms_media_staff_write" ON storage.objects;
DROP POLICY IF EXISTS "storage_cms_media_admin_write" ON storage.objects;
CREATE POLICY "storage_cms_media_admin_write" ON storage.objects
  FOR ALL USING (bucket_id = 'cms-media' AND public.is_admin())
  WITH CHECK (bucket_id = 'cms-media' AND public.is_admin());
