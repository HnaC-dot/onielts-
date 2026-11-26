-- =============================================================================
-- Ôn IELTS (onielts.vn) — Initial Database Schema & Row Level Security (RLS)
-- Every single table has RLS enabled and explicit policies defined.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper trigger: automatically bump updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 1. PROFILES
-- =============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'admin')),
  target_band NUMERIC(2,1) NOT NULL DEFAULT 6.5,
  current_band NUMERIC(2,1),
  locale TEXT NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
  premium_expires_at TIMESTAMPTZ,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  streak_count INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function: check whether current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND role = 'learner'
    AND premium_expires_at IS NULL
  );

CREATE POLICY "profiles_update_own_safe" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = id
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      AND premium_expires_at IS NOT DISTINCT FROM (SELECT p.premium_expires_at FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- =============================================================================
-- 2. BAND CONVERSION TABLES (Editable in Admin)
-- =============================================================================
CREATE TABLE public.band_conversion_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill TEXT NOT NULL CHECK (skill IN ('listening', 'reading_academic', 'reading_general')),
  min_raw INT NOT NULL CHECK (min_raw >= 0 AND min_raw <= 40),
  max_raw INT NOT NULL CHECK (max_raw >= min_raw AND max_raw <= 40),
  band_score NUMERIC(2,1) NOT NULL CHECK (band_score >= 0.0 AND band_score <= 9.0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.band_conversion_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "band_conversion_public_select" ON public.band_conversion_tables
  FOR SELECT USING (TRUE);

CREATE POLICY "band_conversion_admin_all" ON public.band_conversion_tables
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 3. PRICING PLANS, PROMO BANNERS, PROMO CODES
-- =============================================================================
CREATE TABLE public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  duration_months INT NOT NULL CHECK (duration_months > 0),
  price_vnd INT NOT NULL CHECK (price_vnd >= 0),
  original_price_vnd INT NOT NULL CHECK (original_price_vnd >= price_vnd),
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  features_vi JSONB NOT NULL DEFAULT '[]'::jsonb,
  features_en JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_plans_public_select" ON public.pricing_plans
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "pricing_plans_admin_all" ON public.pricing_plans
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.promo_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  badge_vi TEXT NOT NULL,
  badge_en TEXT NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  cta_vi TEXT NOT NULL,
  cta_en TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_banners_public_select" ON public.promo_banners
  FOR SELECT USING (is_active = TRUE OR public.is_admin());

CREATE POLICY "promo_banners_admin_all" ON public.promo_banners
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_percent INT NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 90),
  max_discount_vnd INT,
  max_uses INT,
  current_uses INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_codes_auth_select_active" ON public.promo_codes
  FOR SELECT USING ((auth.uid() IS NOT NULL AND is_active = TRUE) OR public.is_admin());

CREATE POLICY "promo_codes_admin_all" ON public.promo_codes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 4. ORDERS (PayOS / Pluggable Providers — Idempotent Webhook Support)
-- =============================================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
  order_code BIGINT UNIQUE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'payos' CHECK (provider IN ('payos', 'vnpay', 'momo', 'stripe', 'mock')),
  amount_vnd INT NOT NULL CHECK (amount_vnd >= 0),
  discount_vnd INT NOT NULL DEFAULT 0,
  promo_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired', 'refunded')),
  checkout_url TEXT,
  qr_code TEXT,
  webhook_event_id TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON public.orders(user_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select_own_or_admin" ON public.orders
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "orders_insert_own_pending" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "orders_admin_update" ON public.orders
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 5. AI USAGE LOGS & AI CACHE
-- =============================================================================
CREATE TABLE public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  skill TEXT,
  model TEXT NOT NULL,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user_created ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature ON public.ai_usage_logs(feature, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_select_own_or_admin" ON public.ai_usage_logs
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "ai_usage_insert_own_or_admin" ON public.ai_usage_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.ai_cache (
  cache_key TEXT PRIMARY KEY,
  feature TEXT NOT NULL,
  response_json JSONB NOT NULL,
  model TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_cache_admin_only" ON public.ai_cache
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 6. IELTS TESTS, ATTEMPTS, DAILY EXAMS & LEADERBOARD
-- =============================================================================
CREATE TABLE public.ielts_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN ('reading', 'listening', 'writing', 'speaking')),
  module TEXT NOT NULL DEFAULT 'academic' CHECK (module IN ('academic', 'general')),
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_vi TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  duration_minutes INT NOT NULL DEFAULT 60,
  difficulty TEXT NOT NULL DEFAULT 'band_6_7' CHECK (difficulty IN ('band_5_6', 'band_6_7', 'band_7_plus')),
  audio_url TEXT,
  test_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  is_daily_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER ielts_tests_updated_at
  BEFORE UPDATE ON public.ielts_tests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.ielts_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ielts_tests_public_published" ON public.ielts_tests
  FOR SELECT USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "ielts_tests_admin_all" ON public.ielts_tests
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.test_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.ielts_tests(id) ON DELETE CASCADE,
  skill TEXT NOT NULL CHECK (skill IN ('reading', 'listening', 'writing', 'speaking')),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_score INT NOT NULL DEFAULT 0,
  max_score INT NOT NULL DEFAULT 40,
  band_score NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  breakdown_by_type JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_attempts_user ON public.test_attempts(user_id, created_at DESC);

ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "test_attempts_own_or_admin" ON public.test_attempts
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.daily_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_date DATE UNIQUE NOT NULL,
  test_id UUID NOT NULL REFERENCES public.ielts_tests(id) ON DELETE CASCADE,
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 900,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_exams_public_select" ON public.daily_exams
  FOR SELECT USING (TRUE);

CREATE POLICY "daily_exams_admin_all" ON public.daily_exams
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.daily_exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_exam_id UUID NOT NULL REFERENCES public.daily_exams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Học viên',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_score INT NOT NULL DEFAULT 0,
  band_score NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  duration_seconds INT NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(daily_exam_id, user_id)
);

CREATE INDEX idx_daily_attempts_rank ON public.daily_exam_attempts(daily_exam_id, raw_score DESC, duration_seconds ASC);

ALTER TABLE public.daily_exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_attempts_select_completed_or_own" ON public.daily_exam_attempts
  FOR SELECT USING (is_completed = TRUE OR auth.uid() = user_id OR public.is_admin());

CREATE POLICY "daily_attempts_insert_own" ON public.daily_exam_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_attempts_update_own_uncompleted" ON public.daily_exam_attempts
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- =============================================================================
-- 7. WRITING & SPEAKING SUBMISSIONS (PRIVATE BY DEFAULT!) & AI CONVERSATIONS
-- =============================================================================
CREATE TABLE public.writing_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('academic_t1', 'general_t1', 'task_2')),
  prompt_text TEXT NOT NULL,
  chart_image_url TEXT,
  essay_text TEXT NOT NULL,
  word_count INT NOT NULL DEFAULT 0,
  overall_band NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  criteria_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_writing_user ON public.writing_submissions(user_id, created_at DESC);

ALTER TABLE public.writing_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "writing_select_private_default" ON public.writing_submissions
  FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE OR public.is_admin());

