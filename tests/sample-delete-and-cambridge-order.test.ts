import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import {
  parseCambridgeOrderKey,
  sortIeltsTestsForCatalog,
} from "@/lib/test-ordering";
import {
  SEED_TEST_SLUGS,
  filterOutDeletedSeedTests,
  getDeletedSeedTestSlugs,
  isSeedTestSlug,
} from "@/lib/seed-test-tombstones";
import {
  bulkManageSampleTests,
  deleteCmsTest,
  listAdminTests,
} from "@/lib/cms-tests";
import { getIeltsTestBySlug, getIeltsTestSummaries, getIeltsTests } from "@/lib/db";
import { readStore, updateStore } from "@/lib/store";
import type { IeltsTest } from "@/lib/types";

const ADMIN_ACTOR = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "admin@onielts.vn",
  role: "admin" as const,
};

function makeMockTest(overrides: Partial<IeltsTest> & { slug: string }): IeltsTest {
  return {
    id: overrides.id ?? `mock-${overrides.slug}`,
    slug: overrides.slug,
    skill: overrides.skill ?? "reading",
    module: overrides.module ?? "academic",
    title_vi: overrides.title_vi ?? overrides.slug,
    title_en: overrides.title_en ?? overrides.title_vi ?? overrides.slug,
    description_vi: overrides.description_vi ?? "Mô tả đề thi",
    description_en: overrides.description_en ?? "Test description",
    duration_minutes: overrides.duration_minutes ?? 60,
    difficulty: overrides.difficulty ?? "band_6_7",
    questionCount: overrides.questionCount ?? 40,
    is_published: overrides.is_published ?? true,
    sections: overrides.sections ?? [],
    created_at: overrides.created_at ?? "2026-11-28T00:00:00.000Z",
  };
}

