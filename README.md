# Ôn IELTS — Production Platform Guide

Full-stack IELTS self-study and AI coaching platform for Vietnamese & English learners built with **Next.js 16 (App Router + `src/proxy.ts`)**, **React 19**, **Supabase (Postgres + Auth + Storage + RLS via `@supabase/ssr`)**, **Google Gemini AI**, **PayOS VietQR**, **Upstash Redis**, and **next-intl**.

---

## 1. Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Build production bundle (verifies TypeScript + `src/proxy.ts`) |
| `npm run lint` | Run ESLint across the codebase |
| `npx tsc --noEmit` | Run strict TypeScript typecheck |
| `npm test` | Run Vitest unit & security test suite |
| `npm run test:rls` | Run static RLS verification + live Postgres RLS tests (when `SUPABASE_DB_URL` is set) |
| `npm run test:rls:docker` | Spin up an ephemeral `postgres:16-alpine` container, apply all migrations, and run live RLS integration tests |

---

## 2. Environment Variables

Copy `.env.example` to `.env.local` locally, and configure the same keys in **Vercel → Project Settings → Environment Variables**.

> **Security rule:** Never add the `NEXT_PUBLIC_` prefix to any server-only secret (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `PAYOS_*`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SECRET_KEY`).

| Variable | Scope | Required (Prod) | Description | Where to get it |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Client + Server | **Yes** | Canonical public origin (e.g. `https://onielts.vercel.app`) used for SEO metadata and OAuth/OTP redirects | Your Vercel domain |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | **Yes** | Supabase project URL (`https://<project-ref>.supabase.co`) | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | **Yes** | Supabase public `anon` / publishable key | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | **Yes** | Supabase `service_role` / secret key for admin queries, verified PayOS webhooks, and safe RLS profile provisioning fallback | Supabase → Project Settings → API Keys |
| `GEMINI_API_KEY` | **Server-only** | **Yes** (for AI) | Google Gemini API key (centralized strictly inside `src/lib/ai.ts`) | Google AI Studio |
| `GEMINI_MODEL` | **Server-only** | Optional | Gemini model ID (default: `gemini-2.5-flash`) | Google AI Studio |
| `PAYOS_CLIENT_ID` | **Server-only** | **Yes** (for payments) | PayOS Client ID | PayOS Dashboard → Channels |
| `PAYOS_API_KEY` | **Server-only** | **Yes** (for payments) | PayOS API Key | PayOS Dashboard → Channels |
| `PAYOS_CHECKSUM_KEY` | **Server-only** | **Yes** (for payments) | PayOS HMAC-SHA256 webhook verification key (fail-closed in production) | PayOS Dashboard → Channels |
| `PAYOS_SANDBOX` | **Server-only** | Optional | Local dev only (`false` in production; ignored when `NODE_ENV === "production"`) | Local `.env.local` |
| `UPSTASH_REDIS_REST_URL` | **Server-only** | Recommended | Upstash Redis REST endpoint (also auto-detects Vercel Marketplace `KV_REST_API_URL`) | Upstash Console / Vercel Marketplace |
| `UPSTASH_REDIS_REST_TOKEN` | **Server-only** | Recommended | Upstash Redis REST bearer token (also auto-detects `KV_REST_API_TOKEN`; falls back to bounded in-memory limiter locally) | Upstash Console / Vercel Marketplace |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Client + Server | Optional | Cloudflare Turnstile public site key | Cloudflare Dashboard |
| `TURNSTILE_SECRET_KEY` | **Server-only** | Optional | Cloudflare Turnstile verification secret | Cloudflare Dashboard |
| `SUPABASE_DB_URL` | Test/CI only | Optional | Direct PostgreSQL connection string for running `tests/rls.integration.test.ts` | `supabase status` or local Docker |

---

## 3. Supabase Migration Order

Run the SQL migrations in **exact ascending order** inside **Supabase → SQL Editor** (or via `supabase db push`):

1. `supabase/migrations/0001_initial_schema.sql` — Creates all 26 tables, `public.is_admin()`, triggers, storage buckets, and strict Row Level Security (RLS) policies on every table.
2. `supabase/migrations/0002_seed_config.sql` — Seeds initial band conversion tables, pricing plans, promo banner, and promo codes (idempotent).
3. `supabase/migrations/0003_auth_profile_trigger.sql` — Auto-provisions `public.profiles` rows on new `auth.users` signup with safe defaults (`role = 'learner'`, `premium_expires_at = NULL`).
4. `supabase/migrations/0004_public_grants.sql` — Grants base schema/table/sequence/function privileges to `anon`, `authenticated`, and `service_role` so PostgREST evaluates RLS policies instead of throwing PostgreSQL `42501` (`permission denied`).

### Running Real RLS Integration Tests

- **Option A — Ephemeral Docker Postgres (recommended for CI / local):**
  ```bash
  npm run test:rls:docker
  ```
- **Option B — Against Supabase Local (`supabase start`):**
  ```bash
  SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npm run test:rls
  ```
- **Option C — Native pgTAP suite (`supabase/tests/rls.test.sql`):**
  ```bash
  supabase test db
  ```

---

## 4. Google OAuth Setup

1. **Google Cloud Console → Google Auth Platform** (`https://console.cloud.google.com/auth/overview`):
   - Create/select a project and complete **Get started** (`Audience: External`, support & developer contact email).
   - Under **Branding**: set Application home page to `https://onielts.vercel.app` and Authorized domains to `onielts.vercel.app` and `<project-ref>.supabase.co`.
   - Under **Audience**: click **Publish App** for public learners (or add your email under **Test users** while testing).
   - Under **Clients → Create client → Web application**:
     - **Authorized JavaScript origins**: `https://onielts.vercel.app`
     - **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Copy the generated **Client ID** and **Client Secret**.
2. **Supabase → Authentication → Sign In / Providers → Google**:
   - Toggle **Enable Sign in with Google** ON.
   - Paste **Client ID** and **Client Secret**, then click **Save**.
3. **Supabase → Authentication → URL Configuration**:
   - **Site URL**: `https://onielts.vercel.app`
   - **Redirect URLs**: add both:
     - `https://onielts.vercel.app/auth/callback`
     - `https://onielts.vercel.app/auth/callback**`
   - Click **Save**.

---

## 5. PayOS Setup

1. Create a channel in the **PayOS Dashboard** and copy `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY`.
2. Add all three as **server-only** env vars in Vercel (ensure `PAYOS_SANDBOX=false` in production).
3. Configure the PayOS webhook URL to:
   ```text
   https://onielts.vercel.app/api/webhooks/payos
   ```
   - `src/proxy.ts` explicitly excludes `/api/webhooks/*` from session proxy execution.
   - `src/app/api/webhooks/payos/route.ts` verifies the HMAC-SHA256 signature fail-closed (rejects requests when `PAYOS_CHECKSUM_KEY` is missing or signature mismatches) and uses unique `webhook_event_id` for idempotency.

---

## 6. How to Grant Admin Access

Never auto-grant admin in application code. To promote an account to `admin`:

1. Sign in once at `https://onielts.vercel.app/auth` so your user exists in `auth.users` and `public.profiles`.
2. Find your exact UUID in **Supabase → Authentication → Users** (note: signing in with Google vs Email OTP can create separate `auth.users` UUIDs if not linked — always use the UUID of the login method you actually use; visiting `/admin` while signed in also prints your active UUID).
3. Run in **Supabase → SQL Editor**:
   ```sql
   update public.profiles set role='admin' where id='<auth user uuid>';
   ```
4. Refresh `https://onielts.vercel.app/admin`. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set on Vercel so admin tables (`listAllProfiles`, `listOrders`, `listAiUsageLogs`) can load.

---

## 7. Vercel Deploy Checklist

- [ ] All required environment variables set for **Production** (and **Preview** if desired), with zero server secrets prefixed with `NEXT_PUBLIC_`.
- [ ] All 4 Supabase SQL migrations (`0001`–`0004`) executed in order.
- [ ] Google OAuth Client ID/Secret saved in Supabase and `https://<domain>/auth/callback**` added to Supabase **Redirect URLs**.
- [ ] Upstash Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) configured for distributed production rate limiting.
- [ ] Redeploy triggered after any env var change.
- [ ] Verify `GET https://<domain>/api/health/auth` returns:
  ```json
  {
    "supabaseConfigured": true,
    "serviceRoleKeyPresent": true,
    "appUrlSet": true,
    "authenticated": true,
    "profileRowFound": true,
    "role": "admin"
  }
  ```
- [ ] Verify `/profile`, `/admin`, `/leaderboard`, and `/tests` load cleanly without console or server errors.
