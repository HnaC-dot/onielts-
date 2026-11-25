-- =============================================================================
-- Ôn IELTS — Row Level Security (RLS) Verification Suite (Postgres / pgTAP-compatible)
-- Run against a local/staging Supabase database to assert cross-user isolation.
-- =============================================================================

BEGIN;

-- 1. Verify EVERY public table has RLS enabled
DO $$
DECLARE
  unprotected_tables TEXT;
BEGIN
  SELECT string_agg(tablename, ', ')
  INTO unprotected_tables
  FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = FALSE;

  IF unprotected_tables IS NOT NULL THEN
    RAISE EXCEPTION 'RLS FAILED: Tables without Row Level Security: %', unprotected_tables;
  END IF;
END $$;

-- 2. Verify private-by-default default value on writing_submissions & speaking_submissions
DO $$
DECLARE
  w_default TEXT;
  s_default TEXT;
BEGIN
  SELECT column_default INTO w_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'writing_submissions' AND column_name = 'is_public';

  SELECT column_default INTO s_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'speaking_submissions' AND column_name = 'is_public';

  IF w_default IS DISTINCT FROM 'false' OR s_default IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'RLS FAILED: User submissions must default to private (is_public = false)';
  END IF;
END $$;

-- 3. Verify every RLS-enabled table has at least one policy
DO $$
DECLARE
  tables_without_policies TEXT;
BEGIN
  SELECT string_agg(t.tablename, ', ')
  INTO tables_without_policies
  FROM pg_tables t
  LEFT JOIN pg_policies p
    ON p.schemaname = t.schemaname AND p.tablename = t.tablename
  WHERE t.schemaname = 'public' AND p.policyname IS NULL;

  IF tables_without_policies IS NOT NULL THEN
    RAISE EXCEPTION 'RLS FAILED: Tables missing RLS policies: %', tables_without_policies;
  END IF;
END $$;

ROLLBACK;