describe("Cambridge 21 → 10 catalog ordering (src/lib/test-ordering.ts)", () => {
  it("parses diverse Cambridge naming formats without false positives", () => {
    expect(
      parseCambridgeOrderKey({
        slug: "cambridge-21-test-1",
        title_vi: "Cambridge IELTS 21 Academic Reading Test 1",
      })
    ).toEqual({ book: 21, test: 1, part: Number.POSITIVE_INFINITY });

    expect(
      parseCambridgeOrderKey({
        slug: "cam20-t2-p3",
        title_vi: "Cam 20 - Test 2 - Passage 3",
      })
    ).toEqual({ book: 20, test: 2, part: 3 });

    expect(
      parseCambridgeOrderKey({
        slug: "c18t4",
        title_vi: "C18T4 Listening",
      })
    ).toEqual({ book: 18, test: 4, part: Number.POSITIVE_INFINITY });

    expect(
      parseCambridgeOrderKey({
        slug: "cam-reading-16-de-2",
        title_vi: "Cambridge Reading 16 - Đề số 2",
      })
    ).toEqual({ book: 16, test: 2, part: Number.POSITIVE_INFINITY });

    expect(
      parseCambridgeOrderKey({
        slug: "cambridge-ielts-15-test-3",
        title_vi: "Đề đọc hiểu tổng hợp",
      })
    ).toEqual({ book: 15, test: 3, part: Number.POSITIVE_INFINITY });

    expect(
      parseCambridgeOrderKey({
        slug: "cam-10-bai-1",
        title_vi: "Cambridge quyển 10 - Đề 4 - Bài đọc 2",
      })
    ).toEqual({ book: 10, test: 4, part: 2 });

    // Non-Cambridge / false-positive guards
    expect(
      parseCambridgeOrderKey({
        slug: "writing-academic-01-renewable-energy-remote-work",
        title_vi: "Writing Academic 01: Biểu đồ Năng lượng tái tạo",
      })
    ).toBeNull();
    expect(
      parseCambridgeOrderKey({
        slug: "camera-360-guide",
        title_vi: "Camera 360 in Modern Cinema",
      })
    ).toBeNull();
    expect(
      parseCambridgeOrderKey({
        slug: "cambridge-2026-forecast",
        title_vi: "Cambridge 2026 Forecast",
      })
    ).toBeNull();
    expect(
      parseCambridgeOrderKey({
        slug: "cambridge-19th-century",
        title_vi: "University of Cambridge 19th Century History",
      })
    ).toBeNull();
    expect(
      parseCambridgeOrderKey({
        slug: "cambridge-test-1",
        title_vi: "Cambridge Test 1",
      })
    ).toBeNull();
  });

  it("sorts Cambridge 21 down to 10 (with Test 1 → 4 ascending per book) and keeps non-Cambridge tests in original order", () => {
    const input = [
      makeMockTest({ slug: "writing-01", title_vi: "Writing Academic 01", skill: "writing" }),
      makeMockTest({ slug: "cam-10-t2", title_vi: "Cambridge 10 - Test 2" }),
      makeMockTest({ slug: "cam-15-t1", title_vi: "Cambridge IELTS 15 Test 1" }),
      makeMockTest({ slug: "speaking-01", title_vi: "Speaking 01", skill: "speaking" }),
      makeMockTest({ slug: "cam-21-t3", title_vi: "Cambridge IELTS 21 Test 3" }),
      makeMockTest({ slug: "cam-10-t1", title_vi: "Cambridge 10 - Test 1" }),
      makeMockTest({ slug: "cam-21-t1", title_vi: "Cambridge IELTS 21 Test 1" }),
      makeMockTest({ slug: "cam-19-t4", title_vi: "Cam 19 Test 4" }),
      makeMockTest({ slug: "cam-20-t1", title_vi: "Cambridge 20 - Test 1" }),
      makeMockTest({ slug: "cam-12-t2", title_vi: "C12T2 Reading" }),
      makeMockTest({ slug: "cam-21-t2", title_vi: "Cambridge IELTS 21 Test 2" }),
      makeMockTest({ slug: "cam-11-t1", title_vi: "Cambridge 11 Test 1" }),
      makeMockTest({ slug: "cam-18-t1", title_vi: "Cam18 Test 1" }),
      makeMockTest({ slug: "cam-17-t1", title_vi: "Cambridge 17 Test 1" }),
      makeMockTest({ slug: "cam-16-t1", title_vi: "Cambridge 16 Test 1" }),
      makeMockTest({ slug: "cam-14-t1", title_vi: "Cambridge 14 Test 1" }),
      makeMockTest({ slug: "cam-13-t1", title_vi: "Cambridge 13 Test 1" }),
    ];

    const originalSlugs = input.map((t) => t.slug);
    const sorted = sortIeltsTestsForCatalog(input);

    // Must not mutate input array
    expect(input.map((t) => t.slug)).toEqual(originalSlugs);

    expect(sorted.map((t) => t.slug)).toEqual([
      "cam-21-t1",
      "cam-21-t2",
      "cam-21-t3",
      "cam-20-t1",
      "cam-19-t4",
      "cam-18-t1",
      "cam-17-t1",
      "cam-16-t1",
      "cam-15-t1",
      "cam-14-t1",
      "cam-13-t1",
      "cam-12-t2",
      "cam-11-t1",
      "cam-10-t1",
      "cam-10-t2",
      // Non-Cambridge tests remain at the end in their original order
      "writing-01",
      "speaking-01",
    ]);
  });
});

