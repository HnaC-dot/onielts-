-- =============================================================================
-- Ôn IELTS — Migration 0008: Payment Atomicity & AI Quota Safety (Giai đoạn 1)
-- Non-destructive & idempotent. Never modifies migrations 0001–0007.
-- Adds:
--   1. orders.duration_months snapshot + order_code_seq + promo reservation index
--   2. Atomic RPC public.create_checkout_order_atomic (promo lock + unique order_code)
--   3. Atomic RPC public.fulfill_paid_order_atomic (single transaction: order paid +
--      promo increment + Premium expiry extension + referral conversion & bonus days)
--   4. ai_usage_logs actor_key / quota_bucket / status columns + composite indexes
--   5. Atomic RPC public.reserve_ai_quota_atomic (advisory-locked zero-TOCTOU quota
--      reservation for Free & Premium daily caps + guest persistence)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ORDERS & PROMO CONCURRENCY HARDENING
-- -----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS duration_months INT NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_duration_months_positive'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_duration_months_positive CHECK (duration_months >= 1);
  END IF;
END $$;

-- Backfill duration_months snapshot for existing orders from pricing_plans
UPDATE public.orders o
SET duration_months = COALESCE(p.duration_months, 1)
FROM public.pricing_plans p
WHERE o.plan_id = p.id
  AND o.duration_months = 1
  AND COALESCE(p.duration_months, 1) <> 1;

-- Monotonic collision-free sequence for order_code generation
CREATE SEQUENCE IF NOT EXISTS public.order_code_seq
  START WITH 100001
  INCREMENT BY 1
  NO CYCLE;

