import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_FALLBACK_OG_IMAGE,
  buildNextMetadata,
} from "@/lib/seo";
import {
  DEFAULT_SITE_GENERAL_SETTINGS,
  isPromoBannerActiveNow,
  isValidSocialProfileUrl,
  promoBannerUpdateSchema,
} from "@/lib/system-cms-shared";
import { validateTestForPublish } from "@/lib/test-cms-shared";

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

describe("GĐ1 Bug Fixes Verification", () => {
  it("Fix #1: hides custom-reading-demo-04 and blocks/warns publishing Reading/Listening < 40 questions", () => {
    const dbFile = read("src/lib/db.ts");
    expect(dbFile).toContain("custom-reading-demo-04");
    expect(dbFile).toContain("isHiddenIncompleteDemoTest");

    const report = validateTestForPublish({
      skill: "reading",
      sections: [
        {
          id: "s1",
          title: "Passage 1",
          passage: "Short demo passage",
          questions: [
            {
              id: "q1",
              number: 1,
              type: "tfng",
              prompt: "Demo statement",
              options: ["TRUE", "FALSE", "NOT GIVEN"],
              correctAnswers: ["TRUE"],
              explanation_vi: "Giải thích",
              explanation_en: "Explanation",
            },
          ],
        },
      ],
    });
    expect(report.canPublish).toBe(false);
    expect(report.questionCount).toBe(1);
    expect(report.errors.some((e) => e.includes("40 câu"))).toBe(true);

    const legacyApi = read("src/app/api/admin/route.ts");
    expect(legacyApi).toContain("actualQ < 40");
    const testsListUi = read("src/components/admin/tests-list-client.tsx");
    expect(testsListUi).toContain("under40Warning");
  });

  it("Fix #2: every public route has unique generateMetadata, default OG image exists, and custom OG image overrides default", () => {
    // 1. Default OG image file exists
    expect(fs.existsSync(path.join(ROOT, "public/og-default.png"))).toBe(true);

    // 2. RootLayout does NOT emit homepage openGraph/twitter that child routes could inherit
    const rootLayout = read("src/app/layout.tsx");
    expect(rootLayout).not.toContain("openGraph:");

    // 3. buildNextMetadata always sets canonical, og:title, og:description, og:url, summary_large_image, and OG image
    const fallbackMeta = buildNextMetadata({
      title: "Kho đề thi IELTS",
      description: "Luyện đề IELTS chuẩn máy tính.",
      pathname: "/tests",
    });
    expect(fallbackMeta.alternates?.canonical).toMatch(/\/tests$/);
    expect(fallbackMeta.openGraph?.title).toBe("Kho đề thi IELTS");
    expect(fallbackMeta.openGraph?.description).toBe("Luyện đề IELTS chuẩn máy tính.");
    expect(fallbackMeta.openGraph?.url).toMatch(/\/tests$/);
    expect((fallbackMeta.twitter as { card?: string } | undefined)?.card).toBe(
      "summary_large_image"
    );
    const fallbackImages = fallbackMeta.openGraph?.images;
    const firstFallbackUrl = Array.isArray(fallbackImages)
      ? typeof fallbackImages[0] === "object" && "url" in fallbackImages[0]
        ? String(fallbackImages[0].url)
        : String(fallbackImages[0])
      : "";
    expect(firstFallbackUrl).toContain(DEFAULT_FALLBACK_OG_IMAGE);

    // 4. Custom article/test OG image takes priority over default
    const customMeta = buildNextMetadata({
      title: "Mẹo làm Reading",
      description: "Chiến thuật đạt Band 8.0",
      pathname: "/blog/meo-reading",
      imageUrl: "https://cdn.onielts.vn/cover.jpg",
      seoMeta: { ogImage: "https://cdn.onielts.vn/custom-og.jpg" },
    });
    const customImages = customMeta.openGraph?.images;
    const firstCustomUrl = Array.isArray(customImages)
      ? typeof customImages[0] === "object" && "url" in customImages[0]
        ? String(customImages[0].url)
        : String(customImages[0])
      : "";
    expect(firstCustomUrl).toBe("https://cdn.onielts.vn/custom-og.jpg");

    // 5. Verify all public routes define generateMetadata via buildPublicPageMetadata
    const routesWithMetadata = [
      "src/app/page.tsx",
      "src/app/tests/page.tsx",
      "src/app/tests/[slug]/page.tsx",
      "src/app/blog/page.tsx",
      "src/app/blog/[slug]/page.tsx",
      "src/app/courses/page.tsx",
      "src/app/courses/[slug]/page.tsx",
      "src/app/pronunciation/page.tsx",
      "src/app/pronunciation/[slug]/page.tsx",
      "src/app/videos/page.tsx",
      "src/app/videos/[slug]/page.tsx",
      "src/app/tools/page.tsx",
      "src/app/tools/[slug]/page.tsx",
      "src/app/dictation/page.tsx",
      "src/app/conversations/page.tsx",
      "src/app/writing/page.tsx",
      "src/app/writing/exercises/page.tsx",
      "src/app/speaking/page.tsx",
      "src/app/daily-exam/page.tsx",
      "src/app/leaderboard/page.tsx",
      "src/app/band-calculator/page.tsx",
      "src/app/flashcards/page.tsx",
      "src/app/pricing/page.tsx",
      "src/app/about/page.tsx",
      "src/app/legal/[slug]/page.tsx",
      "src/app/referral/page.tsx",
      "src/app/sitemap-html/page.tsx",
      "src/app/profile/page.tsx",
      "src/app/progress/page.tsx",
      "src/app/writing/generator/layout.tsx",
      "src/app/speaking/generator/layout.tsx",
      "src/app/tools/text-to-speech/layout.tsx",
      "src/app/mentor/layout.tsx",
      "src/app/contact/layout.tsx",
      "src/app/feature-requests/layout.tsx",
      "src/app/auth/layout.tsx",
    ];
    for (const rel of routesWithMetadata) {
      const content = read(rel);
      expect(content, `${rel} must export generateMetadata`).toContain(
        "export async function generateMetadata"
      );
      expect(content, `${rel} must call buildPublicPageMetadata`).toContain(
        "buildPublicPageMetadata"
      );
    }
  });

  it("Fix #3: eliminates hardcoded counts in /tests, /tools, and home hero stats", () => {
    const testsPage = read("src/app/tests/page.tsx");
    expect(testsPage).not.toContain("12 bộ đề");
    expect(testsPage).toContain("computeTestCounts");

    const toolsPage = read("src/app/tools/page.tsx");
    expect(toolsPage).not.toContain("8 công cụ");
    expect(toolsPage).toContain("TOTAL_TOOLS_HUB_COUNT");

    const homePage = read("src/app/page.tsx");
    expect(homePage).toContain("getPlatformCounts");
    expect(homePage).toContain("maxObjectiveQuestionsPerTest");
  });

  it("Fix #4: footer social links reject generic homepages and read real values from General Settings", () => {
    expect(DEFAULT_SITE_GENERAL_SETTINGS.socialYoutube).toBe("");
    expect(DEFAULT_SITE_GENERAL_SETTINGS.socialFacebook).toBe("");
    expect(DEFAULT_SITE_GENERAL_SETTINGS.socialTiktok).toBe("");

    expect(isValidSocialProfileUrl("https://youtube.com")).toBe(false);
    expect(isValidSocialProfileUrl("https://www.youtube.com/")).toBe(false);
    expect(isValidSocialProfileUrl("https://facebook.com")).toBe(false);
    expect(isValidSocialProfileUrl("https://tiktok.com/")).toBe(false);
    expect(isValidSocialProfileUrl("")).toBe(false);
    expect(isValidSocialProfileUrl("javascript:alert(1)")).toBe(false);

    expect(isValidSocialProfileUrl("https://youtube.com/@onielts")).toBe(true);
    expect(isValidSocialProfileUrl("https://facebook.com/onielts.vn")).toBe(true);
    expect(isValidSocialProfileUrl("https://tiktok.com/@onielts")).toBe(true);
    expect(isValidSocialProfileUrl("https://zalo.me/0909123456")).toBe(true);

    const footer = read("src/components/site-footer.tsx");
    expect(footer).toContain("getSiteGeneralSettings");
    expect(footer).toContain("isValidSocialProfileUrl");
    expect(footer).toContain("mailto:");
  });

  it("Fix #5: /pricing countdown reads live admin ends_at, rejects invalid dates, and auto-hides when expired", () => {
    const now = Date.parse("2026-11-26T12:00:00.000Z");
    expect(
      isPromoBannerActiveNow(
        { is_active: true, ends_at: "2026-12-01T00:00:00.000Z" },
        now
      )
    ).toBe(true);
    expect(
      isPromoBannerActiveNow(
        { is_active: true, ends_at: "2026-11-26T11:59:59.000Z" },
        now
      )
    ).toBe(false);
    expect(
      isPromoBannerActiveNow({ is_active: true, ends_at: "not-a-date" }, now)
    ).toBe(false);
    expect(
      isPromoBannerActiveNow(
        { is_active: false, ends_at: "2027-01-01T00:00:00.000Z" },
        now
      )
    ).toBe(false);

    expect(
      promoBannerUpdateSchema.safeParse({
        title_vi: "Ưu đãi mùa thi giảm 20%",
        ends_at: "invalid-date-string",
        is_active: true,
      }).success
    ).toBe(false);

    const pricingPage = read("src/app/pricing/page.tsx");
    expect(pricingPage).toContain('export const dynamic = "force-dynamic"');
    expect(pricingPage).toContain("serverNowMs");
  });
});