describe("Sample test deletion, tombstones & anti-resurrection", () => {
  let savedTests: IeltsTest[];
  let savedTombstones: string[] | undefined;

  beforeEach(() => {
    const snap = readStore();
    savedTests = structuredClone(snap.ielts_tests);
    savedTombstones = snap.site_settings.deleted_seed_test_slugs
      ? [...snap.site_settings.deleted_seed_test_slugs]
      : undefined;
  });

  afterEach(() => {
    updateStore((store) => {
      store.ielts_tests = savedTests;
      if (savedTombstones === undefined) {
        delete store.site_settings.deleted_seed_test_slugs;
      } else {
        store.site_settings.deleted_seed_test_slugs = savedTombstones;
      }
    });
  });

  it("records a tombstone when deleting a sample test so it stays deleted everywhere", async () => {
    const sampleSlug = "writing-academic-01-renewable-energy-remote-work";
    expect(isSeedTestSlug(sampleSlug)).toBe(true);
    const target = readStore().ielts_tests.find((t) => t.slug === sampleSlug);
    expect(target).toBeDefined();

    const res = await deleteCmsTest(target!.id, ADMIN_ACTOR);
    expect(res).toEqual({ ok: true });

    const tombstones = await getDeletedSeedTestSlugs();
    expect(tombstones.has(sampleSlug)).toBe(true);

    expect(await getIeltsTestBySlug(sampleSlug, false)).toBeNull();
    const summaries = await getIeltsTestSummaries(false);
    expect(summaries.some((t) => t.slug === sampleSlug)).toBe(false);

    // Code fallback helper also strips tombstoned samples
    const filteredFallback = filterOutDeletedSeedTests(savedTests, tombstones);
    expect(filteredFallback.some((t) => t.slug === sampleSlug)).toBe(false);
  });

  it("bulk hides or deletes ALL sample tests without touching custom Cambridge tests", async () => {
    const cam21 = makeMockTest({
      id: "custom-cam-21-t1",
      slug: "cambridge-ielts-21-reading-test-1",
      title_vi: "Cambridge IELTS 21 - Test 1",
    });
    const cam10 = makeMockTest({
      id: "custom-cam-10-t4",
      slug: "cambridge-ielts-10-reading-test-4",
      title_vi: "Cambridge IELTS 10 - Test 4",
    });
    updateStore((store) => {
      store.ielts_tests = [...store.ielts_tests, cam10, cam21];
    });

    // Admin list puts Cambridge 21 before Cambridge 10 before sample tests
    const beforeList = await listAdminTests({ page: 1, pageSize: 10 });
    expect(beforeList.items[0]?.slug).toBe(cam21.slug);
    expect(beforeList.items[1]?.slug).toBe(cam10.slug);
    expect(beforeList.sampleTotal).toBeGreaterThan(0);

    // 1. Bulk unpublish hides all sample tests while keeping custom Cambridge tests published
    const hideRes = await bulkManageSampleTests("unpublish", ADMIN_ACTOR);
    expect(hideRes.ok).toBe(true);
    const publishedAfterHide = await getIeltsTestSummaries(false);
    expect(publishedAfterHide.map((t) => t.slug)).toEqual([cam21.slug, cam10.slug]);

    // 2. Bulk delete removes all sample tests & tombstones all sample slugs, leaving Cambridge intact
    const delRes = await bulkManageSampleTests("delete", ADMIN_ACTOR);
    expect(delRes.ok).toBe(true);
    const afterList = await listAdminTests({ page: 1, pageSize: 50 });
    expect(afterList.sampleTotal).toBe(0);
    expect(afterList.items.map((t) => t.slug)).toEqual([cam21.slug, cam10.slug]);

    // Full tests & summaries stay identical in order
    const [full, summaries] = await Promise.all([
      getIeltsTests(false),
      getIeltsTestSummaries(false),
    ]);
    expect(summaries.map((t) => t.slug)).toEqual([cam21.slug, cam10.slug]);
    expect(full.map((t) => t.slug)).toEqual([cam21.slug, cam10.slug]);

    const tombstones = await getDeletedSeedTestSlugs();
    for (const slug of SEED_TEST_SLUGS) {
      expect(tombstones.has(slug)).toBe(true);
    }
  });

  it("guards Supabase cold-start seeder & readers against resurrecting deleted or hidden sample tests", () => {
    const dbSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/db.ts"),
      "utf-8"
    );
    // Seeder only inserts built-in samples on an empty ielts_tests table and honors tombstones
    expect(dbSrc).toContain("existingTests.length === 0 && deletedSeedSlugs !== null");
    expect(dbSrc).toContain(
      "if (!shouldSeedEmptyCatalog || !deletedSeedSlugs || deletedSeedSlugs.has(t.slug)) continue;"
    );
    // Readers sort with sortIeltsTestsForCatalog and do NOT fall back to FULL_SEED_TESTS on empty data
    expect(dbSrc).not.toContain("if (error || !data || data.length === 0) return FULL_SEED_TESTS");
    expect(dbSrc).toContain("sortIeltsTestsForCatalog");
    expect(dbSrc).toContain("if (!data) {\n      // Deleted or hidden sample tests must 404");
  });
});