-- Fast lookup for active pending promo reservations during checkout
CREATE INDEX IF NOT EXISTS idx_orders_promo_pending_lookup
  ON public.orders (UPPER(promo_code), status, created_at DESC)
  WHERE promo_code IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. ATOMIC CHECKOUT ORDER CREATION (Locks promo code + generates unique order_code)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_checkout_order_atomic(
  p_user_id UUID,
  p_plan_slug TEXT,
  p_provider TEXT DEFAULT 'payos',
  p_promo_code TEXT DEFAULT NULL,
  p_reservation_ttl_minutes INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.pricing_plans%ROWTYPE;
  v_promo public.promo_codes%ROWTYPE;
  v_clean_promo TEXT;
  v_pending_promo_count INT := 0;
  v_raw_discount INT := 0;
  v_discount_vnd INT := 0;
  v_final_amount INT := 0;
  v_applied_promo TEXT := NULL;
  v_order_code BIGINT;
  v_attempt INT := 0;
  v_ttl_minutes INT := GREATEST(5, LEAST(120, COALESCE(p_reservation_ttl_minutes, 30)));
  v_now TIMESTAMPTZ := NOW();
  v_order public.orders%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 401,
      'error', 'Vui lòng đăng nhập trước khi thanh toán gói Premium.'
    );
  END IF;

  IF p_provider NOT IN ('payos', 'vnpay', 'momo', 'stripe', 'mock') THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 400,
      'error', 'Cổng thanh toán không hợp lệ.'
    );
  END IF;

  SELECT *
  INTO v_plan
  FROM public.pricing_plans
  WHERE slug = p_plan_slug
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 404,
      'error', 'Không tìm thấy gói cước đang hoạt động.'
    );
  END IF;

  v_clean_promo := NULLIF(UPPER(TRIM(COALESCE(p_promo_code, ''))), '');

  IF v_clean_promo IS NOT NULL THEN
    -- Row-level lock serializes concurrent checkouts attempting to use the same promo code
    SELECT *
    INTO v_promo
    FROM public.promo_codes
    WHERE UPPER(code) = v_clean_promo
    FOR UPDATE;

    IF NOT FOUND OR v_promo.is_active IS NOT TRUE THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'status', 400,
        'error', 'Mã giảm giá không tồn tại hoặc đã ngừng áp dụng.'
      );
    END IF;

    IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at <= v_now THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'status', 400,
        'error', 'Mã giảm giá đã hết hạn sử dụng.'
      );
    END IF;

    IF v_promo.max_uses IS NOT NULL THEN
      SELECT COUNT(*)
      INTO v_pending_promo_count
      FROM public.orders
      WHERE UPPER(promo_code) = UPPER(v_promo.code)
        AND status = 'pending'
        AND created_at > (v_now - make_interval(mins => v_ttl_minutes));

      IF (COALESCE(v_promo.current_uses, 0) + v_pending_promo_count) >= v_promo.max_uses THEN
        RETURN jsonb_build_object(
          'ok', FALSE,
          'status', 400,
          'error', 'Mã giảm giá đã hết lượt sử dụng.'
        );
      END IF;
    END IF;

    v_raw_discount := ROUND((v_plan.price_vnd::NUMERIC * v_promo.discount_percent::NUMERIC) / 100.0)::INT;
    IF v_promo.max_discount_vnd IS NOT NULL AND v_promo.max_discount_vnd > 0 THEN
      v_discount_vnd := LEAST(v_raw_discount, v_promo.max_discount_vnd);
    ELSE
      v_discount_vnd := v_raw_discount;
    END IF;
    v_applied_promo := v_promo.code;
  END IF;

  v_final_amount := GREATEST(1000, v_plan.price_vnd - v_discount_vnd);

  -- Generate collision-free PayOS-safe positive integer order_code
  LOOP
    v_attempt := v_attempt + 1;
    v_order_code := (nextval('public.order_code_seq') * 100) + FLOOR(random() * 90 + 10)::BIGINT;

    BEGIN
      INSERT INTO public.orders (
        user_id,
        plan_id,
        duration_months,
        order_code,
        provider,
        amount_vnd,
        discount_vnd,
        promo_code,
        status,
        checkout_url,
        qr_code
      ) VALUES (
        p_user_id,
        v_plan.id,
        GREATEST(1, COALESCE(v_plan.duration_months, 1)),
        v_order_code,
        p_provider,
        v_final_amount,
        v_discount_vnd,
        v_applied_promo,
        'pending',
        NULL,
        NULL
      )
      RETURNING * INTO v_order;

      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        IF v_attempt >= 8 THEN
          RAISE;
        END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'status', 201,
    'order', jsonb_build_object(
      'id', v_order.id,
      'user_id', v_order.user_id,
      'plan_id', v_order.plan_id,
      'plan_slug', v_plan.slug,
      'duration_months', v_order.duration_months,
      'order_code', v_order.order_code,
      'provider', v_order.provider,
      'amount_vnd', v_order.amount_vnd,
      'discount_vnd', v_order.discount_vnd,
      'promo_code', v_order.promo_code,
      'status', v_order.status,
      'checkout_url', v_order.checkout_url,
      'qr_code', v_order.qr_code,
      'webhook_event_id', v_order.webhook_event_id,
      'paid_at', v_order.paid_at,
      'created_at', v_order.created_at
    )
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. ATOMIC PAYOS WEBHOOK FULFILLMENT (Single ACID Transaction)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_paid_order_atomic(
  p_order_code BIGINT,
  p_amount_vnd INT,
  p_event_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_event public.orders%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_referrer public.profiles%ROWTYPE;
  v_referral public.referrals%ROWTYPE;
  v_referral_cfg JSONB;
  v_ref_enabled BOOLEAN := FALSE;
  v_referrer_bonus_days INT := 0;
  v_referred_bonus_days INT := 0;
  v_duration_months INT := 1;
  v_now TIMESTAMPTZ := NOW();
  v_base_time TIMESTAMPTZ;
  v_new_expiry TIMESTAMPTZ;
  v_referrer_base TIMESTAMPTZ;
  v_referrer_new_expiry TIMESTAMPTZ;
BEGIN
  IF p_order_code IS NULL OR p_order_code <= 0 THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 400,
      'message', 'Mã đơn hàng không hợp lệ.'
    );
  END IF;

  IF p_event_id IS NULL OR LENGTH(TRIM(p_event_id)) = 0 THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 400,
      'message', 'Thiếu mã sự kiện webhook (eventId).'
    );
  END IF;

  -- Idempotency check 1: duplicate webhook_event_id
  SELECT *
  INTO v_existing_event
  FROM public.orders
  WHERE webhook_event_id = p_event_id
  LIMIT 1;

  IF FOUND THEN
    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = v_existing_event.user_id;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'status', 200,
      'idempotent', TRUE,
      'premium_expires_at', v_profile.premium_expires_at,
      'message', 'Webhook đã được xử lý trước đó (idempotent).'
    );
  END IF;

  -- Lock target order row to serialize concurrent webhooks for the same order
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE order_code = p_order_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 404,
      'message', 'Không tìm thấy đơn hàng.'
    );
  END IF;

  -- Idempotency check 2: order already marked paid
  IF v_order.status = 'paid' THEN
    SELECT *
    INTO v_profile
    FROM public.profiles
    WHERE id = v_order.user_id;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'status', 200,
      'idempotent', TRUE,
      'premium_expires_at', v_profile.premium_expires_at,
      'message', 'Đơn hàng đã thanh toán trước đó (idempotent).'
    );
  END IF;

  -- Reject orders in terminal non-pending states (cancelled / expired / refunded)
  IF v_order.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 409,
      'message', format('Đơn hàng đang ở trạng thái %s, không thể tự động kích hoạt.', v_order.status)
    );
  END IF;

  -- Strict payment amount check (reject null / zero / underpayment)
  IF p_amount_vnd IS NULL OR p_amount_vnd <= 0 OR p_amount_vnd < v_order.amount_vnd THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 400,
      'message', 'Số tiền thanh toán không khớp đơn hàng.'
    );
  END IF;

  -- Lock buyer profile row before mutating anything; abort tx if user profile is missing
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = v_order.user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target buyer profile % not found for order %', v_order.user_id, v_order.order_code;
  END IF;

  -- Resolve exact duration_months (snapshot on order first, then plan fallback)
  SELECT COALESCE(
    NULLIF(v_order.duration_months, 0),
    (SELECT pp.duration_months FROM public.pricing_plans pp WHERE pp.id = v_order.plan_id),
    1
  )
  INTO v_duration_months;

  -- Atomically mark order paid
  UPDATE public.orders
  SET
    status = 'paid',
    webhook_event_id = p_event_id,
    paid_at = v_now
  WHERE id = v_order.id;

  -- Atomically increment promo code usage under row lock
  IF v_order.promo_code IS NOT NULL AND LENGTH(TRIM(v_order.promo_code)) > 0 THEN
    UPDATE public.promo_codes
    SET current_uses = COALESCE(current_uses, 0) + 1
    WHERE UPPER(code) = UPPER(TRIM(v_order.promo_code));
  END IF;

  -- Compute extended Premium expiry cleanly
  v_base_time := CASE
    WHEN v_profile.premium_expires_at IS NOT NULL AND v_profile.premium_expires_at > v_now
      THEN v_profile.premium_expires_at
    ELSE v_now
  END;
  v_new_expiry := v_base_time + make_interval(months => GREATEST(1, v_duration_months));

  -- Convert pending referral (if any) & apply configured bonus days atomically
  SELECT *
  INTO v_referral
  FROM public.referrals
  WHERE referred_user_id = v_order.user_id
    AND status = 'signed_up'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.referrals
    SET
      status = 'converted_premium',
      converted_at = v_now
    WHERE id = v_referral.id;

    SELECT value
    INTO v_referral_cfg
    FROM public.site_settings
    WHERE key = 'referral';

    v_ref_enabled := COALESCE((v_referral_cfg->>'isEnabled')::BOOLEAN, TRUE);
    v_referrer_bonus_days := GREATEST(0, LEAST(90, COALESCE((v_referral_cfg->>'referrerBonusDays')::INT, 14)));
    v_referred_bonus_days := GREATEST(0, LEAST(90, COALESCE((v_referral_cfg->>'referredBonusDays')::INT, 7)));

    IF v_ref_enabled THEN
      IF v_referred_bonus_days > 0 THEN
        v_new_expiry := v_new_expiry + make_interval(days => v_referred_bonus_days);
      END IF;

      IF v_referrer_bonus_days > 0 AND v_referral.referrer_id IS DISTINCT FROM v_order.user_id THEN
        SELECT *
        INTO v_referrer
        FROM public.profiles
        WHERE id = v_referral.referrer_id
        FOR UPDATE;

        IF FOUND THEN
          v_referrer_base := CASE
            WHEN v_referrer.premium_expires_at IS NOT NULL AND v_referrer.premium_expires_at > v_now
              THEN v_referrer.premium_expires_at
            ELSE v_now
          END;
          v_referrer_new_expiry := v_referrer_base + make_interval(days => v_referrer_bonus_days);

          UPDATE public.profiles
          SET premium_expires_at = v_referrer_new_expiry
          WHERE id = v_referrer.id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Commit buyer Premium expiry inside the exact same transaction
  UPDATE public.profiles
  SET premium_expires_at = v_new_expiry
  WHERE id = v_order.user_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'status', 200,
    'idempotent', FALSE,
    'premium_expires_at', v_new_expiry,
    'message', 'Đã xác nhận thanh toán và kích hoạt Premium thành công.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. AI USAGE LOGS QUOTA HARDENING (Zero-TOCTOU Reservation + Guest Persistence)
