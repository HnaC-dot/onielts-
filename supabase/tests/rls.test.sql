-- =============================================================================
-- Ôn IELTS — Real pgTAP RLS Integration Test Suite
-- Run with Supabase Local:  supabase test db
-- Or with psql + pgTAP:     psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
-- =============================================================================

BEGIN;

SELECT plan(14);

-- Seed 3 isolated auth users (Learner A, Learner B, Admin) inside rolled-back tx
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'learner-a@rls-test.local', NOW(), '{"full_name":"Learner A"}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'learner-b@rls-test.local', NOW(), '{"full_name":"Learner B"}'::jsonb),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'admin@rls-test.local', NOW(), '{"full_name":"Admin User"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Ensure profiles exist (trigger creates them on Supabase; upsert for standalone DBs)
INSERT INTO public.profiles (id, email, full_name, role, referral_code, email_verified)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'learner-a@rls-test.local', 'Learner A', 'learner', 'RLSA0001', TRUE),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'learner-b@rls-test.local', 'Learner B', 'learner', 'RLSB0002', TRUE),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'admin@rls-test.local', 'Admin User', 'admin', 'RLSC0003', TRUE)
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

-- Seed one published and one draft IELTS test
INSERT INTO public.ielts_tests (id, slug, skill, module, title_vi, title_en, is_published)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'rls-pub-test', 'reading', 'academic', 'Published', 'Published', TRUE),
  ('10000000-0000-4000-8000-000000000002', 'rls-draft-test', 'reading', 'academic', 'Draft', 'Draft', FALSE);

-- Seed private writing submission for Learner A
INSERT INTO public.writing_submissions (id, user_id, task_type, prompt_text, essay_text, word_count, is_public)
VALUES
  ('20000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'task_2', 'Prompt A', 'Private essay A', 260, FALSE);

-- Seed pending order for Learner A
INSERT INTO public.orders (id, user_id, order_code, provider, amount_vnd, status)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 999888777, 'payos', 199000, 'pending');

-- Seed private flashcard set for Learner A
INSERT INTO public.flashcard_sets (id, user_id, title, is_public)
VALUES
  ('40000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Private Set A', FALSE);

-- -----------------------------------------------------------------------------
-- 1. ANON ROLE CHECKS
-- -----------------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', TRUE);

SELECT is(
  (SELECT COUNT(*)::int FROM public.profiles),
  0,
  'anon cannot read any profiles rows'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.orders),
  0,
  'anon cannot read any orders rows'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.writing_submissions WHERE id = '20000000-0000-4000-8000-000000000001'),
  0,
  'anon cannot read private writing submissions'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.ielts_tests WHERE slug IN ('rls-pub-test', 'rls-draft-test')),
  1,
  'anon sees published tests only, never unpublished drafts'
);

-- -----------------------------------------------------------------------------
-- 2. LEARNER A CHECKS (Own access + anti-escalation)
-- -----------------------------------------------------------------------------
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', TRUE);

SELECT is(
  (SELECT COUNT(*)::int FROM public.profiles),
  1,
  'Learner A sees only their own profile row'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  NULL,
  'Learner A cannot self-escalate role to admin'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET premium_expires_at = NOW() + INTERVAL '365 days' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '42501',
  NULL,
  'Learner A cannot self-grant premium_expires_at'
);

SELECT lives_ok(
  $$UPDATE public.profiles SET target_band = 7.5 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  'Learner A can safely update own non-privileged profile fields'
);

SELECT throws_ok(
  $$INSERT INTO public.orders (user_id, order_code, provider, amount_vnd, status)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 999888778, 'payos', 199000, 'paid')$$,
  '42501',
  NULL,
  'Learner A cannot insert a pre-paid order'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.writing_submissions WHERE id = '20000000-0000-4000-8000-000000000001'),
  1,
  'Learner A can read own private writing submission'
);

-- -----------------------------------------------------------------------------
-- 3. LEARNER B CHECKS (Cross-tenant isolation)
-- -----------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', TRUE);

SELECT is(
  (SELECT COUNT(*)::int FROM public.writing_submissions WHERE id = '20000000-0000-4000-8000-000000000001'),
  0,
  'Learner B cannot read Learner A private writing submission'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.orders WHERE id = '30000000-0000-4000-8000-000000000001'),
  0,
  'Learner B cannot read Learner A orders'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.flashcard_sets WHERE id = '40000000-0000-4000-8000-000000000001'),
  0,
  'Learner B cannot read Learner A private flashcard sets'
);

-- -----------------------------------------------------------------------------
-- 4. ADMIN ROLE CHECKS
-- -----------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', TRUE);

SELECT is(
  (SELECT COUNT(*)::int FROM public.ielts_tests WHERE slug IN ('rls-pub-test', 'rls-draft-test')),
  2,
  'Admin can read both published and unpublished draft tests'
);

SELECT * FROM finish();
ROLLBACK;
