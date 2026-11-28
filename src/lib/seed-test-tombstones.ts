import "server-only";
import { createSupabaseAdminClient, isSupabaseConfigured } from "./supabase/server";
import { readStore, updateStore } from "./store";
import { FULL_SEED_TESTS } from "./seed-tests";
import type { IeltsTest } from "./types";

/**
 * "Tombstones" for built-in sample tests (FULL_SEED_TESTS) that an admin deleted.
 *
 * Why: `ensureSupabaseCatalogSeeded()` re-inserts every sample slug missing from
 * `ielts_tests` on each cold start (to ship new samples to existing databases). Without
 * a tombstone, a deleted sample test silently came back on the next serverless instance.
 *
 * Storage is additive only: one `site_settings` row (`key = deleted_seed_test_slugs`)
 * in Supabase, or `site_settings.deleted_seed_test_slugs` in the local JSON store.
 */
export const DELETED_SEED_TESTS_SETTING_KEY = "deleted_seed_test_slugs";

const LEGACY_SAMPLE_SLUGS = ["custom-reading-demo-04"] as const;

export const SEED_TEST_SLUGS: ReadonlySet<string> = new Set([
  ...FULL_SEED_TESTS.map((t) => t.slug),
  ...LEGACY_SAMPLE_SLUGS,
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNullableUuid(value?: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

export function isSeedTestSlug(slug: string | null | undefined): boolean {
  return Boolean(slug) && SEED_TEST_SLUGS.has(String(slug));
}

function parseSlugList(value: unknown): string[] {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { slugs?: unknown }).slugs
      : value;
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

/**
 * Strict read: returns `null` when the tombstone list could not be read (network/DB error),
 * so callers like the auto-seeder can play safe and skip re-inserting samples.
 */
export async function readDeletedSeedTestSlugsStrict(): Promise<Set<string> | null> {
  if (!isSupabaseConfigured()) {
    return new Set(readStore().site_settings.deleted_seed_test_slugs ?? []);
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("site_settings")
    .select("value")
    .eq("key", DELETED_SEED_TESTS_SETTING_KEY)
    .maybeSingle();
  if (error) {
    const code = String((error as { code?: string }).code ?? "");
    const msg = String(error.message ?? "");
    // Very old databases without `site_settings` simply have no tombstones yet.
    if (code === "42P01" || code === "PGRST205" || /does not exist|Could not find the table/i.test(msg)) {
      return new Set();
    }
    return null;
  }
  if (!data) return new Set();
  return new Set(parseSlugList((data as { value?: unknown }).value));
}

export async function getDeletedSeedTestSlugs(): Promise<Set<string>> {
  return (await readDeletedSeedTestSlugsStrict()) ?? new Set();
}

/**
 * Remember that these sample slugs were deliberately deleted. Non-sample slugs are ignored.
 * Must succeed BEFORE the row is deleted, otherwise the sample could be re-seeded.
 */
export async function addDeletedSeedTestSlugs(
  slugs: string[],
  actorId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const toAdd = slugs.filter(isSeedTestSlug);
  if (toAdd.length === 0) return { ok: true };

  if (!isSupabaseConfigured()) {
    updateStore((store) => {
      const merged = new Set(store.site_settings.deleted_seed_test_slugs ?? []);
      for (const s of toAdd) merged.add(s);
      store.site_settings.deleted_seed_test_slugs = [...merged].sort();
    });
    return { ok: true };
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "Thiếu kết nối Supabase Admin." };
  const current = await readDeletedSeedTestSlugsStrict();
  if (!current) {
    return { ok: false, error: "Không đọc được danh sách đề mẫu đã xóa (site_settings)." };
  }
  for (const s of toAdd) current.add(s);
  const { error } = await admin.from("site_settings").upsert(
    {
      key: DELETED_SEED_TESTS_SETTING_KEY,
      value: { slugs: [...current].sort() },
      updated_by: toNullableUuid(actorId),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Sample tests that are still allowed to be shown / seeded (excludes tombstoned slugs). */
export function filterOutDeletedSeedTests(
  tests: readonly IeltsTest[],
  deleted: ReadonlySet<string>
): IeltsTest[] {
  if (deleted.size === 0) return [...tests];
  return tests.filter((t) => !deleted.has(t.slug));
}