-- -----------------------------------------------------------------------------
ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS actor_key TEXT,
  ADD COLUMN IF NOT EXISTS quota_bucket TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_usage_logs_status_check'
      AND conrelid = 'public.ai_usage_logs'::regclass
  ) THEN
    ALTER TABLE public.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_status_check
      CHECK (status IN ('reserved', 'completed', 'released'));
  END IF;
END $$;

-- Backfill legacy rows so historical usage remains counted accurately
UPDATE public.ai_usage_logs
SET actor_key = 'u:' || user_id::TEXT
WHERE actor_key IS NULL AND user_id IS NOT NULL;

UPDATE public.ai_usage_logs
SET quota_bucket = CASE
  WHEN feature = 'writing:evaluate' THEN 'writing_eval'
  WHEN feature = 'speaking:evaluate' THEN 'speaking_eval'
  WHEN feature LIKE 'tool:%' THEN 'general_tool'
  WHEN feature LIKE '%:generate' THEN 'generator'
  WHEN feature = 'conversation:reply' THEN 'conversation'
  WHEN feature = 'mentor:chat' THEN 'mentor'
  WHEN feature = 'pronunciation:check' THEN 'pronunciation'
  WHEN feature = 'writing:exercise_check' THEN 'writing_exercise'
  WHEN feature = 'flashcard:autofill' THEN 'flashcard_autofill'
  ELSE feature
