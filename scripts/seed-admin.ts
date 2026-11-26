#!/usr/bin/env tsx
/**
 * Idempotent initial Admin account promotion script (`npm run seed:admin`).
 * Reads ADMIN_SEED_EMAIL from environment variables (.env.local / .env / shell) —
 * NEVER hardcodes emails or passwords.
 *
 * Usage:
 *   ADMIN_SEED_EMAIL=you@example.com npm run seed:admin
 *   npm run seed:admin   # reads ADMIN_SEED_EMAIL from .env.local
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filename: string): void {
  const full = path.resolve(process.cwd(), filename);
  if (!fs.existsSync(full)) return;
  const lines = fs.readFileSync(full, "utf-8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");

  const targetEmail = (process.env.ADMIN_SEED_EMAIL || "").trim().toLowerCase();
  const targetRole =
    process.env.ADMIN_SEED_ROLE?.trim() === "editor" ? "editor" : "admin";
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!targetEmail || !targetEmail.includes("@")) {
    console.error(
      "[seed:admin] Missing or invalid ADMIN_SEED_EMAIL environment variable.\n" +
        "Example: ADMIN_SEED_EMAIL=admin@yourdomain.com npm run seed:admin"
    );
    process.exit(1);
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[seed:admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Search auth.users via Supabase Admin API (paginated)
  let matchedUser: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  } | null = null;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) {
      throw new Error(`auth.admin.listUsers failed: ${error.message}`);
    }
    const found = data.users.find(
      (u) => (u.email || "").toLowerCase() === targetEmail
    );
    if (found) {
      matchedUser = found;
      break;
    }
    if (data.users.length < 100) break;
  }

  if (!matchedUser) {
    console.error(
      `[seed:admin] No auth.users record found for ${targetEmail}.\n` +
        "Please sign in once via /auth (Google or Email OTP) so Supabase Auth creates the user, then re-run `npm run seed:admin`."
    );
    process.exit(1);
  }

  const metaName =
    (matchedUser.user_metadata?.full_name as string | undefined) ||
    (matchedUser.user_metadata?.name as string | undefined) ||
    targetEmail.split("@")[0] ||
    "Admin Ôn IELTS";
  const refPrefix =
    targetEmail
      .split("@")[0]
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 6) || "ADMIN";
  const refSuffix = matchedUser.id.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4);

  const { error: upsertErr } = await admin.from("profiles").upsert(
    {
      id: matchedUser.id,
      email: targetEmail,
      full_name: metaName,
      role: targetRole,
      is_locked: false,
      referral_code: `${refPrefix}${refSuffix}`,
      email_verified: Boolean(matchedUser.email_confirmed_at),
      streak_count: 1,
    },
    { onConflict: "id" }
  );

  if (upsertErr) {
    // Fallback if migration 0005 (is_locked) hasn't been applied yet
    if (upsertErr.message.includes("is_locked")) {
      const { error: retryErr } = await admin.from("profiles").upsert(
        {
          id: matchedUser.id,
          email: targetEmail,
          full_name: metaName,
          role: targetRole,
          referral_code: `${refPrefix}${refSuffix}`,
          email_verified: Boolean(matchedUser.email_confirmed_at),
          streak_count: 1,
        },
        { onConflict: "id" }
      );
      if (retryErr) {
        throw new Error(`profiles upsert failed: ${retryErr.message}`);
      }
    } else {
      throw new Error(`profiles upsert failed: ${upsertErr.message}`);
    }
  }

  // Record audit log if table exists
  await admin
    .from("admin_audit_logs")
    .insert({
      actor_id: matchedUser.id,
      actor_email: targetEmail,
      actor_role: targetRole,
      action: "seed_admin_role",
      entity_type: "profile",
      entity_id: matchedUser.id,
      entity_label: targetEmail,
      summary: `Granted role '${targetRole}' via scripts/seed-admin.ts`,
    })
    .then(() => {});

  console.log(
    `[seed:admin] Success! Promoted user ${matchedUser.id} (${targetEmail}) to role='${targetRole}'.`
  );
}

main().catch((err) => {
  console.error("[seed:admin] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
