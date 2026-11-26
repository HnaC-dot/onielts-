-- =============================================================================
-- Ôn IELTS — Auto-provision public.profiles row on Supabase Auth signup
-- Ensures every Google OAuth or Email OTP user automatically gets a profile
-- with safe defaults (role = 'learner', premium_expires_at = NULL).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_code TEXT;
BEGIN
  v_email := COALESCE(NEW.email, '');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NULLIF(split_part(v_email, '@', 1), ''),
    'Học viên Ôn IELTS'
  );
  v_code := UPPER(
    SUBSTRING(REGEXP_REPLACE(COALESCE(split_part(v_email, '@', 1), 'IELTS'), '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 6)
  ) || SUBSTRING(REPLACE(NEW.id::text, '-', '') FROM 1 FOR 4);

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    target_band,
    locale,
    premium_expires_at,
    referral_code,
    email_verified,
    streak_count,
    last_active_date
  )
  VALUES (
    NEW.id,
    v_email,
    v_name,
    NEW.raw_user_meta_data->>'avatar_url',
    'learner',
    6.5,
    'vi',
    NULL,
    v_code,
    COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE),
    1,
    (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
