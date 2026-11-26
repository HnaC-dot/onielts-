-- =============================================================================
-- Ôn IELTS — Schema & Table Grants for PostgREST Roles (Non-destructive, Idempotent)
-- Ensures anon, authenticated, and service_role have base SQL privileges so
-- Row Level Security (RLS) policies govern row access instead of failing with
-- PostgreSQL 42501 (permission denied for table).
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO authenticated, service_role;

GRANT SELECT
  ON ALL TABLES IN SCHEMA public
  TO anon;

GRANT INSERT
  ON public.contact_messages, public.feature_requests
  TO anon;

GRANT USAGE, SELECT
  ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT EXECUTE
  ON FUNCTION public.is_admin()
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