CREATE POLICY "writing_insert_own" ON public.writing_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "writing_update_own" ON public.writing_submissions
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "writing_delete_own" ON public.writing_submissions
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.speaking_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  part TEXT NOT NULL CHECK (part IN ('part_1', 'part_2', 'part_3')),
  prompt_text TEXT NOT NULL,
  audio_url TEXT,
  audio_duration_sec INT NOT NULL DEFAULT 0 CHECK (audio_duration_sec <= 180),
  transcript TEXT NOT NULL DEFAULT '',
  overall_band NUMERIC(2,1) NOT NULL DEFAULT 0.0,
  criteria_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.speaking_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "speaking_select_private_default" ON public.speaking_submissions
  FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE OR public.is_admin());

CREATE POLICY "speaking_write_own" ON public.speaking_submissions
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL,
  topic_title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  feedback_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_own_or_admin" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- =============================================================================
-- 8. FLASHCARDS (SM-2 SPACED REPETITION)
-- =============================================================================
CREATE TABLE public.flashcard_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcard_sets_select" ON public.flashcard_sets
  FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE OR public.is_admin());

CREATE POLICY "flashcard_sets_write_own" ON public.flashcard_sets
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES public.flashcard_sets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  phonetic TEXT NOT NULL DEFAULT '',
  part_of_speech TEXT NOT NULL DEFAULT '',
  definition_vi TEXT NOT NULL,
  definition_en TEXT NOT NULL DEFAULT '',
  example_sentence TEXT NOT NULL DEFAULT '',
  ease_factor NUMERIC(4,2) NOT NULL DEFAULT 2.50,
  interval_days INT NOT NULL DEFAULT 0,
  repetitions INT NOT NULL DEFAULT 0,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcards_select" ON public.flashcards
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.flashcard_sets s
      WHERE s.id = flashcards.set_id AND s.is_public = TRUE
    )
  );

