import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_URL =
  process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";

const LEARNER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEARNER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
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

      // Seed test users (auth.users -> trigger auto-provisions profiles; ensure admin role on ADMIN_ID)
      await client.query(
        `INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         VALUES
           ($1, 'learner-a@rls-int.local', NOW(), '{"full_name":"Learner A"}'::jsonb),
           ($2, 'learner-b@rls-int.local', NOW(), '{"full_name":"Learner B"}'::jsonb),
           ($3, 'admin@rls-int.local', NOW(), '{"full_name":"Admin Int"}'::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [LEARNER_A, LEARNER_B, ADMIN_ID]
      );

      await client.query(
        `INSERT INTO public.profiles (id, email, full_name, role, referral_code, email_verified)
         VALUES
           ($1, 'learner-a@rls-int.local', 'Learner A', 'learner', 'INTA0001', TRUE),
           ($2, 'learner-b@rls-int.local', 'Learner B', 'learner', 'INTB0002', TRUE),
           ($3, 'admin@rls-int.local', 'Admin Int', 'admin', 'INTC0003', TRUE)
         ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`,
        [LEARNER_A, LEARNER_B, ADMIN_ID]
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
    }, 30_000);

    afterAll(async () => {
      if (client) {
        // Clean up seeded test fixtures if running against a shared Supabase Local DB
        await client.query(
          `DELETE FROM public.daily_exams WHERE id = $1`,
          [DAILY_EXAM_ID]
        ).catch(() => {});
        await client.query(
          `DELETE FROM public.ielts_tests WHERE id IN ($1, $2)`,
          [PUB_TEST_ID, DRAFT_TEST_ID]
        ).catch(() => {});
        await client.query(
          `DELETE FROM auth.users WHERE id IN ($1, $2, $3)`,
          [LEARNER_A, LEARNER_B, ADMIN_ID]
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

      await withSessionRole(client, "authenticated", LEARNER_A, async () => {
        await client.query(
          `INSERT INTO public.daily_exam_attempts (daily_exam_id, user_id, display_name, raw_score, is_completed)
           VALUES ($1, $2, 'Learner A', 9, TRUE)`,
          [DAILY_EXAM_ID, LEARNER_A]
        );
        await expect(
          client.query(
            `INSERT INTO public.daily_exam_attempts (daily_exam_id, user_id, display_name, raw_score, is_completed)
             VALUES ($1, $2, 'Learner A', 10, TRUE)`,
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
  }
);