END
WHERE quota_bucket IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_quota_lookup
  ON public.ai_usage_logs (actor_key, quota_bucket, created_at DESC)
  WHERE cached = FALSE AND status IN ('reserved', 'completed');

CREATE INDEX IF NOT EXISTS idx_ai_usage_cost_window
  ON public.ai_usage_logs (created_at DESC)
  WHERE cached = FALSE AND status = 'completed';

-- -----------------------------------------------------------------------------
-- 5. ATOMIC AI QUOTA RESERVATION RPC (Advisory-locked per actor + bucket)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reserve_ai_quota_atomic(
  p_actor_key TEXT,
  p_user_id UUID,
  p_quota_bucket TEXT,
  p_feature TEXT,
  p_skill TEXT,
  p_model TEXT,
  p_limit INT,
  p_window_start TIMESTAMPTZ,
  p_stale_minutes INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INT := 0;
  v_now TIMESTAMPTZ := NOW();
  v_stale_cutoff TIMESTAMPTZ := v_now - make_interval(mins => GREATEST(1, LEAST(15, COALESCE(p_stale_minutes, 3))));
  v_reservation_id UUID;
BEGIN
  IF p_actor_key IS NULL OR LENGTH(TRIM(p_actor_key)) = 0 THEN
    RAISE EXCEPTION 'actor_key is required';
  END IF;

  -- Serialize concurrent requests for the exact same (actor, quota_bucket)
  PERFORM pg_advisory_xact_lock(hashtext(p_actor_key || ':' || p_quota_bucket));

  SELECT COUNT(*)::INT
  INTO v_used
  FROM public.ai_usage_logs
  WHERE (
      actor_key = p_actor_key
      OR (p_user_id IS NOT NULL AND user_id = p_user_id AND actor_key IS NULL)
    )
    AND quota_bucket = p_quota_bucket
    AND created_at >= p_window_start
    AND cached = FALSE
    AND (
      status = 'completed'
      OR (status = 'reserved' AND created_at >= v_stale_cutoff)
    );

  IF p_limit IS NOT NULL AND v_used >= p_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'used', v_used,
      'remaining', 0,
      'reservation_id', NULL
    );
  END IF;

  INSERT INTO public.ai_usage_logs (
    user_id,
    actor_key,
    quota_bucket,
    feature,
    skill,
    model,
    prompt_tokens,
    completion_tokens,
    total_tokens,
    estimated_cost_usd,
    cached,
    latency_ms,
    status
  ) VALUES (
    p_user_id,
    p_actor_key,
    p_quota_bucket,
    p_feature,
    p_skill,
    COALESCE(NULLIF(TRIM(p_model), ''), 'gemini-2.5-flash'),
    0,
    0,
    0,
    0,
    FALSE,
    0,
    'reserved'
  )
  RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'used', v_used + 1,
    'remaining', CASE WHEN p_limit IS NULL THEN NULL ELSE GREATEST(0, p_limit - (v_used + 1)) END,
    'reservation_id', v_reservation_id
  );
END;
$$;

-- Lock down SECURITY DEFINER RPCs exclusively to service_role
REVOKE ALL ON FUNCTION public.create_checkout_order_atomic(UUID, TEXT, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_order_atomic(UUID, TEXT, TEXT, TEXT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.fulfill_paid_order_atomic(BIGINT, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_paid_order_atomic(BIGINT, INT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_ai_quota_atomic(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, TIMESTAMPTZ, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_quota_atomic(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, INT, TIMESTAMPTZ, INT) TO service_role;