CREATE POLICY "flashcards_write_own" ON public.flashcards
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- =============================================================================
-- 9. LEARNING CONTENT (Courses, Dictation, Pronunciation, Videos, Blog, Testimonials)
-- =============================================================================
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  level TEXT NOT NULL,
  target_band TEXT NOT NULL,
  lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_public_published" ON public.courses
  FOR SELECT USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "courses_admin_all" ON public.courses
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  completed_lesson_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_progress_own_or_admin" ON public.course_progress
  FOR ALL USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE TABLE public.dictation_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  accent TEXT NOT NULL DEFAULT 'en-GB',
  sentences JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dictation_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dictation_public_published" ON public.dictation_lessons
  FOR SELECT USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "dictation_admin_all" ON public.dictation_lessons
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.pronunciation_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  symbol TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('vowel', 'diphthong', 'consonant')),
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  tip_vi TEXT NOT NULL,
  tip_en TEXT NOT NULL,
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.pronunciation_sounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pronunciation_public_select" ON public.pronunciation_sounds
  FOR SELECT USING (TRUE);

CREATE POLICY "pronunciation_admin_all" ON public.pronunciation_sounds
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.learn_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  youtube_id TEXT NOT NULL,
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_vi TEXT NOT NULL,
  description_en TEXT NOT NULL,
  level TEXT NOT NULL,
  duration_label TEXT NOT NULL,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.learn_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "learn_videos_public_published" ON public.learn_videos
  FOR SELECT USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "learn_videos_admin_all" ON public.learn_videos
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  excerpt_vi TEXT NOT NULL,
  excerpt_en TEXT NOT NULL,
  content_vi TEXT NOT NULL,
  content_en TEXT NOT NULL,
  category TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Đội ngũ học thuật Ôn IELTS',
  read_minutes INT NOT NULL DEFAULT 5,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_posts_public_published" ON public.blog_posts
  FOR SELECT USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "blog_posts_admin_all" ON public.blog_posts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_name TEXT NOT NULL,
  target_achieved TEXT NOT NULL,
  previous_band NUMERIC(2,1) NOT NULL,
  new_band NUMERIC(2,1) NOT NULL,
  quote_vi TEXT NOT NULL,
  quote_en TEXT NOT NULL,
  role_vi TEXT NOT NULL,
  role_en TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "testimonials_public_published" ON public.testimonials
  FOR SELECT USING (is_published = TRUE OR public.is_admin());

CREATE POLICY "testimonials_admin_all" ON public.testimonials
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 10. REFERRALS, FEATURE REQUESTS & CONTACT MESSAGES
-- =============================================================================
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up', 'converted_premium')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select_own_or_admin" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR public.is_admin());

CREATE POLICY "referrals_admin_all" ON public.referrals
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.feature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  votes INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'planned', 'shipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_requests_public_select" ON public.feature_requests
  FOR SELECT USING (TRUE);

CREATE POLICY "feature_requests_insert_any" ON public.feature_requests
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "feature_requests_admin_manage" ON public.feature_requests
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contact_messages_insert_any" ON public.contact_messages
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "contact_messages_admin_read_manage" ON public.contact_messages
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================================================
-- 11. STORAGE BUCKETS & POLICIES (Speaking Audio, Pronunciation, Writing Charts)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('speaking-audio', 'speaking-audio', FALSE, 10485760, ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']),
  ('writing-charts', 'writing-charts', FALSE, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage_speaking_audio_own" ON storage.objects
  FOR ALL USING (
    bucket_id = 'speaking-audio'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'speaking-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage_writing_charts_own" ON storage.objects
  FOR ALL USING (
    bucket_id = 'writing-charts'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'writing-charts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
