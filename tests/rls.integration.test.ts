import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_URL =
  process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";

const LEARNER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEARNER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EDITOR_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const LOCKED_ADMIN_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PUB_TEST_ID = "10000000-0000-4000-8000-000000000001";
const DRAFT_TEST_ID = "10000000-0000-4000-8000-000000000002";
const WRITING_A_ID = "20000000-0000-4000-8000-000000000001";
const SPEAKING_A_ID = "20000000-0000-4000-8000-000000000002";
const ORDER_A_ID = "30000000-0000-4000-8000-000000000001";
const SET_A_ID = "40000000-0000-4000-8000-000000000001";
const CARD_A_ID = "40000000-0000-4000-8000-000000000002";
const DAILY_EXAM_ID = "50000000-0000-4000-8000-000000000001";

const SUPABASE_COMPAT_SHIM_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  email_confirmed_at TIMESTAMPTZ,
  raw_user_meta_data JSONB DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claim.sub', true),
      (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.role', true),
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    current_user
  );
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT REFERENCES storage.buckets(id),
  name TEXT NOT NULL
);

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(name, '/');
$$;
`;

async function withSessionRole<T>(
  client: Client,
  role: "anon" | "authenticated",
  userId: string | null,
  fn: () => Promise<T>
): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${role}`);
    const claims = userId
      ? JSON.stringify({ sub: userId, role })
      : JSON.stringify({ role });
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      claims,
    ]);
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [
      userId ?? "",
    ]);
    const result = await fn();
    await client.query("ROLLBACK");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

describe.skipIf(!DB_URL)(
  "Real PostgreSQL RLS Integration Tests (Live Enforcement)",
  () => {
    let client: Client;

    beforeAll(async () => {
      client = new Client({ connectionString: DB_URL });
      await client.connect();

      // Detect whether auth.uid() already exists (Supabase Local) or bootstrap shims (vanilla Postgres)
      const { rows: authCheck } = await client.query(
        `SELECT to_regprocedure('auth.uid()') AS fn, to_regclass('public.profiles') AS profiles_tbl`
      );
      if (!authCheck[0]?.fn) {
        await client.query(SUPABASE_COMPAT_SHIM_SQL);
      }

      if (!authCheck[0]?.profiles_tbl) {
        const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
        const migrationFiles = fs
          .readdirSync(migrationsDir)
          .filter((f) => f.endsWith(".sql"))
          .sort();
        for (const file of migrationFiles) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
          await client.query(sql);
        }
      }

      // Seed test users (auth.users -> trigger auto-provisions profiles; ensure roles)
      await client.query(
        `INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         VALUES
           ($1, 'learner-a@rls-int.local', NOW(), '{"full_name":"Learner A"}'::jsonb),
           ($2, 'learner-b@rls-int.local', NOW(), '{"full_name":"Learner B"}'::jsonb),
           ($3, 'admin@rls-int.local', NOW(), '{"full_name":"Admin Int"}'::jsonb),
           ($4, 'editor@rls-int.local', NOW(), '{"full_name":"Editor Int"}'::jsonb),
           ($5, 'locked-admin@rls-int.local', NOW(), '{"full_name":"Locked Admin"}'::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [LEARNER_A, LEARNER_B, ADMIN_ID, EDITOR_ID, LOCKED_ADMIN_ID]
      );

      await client.query(
        `INSERT INTO public.profiles (id, email, full_name, role, is_locked, referral_code, email_verified)
         VALUES
           ($1, 'learner-a@rls-int.local', 'Learner A', 'learner', FALSE, 'INTA0001', TRUE),
           ($2, 'learner-b@rls-int.local', 'Learner B', 'learner', FALSE, 'INTB0002', TRUE),
           ($3, 'admin@rls-int.local', 'Admin Int', 'admin', FALSE, 'INTC0003', TRUE),
           ($4, 'editor@rls-int.local', 'Editor Int', 'editor', FALSE, 'INTD0004', TRUE),
           ($5, 'locked-admin@rls-int.local', 'Locked Admin', 'admin', TRUE, 'INTE0005', TRUE)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_locked = EXCLUDED.is_locked`,
        [LEARNER_A, LEARNER_B, ADMIN_ID, EDITOR_ID, LOCKED_ADMIN_ID]
      );

      await client.query(
        `INSERT INTO public.ielts_tests (id, slug, skill, module, title_vi, title_en, is_published)
         VALUES
           ($1, 'int-published-test', 'reading', 'academic', 'Published Test', 'Published Test', TRUE),
           ($2, 'int-draft-test', 'reading', 'academic', 'Draft Test', 'Draft Test', FALSE)
         ON CONFLICT (id) DO NOTHING`,
        [PUB_TEST_ID, DRAFT_TEST_ID]
      );

      await client.query(
        `INSERT INTO public.writing_submissions (id, user_id, task_type, prompt_text, essay_text, word_count, is_public)
         VALUES ($1, $2, 'task_2', 'Prompt A', 'Private essay A', 260, FALSE)
         ON CONFLICT (id) DO UPDATE SET is_public = FALSE`,
        [WRITING_A_ID, LEARNER_A]
      );

      await client.query(
        `INSERT INTO public.speaking_submissions (id, user_id, part, prompt_text, transcript, is_public)
         VALUES ($1, $2, 'part_2', 'Cue card A', 'Private speaking transcript A', FALSE)
         ON CONFLICT (id) DO UPDATE SET is_public = FALSE`,
        [SPEAKING_A_ID, LEARNER_A]
      );

      await client.query(
        `INSERT INTO public.orders (id, user_id, order_code, provider, amount_vnd, status)
         VALUES ($1, $2, 910000001, 'payos', 199000, 'pending')
         ON CONFLICT (id) DO NOTHING`,
        [ORDER_A_ID, LEARNER_A]
      );

      await client.query(
        `INSERT INTO public.flashcard_sets (id, user_id, title, is_public)
         VALUES ($1, $2, 'Private Vocabulary A', FALSE)
         ON CONFLICT (id) DO NOTHING`,
        [SET_A_ID, LEARNER_A]
      );

      await client.query(
        `INSERT INTO public.flashcards (id, set_id, user_id, term, definition_vi)
         VALUES ($1, $2, $3, 'ubiquitous', 'có mặt ở khắp nơi')
         ON CONFLICT (id) DO NOTHING`,
        [CARD_A_ID, SET_A_ID, LEARNER_A]
      );

      await client.query(
        `INSERT INTO public.daily_exams (id, exam_date, test_id, title_vi, title_en)
         VALUES ($1, '2026-11-26', $2, 'Daily RLS Exam', 'Daily RLS Exam')
         ON CONFLICT (id) DO NOTHING`,
        [DAILY_EXAM_ID, PUB_TEST_ID]
      );

      await client.query(
        `INSERT INTO public.admin_audit_logs (actor_id, actor_email, actor_role, action, entity_type, entity_label, summary)
         VALUES ($1, 'admin@rls-int.local', 'admin', 'seed_fixture', 'system', 'rls-test', 'Seeded audit log for RLS test')`,
        [ADMIN_ID]
      );
    }, 30_000);

    afterAll(async () => {
      if (client) {
        // Clean up seeded test fixtures if running against a shared Supabase Local DB
        await client.query(
          `DELETE FROM public.admin_audit_logs WHERE actor_id = $1 AND action = 'seed_fixture'`,
          [ADMIN_ID]
        ).catch(() => {});
        await client.query(
          `DELETE FROM public.daily_exams WHERE id = $1`,
          [DAILY_EXAM_ID]
        ).catch(() => {});
        await client.query(
          `DELETE FROM public.ielts_tests WHERE id IN ($1, $2)`,
          [PUB_TEST_ID, DRAFT_TEST_ID]
        ).catch(() => {});
        await client.query(
          `DELETE FROM auth.users WHERE id IN ($1, $2, $3, $4, $5)`,
          [LEARNER_A, LEARNER_B, ADMIN_ID, EDITOR_ID, LOCKED_ADMIN_ID]
        ).catch(() => {});
        await client.end();
      }
    });

    it("blocks anon from reading profiles, orders, private writing, and draft tests", async () => {
      await withSessionRole(client, "anon", null, async () => {
        const profiles = await client.query("SELECT id FROM public.profiles");
        expect(profiles.rowCount).toBe(0);

        const orders = await client.query("SELECT id FROM public.orders");
        expect(orders.rowCount).toBe(0);

        const writing = await client.query(
          "SELECT id FROM public.writing_submissions WHERE id = $1",
          [WRITING_A_ID]
        );
        expect(writing.rowCount).toBe(0);

        const tests = await client.query(
          "SELECT slug FROM public.ielts_tests WHERE id IN ($1, $2)",
          [PUB_TEST_ID, DRAFT_TEST_ID]
        );
        expect(tests.rows.map((r) => r.slug)).toEqual(["int-published-test"]);
      });
    });

    it("allows authenticated learner to read and safely update own profile without 42501, and isolates other profiles", async () => {
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        const res = await client.query("SELECT id, role FROM public.profiles");
        expect(res.rows).toEqual([{ id: LEARNER_A, role: "learner" }]);

        const updated = await client.query(
          "UPDATE public.profiles SET target_band = 7.5 WHERE id = $1 RETURNING target_band",
          [LEARNER_A]
        );
        expect(Number(updated.rows[0].target_band)).toBe(7.5);
      });
    });

    it("blocks learner from self-escalating role='admin' or granting premium_expires_at", async () => {
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await expect(
          client.query("UPDATE public.profiles SET role = 'admin' WHERE id = $1", [
            LEARNER_A,
          ])
        ).rejects.toMatchObject({ code: "42501" });
      });

      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await expect(
          client.query(
            "UPDATE public.profiles SET premium_expires_at = NOW() + INTERVAL '365 days' WHERE id = $1",
            [LEARNER_A]
          )
        ).rejects.toMatchObject({ code: "42501" });
      });
    });

    it("enforces private-by-default on writing and speaking submissions, and allows opt-in public visibility", async () => {
      // Learner B cannot read Learner A's private writing or speaking submissions
      await withSessionRole(client, "authenticated", LEARNER_B, async () => {
        const w = await client.query(
          "SELECT id FROM public.writing_submissions WHERE id = $1",
          [WRITING_A_ID]
        );
        const s = await client.query(
          "SELECT id FROM public.speaking_submissions WHERE id = $1",
          [SPEAKING_A_ID]
        );
        expect(w.rowCount).toBe(0);
        expect(s.rowCount).toBe(0);
      });

      // Learner A opts in to public visibility, then Learner B can SELECT it
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL ROLE authenticated");
        await client.query(
          "SELECT set_config('request.jwt.claims', $1, true)",
          [JSON.stringify({ sub: LEARNER_A, role: "authenticated" })]
        );
        await client.query(
          "SELECT set_config('request.jwt.claim.sub', $1, true)",
          [LEARNER_A]
        );
        await client.query(
          "UPDATE public.writing_submissions SET is_public = TRUE WHERE id = $1",
          [WRITING_A_ID]
        );

        await client.query(
          "SELECT set_config('request.jwt.claims', $1, true)",
          [JSON.stringify({ sub: LEARNER_B, role: "authenticated" })]
        );
        await client.query(
          "SELECT set_config('request.jwt.claim.sub', $1, true)",
          [LEARNER_B]
        );
        const visibleToB = await client.query(
          "SELECT id FROM public.writing_submissions WHERE id = $1",
          [WRITING_A_ID]
        );
        expect(visibleToB.rowCount).toBe(1);
      } finally {
        await client.query("ROLLBACK");
      }
    });

    it("isolates orders & prevents learner from inserting paid orders or updating own orders", async () => {
      await withSessionRole(client, "authenticated", LEARNER_B, async () => {
        const res = await client.query(
          "SELECT id FROM public.orders WHERE id = $1",
          [ORDER_A_ID]
        );
        expect(res.rowCount).toBe(0);
      });

      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        // Cannot insert a pre-paid order
        await expect(
          client.query(
            `INSERT INTO public.orders (user_id, order_code, provider, amount_vnd, status)
             VALUES ($1, 910000002, 'payos', 199000, 'paid')`,
            [LEARNER_A]
          )
        ).rejects.toMatchObject({ code: "42501" });
      });

      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        // UPDATE policy only allows admin -> 0 rows updated for learner
        const upd = await client.query(
          "UPDATE public.orders SET status = 'paid' WHERE id = $1 RETURNING id",
          [ORDER_A_ID]
        );
        expect(upd.rowCount).toBe(0);
      });
    });

    it("isolates private flashcards and enforces unique daily exam attempt per user", async () => {
      await withSessionRole(client, "authenticated", LEARNER_B, async () => {
        const sets = await client.query(
          "SELECT id FROM public.flashcard_sets WHERE id = $1",
          [SET_A_ID]
        );
        const cards = await client.query(
          "SELECT id FROM public.flashcards WHERE id = $1",
          [CARD_A_ID]
        );
        expect(sets.rowCount).toBe(0);
        expect(cards.rowCount).toBe(0);
      });

      // Migration 0009: learner CANNOT insert a forged completed/scored attempt
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await expect(
          client.query(
            `INSERT INTO public.daily_exam_attempts (daily_exam_id, user_id, display_name, raw_score, is_completed)
             VALUES ($1, $2, 'Learner A', 9, TRUE)`,
            [DAILY_EXAM_ID, LEARNER_A]
          )
        ).rejects.toMatchObject({ code: "42501" });
      });

      // Learner CAN start an unscored attempt, and UNIQUE(daily_exam_id, user_id) still blocks duplicates
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await client.query(
          `INSERT INTO public.daily_exam_attempts (daily_exam_id, user_id, display_name, raw_score, band_score, duration_seconds, is_completed)
           VALUES ($1, $2, 'Learner A', 0, 0, 0, FALSE)`,
          [DAILY_EXAM_ID, LEARNER_A]
        );
        await expect(
          client.query(
            `INSERT INTO public.daily_exam_attempts (daily_exam_id, user_id, display_name, raw_score, band_score, duration_seconds, is_completed)
             VALUES ($1, $2, 'Learner A', 0, 0, 0, FALSE)`,
            [DAILY_EXAM_ID, LEARNER_A]
          )
        ).rejects.toMatchObject({ code: "23505" });
      });
    });

    it("grants admin visibility across profiles and unpublished draft tests", async () => {
      await withSessionRole(client, "authenticated", ADMIN_ID, async () => {
        const profiles = await client.query(
          "SELECT id FROM public.profiles WHERE id IN ($1, $2, $3)",
          [LEARNER_A, LEARNER_B, ADMIN_ID]
        );
        expect(profiles.rowCount).toBe(3);

        const tests = await client.query(
          "SELECT id FROM public.ielts_tests WHERE id IN ($1, $2)",
          [PUB_TEST_ID, DRAFT_TEST_ID]
        );
        expect(tests.rowCount).toBe(2);
      });
    });

    it("enforces migration 0005 & 0009 RBAC: editor manages content but not users/settings/audit logs, learner cannot self-escalate to editor", async () => {
      // Learner cannot self-escalate to editor
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await expect(
          client.query("UPDATE public.profiles SET role = 'editor' WHERE id = $1", [
            LEARNER_A,
          ])
        ).rejects.toMatchObject({ code: "42501" });
      });

      // Learner cannot read audit logs or create media/redirects
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        const logs = await client.query("SELECT id FROM public.admin_audit_logs");
        expect(logs.rowCount).toBe(0);
      });

      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await expect(
          client.query(
            `INSERT INTO public.seo_redirects (source_path, destination_path, status_code)
             VALUES ('/learner-blocked', '/new', 301)`
          )
        ).rejects.toMatchObject({ code: "42501" });
      });

      // Editor can read draft tests, insert media_assets & seo_redirects, but CANNOT read audit logs or other profiles (Migration 0009)
      await withSessionRole(client, "authenticated", EDITOR_ID, async () => {
        const tests = await client.query(
          "SELECT id FROM public.ielts_tests WHERE id IN ($1, $2)",
          [PUB_TEST_ID, DRAFT_TEST_ID]
        );
        expect(tests.rowCount).toBe(2);

        const logs = await client.query("SELECT id FROM public.admin_audit_logs");
        expect(logs.rowCount).toBe(0);

        const profiles = await client.query(
          "SELECT id FROM public.profiles WHERE id IN ($1, $2, $3)",
          [LEARNER_A, ADMIN_ID, EDITOR_ID]
        );
        expect(profiles.rows.map((r) => r.id)).toEqual([EDITOR_ID]);

        const media = await client.query(
          `INSERT INTO public.media_assets (bucket, storage_path, public_url, filename, mime_type, size_bytes, uploaded_by)
           VALUES ('cms-media', 'tests/editor-img.png', 'https://example.com/editor-img.png', 'editor-img.png', 'image/png', 1024, $1)
           RETURNING id`,
          [EDITOR_ID]
        );
        expect(media.rowCount).toBe(1);

        const redirect = await client.query(
          `INSERT INTO public.seo_redirects (source_path, destination_path, status_code)
           VALUES ('/old-editor-slug', '/new-editor-slug', 301)
           RETURNING id`
        );
        expect(redirect.rowCount).toBe(1);
      });

      // Editor CANNOT modify system site_settings (admin-only)
      await withSessionRole(client, "authenticated", EDITOR_ID, async () => {
        await expect(
          client.query(
            `INSERT INTO public.site_settings (key, value) VALUES ('editor_blocked', '{}'::jsonb)`
          )
        ).rejects.toMatchObject({ code: "42501" });
      });
    });

    it("strips all admin and staff RLS privileges when is_locked = TRUE and prevents self-unlock", async () => {
      await withSessionRole(client, "authenticated", LOCKED_ADMIN_ID, async () => {
        // Locked admin loses admin visibility over other profiles
        const profiles = await client.query(
          "SELECT id FROM public.profiles WHERE id IN ($1, $2, $3)",
          [LEARNER_A, ADMIN_ID, LOCKED_ADMIN_ID]
        );
        expect(profiles.rows.map((r) => r.id)).toEqual([LOCKED_ADMIN_ID]);

        // Locked admin loses staff access to draft tests and audit logs
        const tests = await client.query(
          "SELECT slug FROM public.ielts_tests WHERE id IN ($1, $2)",
          [PUB_TEST_ID, DRAFT_TEST_ID]
        );
        expect(tests.rows.map((r) => r.slug)).toEqual(["int-published-test"]);

        const logs = await client.query("SELECT id FROM public.admin_audit_logs");
        expect(logs.rowCount).toBe(0);

        // Locked admin cannot unlock themselves
        await expect(
          client.query("UPDATE public.profiles SET is_locked = FALSE WHERE id = $1", [
            LOCKED_ADMIN_ID,
          ])
        ).rejects.toMatchObject({ code: "42501" });
      });

      // Active admin can write site_settings & seo_redirects
      await withSessionRole(client, "authenticated", ADMIN_ID, async () => {
        const setting = await client.query(
          `INSERT INTO public.site_settings (key, value) VALUES ('admin_ok', '{"ok":true}'::jsonb) RETURNING key`
        );
        expect(setting.rowCount).toBe(1);
      });
    });

    it("locks Migration 0008 atomic RPCs to service_role and verifies live Postgres payment & AI quota atomicity", async () => {
      // 1. Neither anon nor authenticated can execute SECURITY DEFINER payment/AI RPCs
      for (const role of ["anon", "authenticated"] as const) {
        const uid = role === "authenticated" ? LEARNER_A : null;

        await withSessionRole(client, role, uid, async () => {
          await expect(
            client.query(
              `SELECT public.fulfill_paid_order_atomic(123456, 199000, 'forged-evt')`
            )
          ).rejects.toMatchObject({ code: "42501" });
        });

        await withSessionRole(client, role, uid, async () => {
          await expect(
            client.query(
              `SELECT public.create_checkout_order_atomic($1, 'premium-1m', 'payos', NULL, 30)`,
              [LEARNER_A]
            )
          ).rejects.toMatchObject({ code: "42501" });
        });

        await withSessionRole(client, role, uid, async () => {
          await expect(
            client.query(
              `SELECT public.reserve_ai_quota_atomic('u:test', NULL, 'writing_eval', 'writing:evaluate', 'writing', 'gemini-2.5-flash', 2, NOW() - INTERVAL '1 hour', 3)`
            )
          ).rejects.toMatchObject({ code: "42501" });
        });
      }

      // 2. Execute live Migration 0008 payment + AI quota RPCs inside a rolled-back transaction as service_role
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL ROLE service_role");

        // Seed a 1-use promo code and a pending referral (LEARNER_B referred LEARNER_A)
        await client.query(
          `INSERT INTO public.promo_codes (code, discount_percent, max_discount_vnd, max_uses, current_uses, is_active)
           VALUES ('PG1USE', 25, 100000, 1, 0, TRUE)
           ON CONFLICT (code) DO UPDATE SET max_uses = 1, current_uses = 0, is_active = TRUE`
        );
        await client.query(
          `INSERT INTO public.referrals (referrer_id, referred_user_id, referral_code, status)
           VALUES ($1, $2, 'REFINT', 'signed_up')
           ON CONFLICT (referred_user_id) DO NOTHING`,
          [LEARNER_B, LEARNER_A]
        );

        // First checkout claims the sole promo slot
        const c1 = await client.query(
          `SELECT public.create_checkout_order_atomic($1, 'premium-1m', 'payos', 'PG1USE', 30) AS res`,
          [LEARNER_A]
        );
        expect(c1.rows[0].res.ok).toBe(true);
        const order = c1.rows[0].res.order;
        expect(order.promo_code).toBe("PG1USE");
        expect(order.duration_months).toBe(1);

        // Second checkout with same 1-use promo is rejected immediately (400)
        const c2 = await client.query(
          `SELECT public.create_checkout_order_atomic($1, 'premium-1m', 'payos', 'PG1USE', 30) AS res`,
          [LEARNER_B]
        );
        expect(c2.rows[0].res.ok).toBe(false);
        expect(c2.rows[0].res.status).toBe(400);

        // Underpayment is rejected (400)
        const under = await client.query(
          `SELECT public.fulfill_paid_order_atomic($1, $2, 'pg-evt-under') AS res`,
          [order.order_code, Number(order.amount_vnd) - 100]
        );
        expect(under.rows[0].res.ok).toBe(false);
        expect(under.rows[0].res.status).toBe(400);

        // Full payment atomically updates order, promo_codes, buyer profile, and referrer bonus days
        const paid = await client.query(
          `SELECT public.fulfill_paid_order_atomic($1, $2, 'pg-evt-ok-1') AS res`,
          [order.order_code, Number(order.amount_vnd)]
        );
        expect(paid.rows[0].res.ok).toBe(true);
        expect(paid.rows[0].res.idempotent).toBe(false);
        expect(paid.rows[0].res.premium_expires_at).toBeTruthy();

        const promoCheck = await client.query(
          `SELECT current_uses FROM public.promo_codes WHERE code = 'PG1USE'`
        );
        expect(promoCheck.rows[0].current_uses).toBe(1);

        const referrerCheck = await client.query(
          `SELECT premium_expires_at FROM public.profiles WHERE id = $1`,
          [LEARNER_B]
        );
        expect(referrerCheck.rows[0].premium_expires_at).toBeTruthy();

        // Duplicate webhook event returns 200 idempotent without double-incrementing promo
        const dup = await client.query(
          `SELECT public.fulfill_paid_order_atomic($1, $2, 'pg-evt-ok-1') AS res`,
          [order.order_code, Number(order.amount_vnd)]
        );
        expect(dup.rows[0].res.ok).toBe(true);
        expect(dup.rows[0].res.idempotent).toBe(true);
        const promoCheck2 = await client.query(
          `SELECT current_uses FROM public.promo_codes WHERE code = 'PG1USE'`
        );
        expect(promoCheck2.rows[0].current_uses).toBe(1);

        // 3. AI quota reservation RPC enforces limit=2 and frees slot on release
        const winStart = new Date(Date.now() - 3600_000).toISOString();
        const r1 = await client.query(
          `SELECT public.reserve_ai_quota_atomic($1, $2, 'writing_eval', 'writing:evaluate', 'writing', 'gemini-2.5-flash', 2, $3, 3) AS res`,
          [`u:${LEARNER_A}`, LEARNER_A, winStart]
        );
        const r2 = await client.query(
          `SELECT public.reserve_ai_quota_atomic($1, $2, 'writing_eval', 'writing:evaluate', 'writing', 'gemini-2.5-flash', 2, $3, 3) AS res`,
          [`u:${LEARNER_A}`, LEARNER_A, winStart]
        );
        const r3 = await client.query(
          `SELECT public.reserve_ai_quota_atomic($1, $2, 'writing_eval', 'writing:evaluate', 'writing', 'gemini-2.5-flash', 2, $3, 3) AS res`,
          [`u:${LEARNER_A}`, LEARNER_A, winStart]
        );
        expect(r1.rows[0].res.allowed).toBe(true);
        expect(r2.rows[0].res.allowed).toBe(true);
        expect(r3.rows[0].res.allowed).toBe(false);

        // Releasing r1 immediately frees a slot
        await client.query(
          `UPDATE public.ai_usage_logs SET status = 'released' WHERE id = $1`,
          [r1.rows[0].res.reservation_id]
        );
        const r4 = await client.query(
          `SELECT public.reserve_ai_quota_atomic($1, $2, 'writing_eval', 'writing:evaluate', 'writing', 'gemini-2.5-flash', 2, $3, 3) AS res`,
          [`u:${LEARNER_A}`, LEARNER_A, winStart]
        );
        expect(r4.rows[0].res.allowed).toBe(true);

        await client.query("ROLLBACK");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    });

    it("enforces Migration 0009 hardening on live PostgreSQL (answer keys, daily exam, profiles, site_settings, PII, promo, flashcards, content visibility, audit logs)", async () => {
      // Seed fixture rows needed for Migration 0009 checks (as superuser)
      await client.query(
        `INSERT INTO public.site_settings (key, value)
         VALUES
           ('general', '{"siteName":"On IELTS"}'::jsonb),
           ('appearance_history', '[{"actor":"admin@secret.vn"}]'::jsonb),
           ('appearance_draft', '{"draft":true}'::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
      );
      await client.query(
        `INSERT INTO public.feature_requests (id, user_id, email, title, description, votes, status)
         VALUES ('60000000-0000-4000-8000-000000000001', $1, 'private-submitter@example.com', 'Dark Mode', 'Add dark mode support', 5, 'open')
         ON CONFLICT (id) DO NOTHING`,
        [LEARNER_A]
      );
      await client.query(
        `INSERT INTO public.pronunciation_sounds (slug, symbol, title_vi, title_en, category, tip_vi, tip_en, is_published)
         VALUES
           ('pub-ipa-09', '/i:/', 'Âm i dài', 'Long i', 'vowel', 'Kéo dài âm i', 'Hold the i sound', TRUE),
           ('draft-ipa-09', '/æ/', 'Âm ae nháp', 'Draft ae', 'vowel', 'Mở miệng rộng', 'Open mouth wide', FALSE)
         ON CONFLICT (slug) DO UPDATE SET is_published = EXCLUDED.is_published`
      );
      await client.query(
        `INSERT INTO public.blog_posts (slug, title_vi, title_en, excerpt_vi, excerpt_en, content_vi, content_en, category, is_published, status, scheduled_at)
         VALUES
           ('pub-blog-09', 'Public Post', 'Public Post', 'Ex', 'Ex', 'Body', 'Body', 'tips', TRUE, 'published', NOW() - INTERVAL '1 day'),
           ('future-blog-09', 'Future Post', 'Future Post', 'Ex', 'Ex', 'Body', 'Body', 'tips', TRUE, 'scheduled', NOW() + INTERVAL '5 days'),
           ('draft-blog-09', 'Draft Post', 'Draft Post', 'Ex', 'Ex', 'Body', 'Body', 'tips', TRUE, 'draft', NULL)
         ON CONFLICT (slug) DO UPDATE SET is_published = EXCLUDED.is_published, status = EXCLUDED.status, scheduled_at = EXCLUDED.scheduled_at`
      );
      await client.query(
        `INSERT INTO public.daily_exam_attempts (daily_exam_id, user_id, display_name, answers, raw_score, max_score, band_score, duration_seconds, is_completed, submitted_at)
         VALUES ($1, $2, 'Learner A', '{"q1":"TRUE"}'::jsonb, 9, 10, 8.5, 180, TRUE, NOW())
         ON CONFLICT (daily_exam_id, user_id) DO NOTHING`,
        [DAILY_EXAM_ID, LEARNER_A]
      );

      // 1. ielts_tests: anon & authenticated CANNOT read test_data (answer keys), CAN read slug metadata
      for (const role of ["anon", "authenticated"] as const) {
        const uid = role === "authenticated" ? LEARNER_A : null;
        await withSessionRole(client, role, uid, async () => {
          const meta = await client.query(
            "SELECT id, slug, title_vi FROM public.ielts_tests WHERE id = $1",
            [PUB_TEST_ID]
          );
          expect(meta.rowCount).toBe(1);
        });
        await withSessionRole(client, role, uid, async () => {
          await expect(
            client.query("SELECT test_data FROM public.ielts_tests WHERE id = $1", [
              PUB_TEST_ID,
            ])
          ).rejects.toMatchObject({ code: "42501" });
        });
      }

      // 2. daily_exam_attempts: Learner B cannot read Learner A's answers, Learner A cannot self-update score,
      //    and public leaderboard view exposes safe fields without answers/user_id
      await withSessionRole(client, "authenticated", LEARNER_B, async () => {
        const snooped = await client.query(
          "SELECT answers FROM public.daily_exam_attempts WHERE user_id = $1",
          [LEARNER_A]
        );
        expect(snooped.rowCount).toBe(0);
      });
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        const tampered = await client.query(
          "UPDATE public.daily_exam_attempts SET raw_score = 40 WHERE user_id = $1 RETURNING id",
          [LEARNER_A]
        );
        expect(tampered.rowCount).toBe(0);
      });
      await withSessionRole(client, "anon", null, async () => {
        const lb = await client.query(
          "SELECT display_name, raw_score, band_score FROM public.daily_exam_leaderboard_public WHERE daily_exam_id = $1",
          [DAILY_EXAM_ID]
        );
        expect((lb.rowCount ?? 0) >= 1).toBe(true);
      });

      // 3. profiles: Learner A cannot self-update streak_count, email_verified, or referral_code,
      //    but CAN still update own full_name
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await expect(
          client.query("UPDATE public.profiles SET streak_count = 999 WHERE id = $1", [
            LEARNER_A,
          ])
        ).rejects.toMatchObject({ code: "42501" });
      });
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await expect(
          client.query("UPDATE public.profiles SET email_verified = FALSE WHERE id = $1", [
            LEARNER_A,
          ])
        ).rejects.toMatchObject({ code: "42501" });
      });
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        const okUpd = await client.query(
          "UPDATE public.profiles SET full_name = 'Learner A Updated' WHERE id = $1 RETURNING full_name",
          [LEARNER_A]
        );
        expect(okUpd.rows[0]?.full_name).toBe("Learner A Updated");
      });

      // 4. site_settings: anon can read 'general' but CANNOT read 'appearance_history' or 'appearance_draft'
      await withSessionRole(client, "anon", null, async () => {
        const rows = await client.query(
          "SELECT key FROM public.site_settings WHERE key IN ('general', 'appearance_history', 'appearance_draft')"
        );
        expect(rows.rows.map((r) => r.key)).toEqual(["general"]);
      });

      // 5. feature_requests: anon can read public columns, CANNOT select email or directly INSERT
      await withSessionRole(client, "anon", null, async () => {
        const pub = await client.query(
          "SELECT id, title, votes, status FROM public.feature_requests WHERE id = '60000000-0000-4000-8000-000000000001'"
        );
        expect(pub.rowCount).toBe(1);
      });
      await withSessionRole(client, "anon", null, async () => {
        await expect(
          client.query("SELECT email FROM public.feature_requests")
        ).rejects.toMatchObject({ code: "42501" });
      });
      await withSessionRole(client, "anon", null, async () => {
        await expect(
          client.query(
            "INSERT INTO public.feature_requests (title, description) VALUES ('Spam', 'Direct spam bypass')"
          )
        ).rejects.toMatchObject({ code: "42501" });
      });

      // 6. contact_messages & newsletter_subscribers: anon CANNOT directly INSERT
      await withSessionRole(client, "anon", null, async () => {
        await expect(
          client.query(
            "INSERT INTO public.contact_messages (name, email, subject, message) VALUES ('Bot', 'bot@spam.io', 'Hi', 'Direct PostgREST spam')"
          )
        ).rejects.toMatchObject({ code: "42501" });
      });
      await withSessionRole(client, "anon", null, async () => {
        await expect(
          client.query(
            "INSERT INTO public.newsletter_subscribers (email) VALUES ('bot@spam.io')"
          )
        ).rejects.toMatchObject({ code: "42501" });
      });

      // 7. promo_codes: authenticated learner cannot enumerate active promo codes
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        const promos = await client.query("SELECT code FROM public.promo_codes");
        expect(promos.rowCount).toBe(0);
      });

      // 8. flashcards: Learner B CANNOT insert a flashcard into Learner A's flashcard_sets
      await withSessionRole(client, "authenticated", LEARNER_B, async () => {
        await expect(
          client.query(
            `INSERT INTO public.flashcards (set_id, user_id, term, definition_vi)
             VALUES ($1, $2, 'injected', 'xâm nhập')`,
            [SET_A_ID, LEARNER_B]
          )
        ).rejects.toMatchObject({ code: "42501" });
      });
      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        const ownCard = await client.query(
          `INSERT INTO public.flashcards (set_id, user_id, term, definition_vi)
           VALUES ($1, $2, 'legitimate', 'hợp lệ') RETURNING id`,
          [SET_A_ID, LEARNER_A]
        );
        expect(ownCard.rowCount).toBe(1);
      });

      // 9. pronunciation_sounds & blog_posts: anon only sees published & non-future items
      await withSessionRole(client, "anon", null, async () => {
        const ipa = await client.query(
          "SELECT slug FROM public.pronunciation_sounds WHERE slug IN ('pub-ipa-09', 'draft-ipa-09')"
        );
        expect(ipa.rows.map((r) => r.slug)).toEqual(["pub-ipa-09"]);

        const blogs = await client.query(
          "SELECT slug FROM public.blog_posts WHERE slug IN ('pub-blog-09', 'future-blog-09', 'draft-blog-09')"
        );
        expect(blogs.rows.map((r) => r.slug)).toEqual(["pub-blog-09"]);
      });

      // 10. admin_audit_logs: Admin can SELECT (>=1), Editor gets 0
      await withSessionRole(client, "authenticated", ADMIN_ID, async () => {
        const logs = await client.query("SELECT id FROM public.admin_audit_logs");
        expect((logs.rowCount ?? 0) >= 1).toBe(true);
      });
    });
  }
);
