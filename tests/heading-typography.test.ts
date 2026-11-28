import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPEARANCE_CONFIG,
  DEFAULT_HOME_SECTIONS,
  DEFAULT_THEME_CONFIG,
  buildThemeCssVariables,
  mergeAppearanceWithDefaults,
  siteAppearanceSchema,
} from "@/lib/appearance-shared";
import {
  APPEARANCE_FONTS,
  DEFAULT_HEADING_TYPOGRAPHY,
  HEADING_AREA_IDS,
  HEADING_CLAMP_SCALES,
  auditHeadingStructure,
  buildCombinedGoogleFontsHref,
  buildHeadingTypographyCssVariables,
  computeContrastRatio,
  contentTitleSizeSchema,
  convertBodyH1ToH2,
  evaluateHeadingContrast,
  headingTypographySchema,
  isAreaHeadingDefault,
  isHeadingTypographyDefault,
  mergeHeadingTypographyWithDefaults,
  type HeadingAreaId,
  type HeadingSizePreset,
} from "@/lib/heading-typography";
import { blogPostFormSchema } from "@/lib/blog-shared";
import { seoMetaSchema } from "@/lib/seo";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { splitPassageParagraphs } from "@/lib/test-groups";
import { validateTestForPublish } from "@/lib/test-cms-shared";
import type { TestSection } from "@/lib/types";

const ROOT = process.cwd();
function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

describe("1. Default Parity — Untouched Pages Do Not Visually Change", () => {
  it("validates DEFAULT_HEADING_TYPOGRAPHY and DEFAULT_APPEARANCE_CONFIG cleanly", () => {
    expect(headingTypographySchema.safeParse(DEFAULT_HEADING_TYPOGRAPHY).success).toBe(true);
    expect(siteAppearanceSchema.safeParse(DEFAULT_APPEARANCE_CONFIG).success).toBe(true);
    expect(isHeadingTypographyDefault(DEFAULT_HEADING_TYPOGRAPHY)).toBe(true);

    for (const areaId of HEADING_AREA_IDS) {
      expect(isAreaHeadingDefault(areaId, DEFAULT_HEADING_TYPOGRAPHY[areaId])).toBe(true);
    }
  });

  it("merges legacy appearance JSON without headingTypography or section titleSize additively into exact baseline defaults", () => {
    const legacyHero = { ...DEFAULT_HOME_SECTIONS[0] };
    delete legacyHero.titleSize;
    const legacyPayload = {
      homepage: {
        sections: [legacyHero],
      },
      theme: DEFAULT_THEME_CONFIG,
    };

    const merged = mergeAppearanceWithDefaults(legacyPayload);
    expect(isHeadingTypographyDefault(merged.headingTypography)).toBe(true);
    const hero = merged.homepage.sections.find((s) => s.id === "hero");
    expect(hero?.titleSize ?? "").toBe("");
  });

  it("emits exact baseline desktop typography and responsive clamp() sizes when untouched", () => {
    const css = buildThemeCssVariables(DEFAULT_THEME_CONFIG, DEFAULT_HEADING_TYPOGRAPHY);

    // Every single area matches Ôn IELTS's existing desktop scale & 700 weight & inherited font
    expect(css).toContain("--ht-home-font: var(--cms-font-sans);");
    expect(css).toContain("--ht-home-weight: 700;");
    expect(css).toContain("--ht-home-h1: clamp(1.875rem, 4.5vw, 3rem);");
    expect(css).toContain("--ht-home-h2: clamp(1.375rem, 3vw, 1.5rem);");
    expect(css).toContain("--ht-home-h3: clamp(0.95rem, 1.6vw, 1rem);");

    expect(css).toContain("--ht-blog-h1: clamp(1.625rem, 3.8vw, 1.875rem);");
    expect(css).toContain("--ht-blog-h2: clamp(1.125rem, 2.4vw, 1.25rem);");
    expect(css).toContain("--ht-blog-h3: clamp(1rem, 1.9vw, 1.075rem);");

    expect(css).toContain("--ht-tests-h1: clamp(1.625rem, 3.8vw, 1.875rem);");
    expect(css).toContain("--ht-tests-exam-h1: clamp(0.875rem, 1.5vw, 1rem);");
    expect(css).toContain("--ht-tests-h2: clamp(1.05rem, 2vw, 1.125rem);");
    expect(css).toContain("--ht-tests-h3: clamp(1.125rem, 2.2vw, 1.25rem);");
    expect(css).toContain("--ht-tests-passage-title-align: left;");

    expect(css).toContain("--ht-courses-h1: clamp(1.625rem, 3.8vw, 1.875rem);");
    expect(css).toContain("--ht-courses-h2: clamp(1.125rem, 2.4vw, 1.25rem);");
    expect(css).toContain("--ht-courses-h3: clamp(1rem, 1.9vw, 1.075rem);");

    expect(css).toContain("--ht-pages-h1: clamp(1.625rem, 3.8vw, 1.875rem);");
    expect(css).toContain("--ht-pages-h2: clamp(1.125rem, 2.4vw, 1.25rem);");
    expect(css).toContain("--ht-pages-h3: clamp(1rem, 1.9vw, 1.075rem);");

    // Zero extra Google Fonts request when untouched
    expect(
      buildCombinedGoogleFontsHref("Be Vietnam Pro", DEFAULT_HEADING_TYPOGRAPHY)
    ).toBeNull();
  });

  it("uses responsive clamp(min, fluid, max) with strictly ascending sizes across sm < md < lg < xl so mobile never overflows", () => {
    const parseClampBounds = (expr: string) => {
      const m = expr.match(
        /^clamp\(\s*([\d.]+)rem\s*,\s*[\d.]+vw\s*,\s*([\d.]+)rem\s*\)$/
      );
      expect(m, `Expected valid clamp() expression, got: ${expr}`).not.toBeNull();
      const min = Number.parseFloat(m![1]);
      const max = Number.parseFloat(m![2]);
      expect(min).toBeLessThanOrEqual(max);
      // Mobile minimum should never be oversized (> 2.2rem)
      expect(min).toBeLessThanOrEqual(2.2);
      return { min, max };
    };

    const order: HeadingSizePreset[] = ["sm", "md", "lg", "xl"];
    for (const areaId of HEADING_AREA_IDS) {
      const scales = HEADING_CLAMP_SCALES[areaId];
      for (const level of ["h1", "h2", "h3"] as const) {
        let prevMax = 0;
        for (const preset of order) {
          const { max } = parseClampBounds(scales[level][preset]);
          expect(max).toBeGreaterThan(prevMax);
          prevMax = max;
        }
      }
      if (scales.examBarH1) {
        let prevMax = 0;
        for (const preset of order) {
          const { max } = parseClampBounds(scales.examBarH1[preset]);
          expect(max).toBeGreaterThan(prevMax);
          prevMax = max;
        }
      }
    }
  });
});

describe("2. Per-Area Updates & Isolation Across All 5 Areas", () => {
  it("updates only the targeted area's CSS variables while leaving the other 4 areas untouched", () => {
    const cases: Array<{
      area: HeadingAreaId;
      font: (typeof APPEARANCE_FONTS)[number]["id"];
      weight: "medium" | "bold" | "extrabold";
      expectedWeight: string;
      h1Size: HeadingSizePreset;
      h2Size: HeadingSizePreset;
      h3Size: HeadingSizePreset;
      lineHeight: "tight" | "normal" | "relaxed";
    }> = [
      {
        area: "home",
        font: "Plus Jakarta Sans",
        weight: "extrabold",
        expectedWeight: "800",
        h1Size: "xl",
        h2Size: "lg",
        h3Size: "sm",
        lineHeight: "tight",
      },
      {
        area: "blog",
        font: "Merriweather",
        weight: "medium",
        expectedWeight: "600",
        h1Size: "lg",
        h2Size: "xl",
        h3Size: "lg",
        lineHeight: "relaxed",
      },
      {
        area: "tests",
        font: "Manrope",
        weight: "extrabold",
        expectedWeight: "800",
        h1Size: "sm",
        h2Size: "lg",
        h3Size: "xl",
        lineHeight: "normal",
      },
      {
        area: "courses",
        font: "Lexend",
        weight: "medium",
        expectedWeight: "600",
        h1Size: "xl",
        h2Size: "sm",
        h3Size: "lg",
        lineHeight: "relaxed",
      },
      {
        area: "pages",
        font: "Inter",
        weight: "extrabold",
        expectedWeight: "800",
        h1Size: "lg",
        h2Size: "lg",
        h3Size: "sm",
        lineHeight: "tight",
      },
    ];

    for (const c of cases) {
      const cfg = mergeHeadingTypographyWithDefaults({
        [c.area]: {
          fontFamily: c.font,
          weight: c.weight,
          h1Size: c.h1Size,
          h2Size: c.h2Size,
          h3Size: c.h3Size,
          lineHeight: c.lineHeight,
          ...(c.area === "tests" ? { passageTitleAlign: "center" as const } : {}),
        },
      });

      expect(isHeadingTypographyDefault(cfg)).toBe(false);
      expect(isAreaHeadingDefault(c.area, cfg[c.area])).toBe(false);

      const css = buildHeadingTypographyCssVariables(cfg);
      const fontMeta = APPEARANCE_FONTS.find((f) => f.id === c.font)!;

      expect(css).toContain(`--ht-${c.area}-font: ${fontMeta.cssFamily};`);
      expect(css).toContain(`--ht-${c.area}-weight: ${c.expectedWeight};`);
      expect(css).toContain(`--ht-${c.area}-h1: ${HEADING_CLAMP_SCALES[c.area].h1[c.h1Size]};`);
      expect(css).toContain(`--ht-${c.area}-h2: ${HEADING_CLAMP_SCALES[c.area].h2[c.h2Size]};`);
      expect(css).toContain(`--ht-${c.area}-h3: ${HEADING_CLAMP_SCALES[c.area].h3[c.h3Size]};`);

      if (c.area === "tests") {
        expect(css).toContain("--ht-tests-passage-title-align: center;");
      }

      // All other areas stay at exact default values
      for (const other of HEADING_AREA_IDS) {
        if (other === c.area) continue;
        expect(isAreaHeadingDefault(other, cfg[other])).toBe(true);
        expect(css).toContain(`--ht-${other}-font: var(--cms-font-sans);`);
        expect(css).toContain(`--ht-${other}-weight: 700;`);
        expect(css).toContain(`--ht-${other}-h1: ${HEADING_CLAMP_SCALES[other].h1.md};`);
      }
    }
  });

  it("deduplicates Google Fonts cleanly across global theme + 5 heading areas", () => {
    const cfg = mergeHeadingTypographyWithDefaults({
      home: { fontFamily: "Plus Jakarta Sans" },
      blog: { fontFamily: "Merriweather" },
      tests: { fontFamily: "Merriweather" }, // duplicate should be deduped
      courses: { fontFamily: "inherit" },
      pages: { fontFamily: "Be Vietnam Pro" }, // bundled via next/font, no external query
    });

    const href = buildCombinedGoogleFontsHref("Inter", cfg);
    expect(href).not.toBeNull();
    expect(href).toContain("https://fonts.googleapis.com/css2?");
    expect(href).toContain("Inter");
    expect(href).toContain("Plus+Jakarta+Sans");
    expect(href).toContain("Merriweather");
    // Merriweather must only appear once
    expect(href!.match(/Merriweather/g)?.length).toBe(1);
    expect(href).not.toContain("Be+Vietnam");
  });
});

describe("3. Per-Content Title Size Override & Plain-Text Title Integrity", () => {
  it("validates Blog post title_size (default empty, lg, xl) and rejects invalid values", () => {
    expect(contentTitleSizeSchema.parse(undefined)).toBe("");
    expect(contentTitleSizeSchema.parse("")).toBe("");
    expect(contentTitleSizeSchema.parse("lg")).toBe("lg");
    expect(contentTitleSizeSchema.parse("xl")).toBe("xl");
    expect(contentTitleSizeSchema.safeParse("xxl").success).toBe(false);

    const basePost = {
      slug: "lo-trinh-tu-hoc-ielts",
      title_vi: "Lộ trình tự học IELTS từ 5.0 lên 7.5",
      excerpt_vi: "Hướng dẫn lộ trình tự học IELTS thực chiến từ nền tảng 5.0 đến 7.5.",
      category: "Reading",
      content_vi: "<h2>Giai đoạn 1</h2><p>Nội dung hướng dẫn chi tiết dành cho người mới bắt đầu ôn thi IELTS hiệu quả mỗi ngày.</p>",
    };

    const defaultParsed = blogPostFormSchema.parse(basePost);
    expect(defaultParsed.title_size).toBe("");

    const xlParsed = blogPostFormSchema.parse({ ...basePost, title_size: "xl" });
    expect(xlParsed.title_size).toBe("xl");

    const invalidParsed = blogPostFormSchema.safeParse({
      ...basePost,
      title_size: "huge",
    });
    expect(invalidParsed.success).toBe(false);

    // seoMetaSchema also carries optional titleSize cleanly
    expect(seoMetaSchema.parse({ titleSize: "lg" }).titleSize).toBe("lg");
  });

  it("validates Homepage section titleSize override and strips HTML tags from plain-text titles", () => {
    const cfg = structuredClone(DEFAULT_APPEARANCE_CONFIG);
    cfg.homepage.sections[0].titleVi = "<b>Ôn IELTS</b> Chuẩn Máy Tính";
    cfg.homepage.sections[0].titleSize = "xl";
    cfg.homepage.sections[2].titleSize = "lg";

    const parsed = siteAppearanceSchema.safeParse(cfg);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Plain-text title invariant preserved (HTML stripped)
      expect(parsed.data.homepage.sections[0].titleVi).toBe("Ôn IELTS Chuẩn Máy Tính");
      expect(parsed.data.homepage.sections[0].titleSize).toBe("xl");
      expect(parsed.data.homepage.sections[2].titleSize).toBe("lg");
      // Untouched section stays "" (inherit)
      expect(parsed.data.homepage.sections[1].titleSize).toBe("");
    }
  });
});

describe("4. WCAG Contrast & Dark-Mode Checker", () => {
  it("passes WCAG AA & AAA on default Light and Dark mode backgrounds", () => {
    const audit = evaluateHeadingContrast({
      backgroundLight: DEFAULT_THEME_CONFIG.backgroundLight,
      backgroundDark: DEFAULT_THEME_CONFIG.backgroundDark,
    });
    expect(audit.allPassAA).toBe(true);
    expect(audit.checks).toHaveLength(4);
    for (const check of audit.checks) {
      expect(check.passesAA).toBe(true);
      expect(check.passesAAA).toBe(true);
      expect(check.ratio).toBeGreaterThanOrEqual(12);
    }
  });

  it("detects low contrast when Light or Dark background clashes with heading foreground", () => {
    expect(computeContrastRatio("#0f172a", "#1e293b")).toBeLessThan(3);
    const badLight = evaluateHeadingContrast({
      backgroundLight: "#1e293b",
      backgroundDark: "#0b1120",
    });
    expect(badLight.allPassAA).toBe(false);
    expect(badLight.checks[0].passesAA).toBe(false);

    const badDark = evaluateHeadingContrast({
      backgroundLight: "#f8fafc",
      backgroundDark: "#e2e8f0",
    });
    expect(badDark.allPassAA).toBe(false);
    expect(badDark.checks[2].passesAA).toBe(false);
  });
});

describe("5. SEO & Accessibility Heading Audit, Reading Passage Title & HTML Sanitization", () => {
  it("passes clean H2 -> H3 -> H2 structure with zero warnings", () => {
    const html = "<h2>Phần 1</h2><p>Đoạn văn</p><h3>Mục 1.1</h3><p>Chi tiết</p><h2>Phần 2</h2>";
    const report = auditHeadingStructure(html);
    expect(report.hasWarnings).toBe(false);
    expect(report.hasH1InBody).toBe(false);
    expect(report.skippedLevels).toHaveLength(0);
    expect(report.headingsFound).toHaveLength(3);
  });

  it("warns on H1 inside body content and fixes automatically via convertBodyH1ToH2", () => {
    const html = "<h1>Tiêu đề trùng H1</h1><p>Đoạn mở đầu</p><h2>Mục 2</h2>";
    const report = auditHeadingStructure(html);
    expect(report.hasWarnings).toBe(true);
    expect(report.hasH1InBody).toBe(true);
    expect(report.h1Count).toBe(1);
    expect(report.warnings.some((w) => w.includes("H1"))).toBe(true);

    const fixed = convertBodyH1ToH2(html);
    expect(fixed).not.toContain("<h1");
    expect(auditHeadingStructure(fixed).hasWarnings).toBe(false);
  });

  it("warns on skipped heading levels (H2 -> H4 and page H1 -> H3)", () => {
    const skipH2ToH4 = auditHeadingStructure("<h2>Mục lớn</h2><h4>Nhảy cấp xuống H4</h4>");
    expect(skipH2ToH4.hasWarnings).toBe(true);
    expect(skipH2ToH4.skippedLevels).toEqual([
      { from: 2, to: 4, headingText: "Nhảy cấp xuống H4" },
    ]);

    const skipH1ToH3 = auditHeadingStructure("<h3>Bắt đầu bằng H3 trong bài blog</h3>");
    expect(skipH1ToH3.hasWarnings).toBe(true);
    expect(skipH1ToH3.skippedLevels[0]).toMatchObject({ from: 1, to: 3 });
  });

  it("allows Reading passages starting at <h3 class='reading-passage-title'> while flagging H1 or H3 -> H5 skips", () => {
    const validPassage =
      '<h3 class="reading-passage-title">The Architecture of Urban Wind Corridors</h3><p>Paragraph A. Modern cities...</p>';
    const cleanAudit = auditHeadingStructure(validPassage, {
      allowPassageStartAtH3: true,
    });
    expect(cleanAudit.hasWarnings).toBe(false);

    const badPassage =
      '<h1>Wrong H1 in Passage</h1><p>Text</p><h3>Sub</h3><h5>Skipped to H5</h5>';
    const badAudit = auditHeadingStructure(badPassage, {
      allowPassageStartAtH3: true,
    });
    expect(badAudit.hasWarnings).toBe(true);
    expect(badAudit.hasH1InBody).toBe(true);
    expect(badAudit.skippedLevels.some((s) => s.from === 3 && s.to === 5)).toBe(true);

    // validateTestForPublish surfaces Reading passage heading warnings cleanly
    const mockSection: TestSection = {
      id: "sec-1",
      title: "Passage 1",
      passage: `${badPassage} ${"Long reading text content. ".repeat(10)}`,
      questions: [],
    };
    const pubReport = validateTestForPublish({
      skill: "reading",
      sections: [mockSection],
    });
    expect(pubReport.warnings.some((w) => w.includes("H1"))).toBe(true);
    expect(pubReport.warnings.some((w) => w.includes("H3") && w.includes("H5"))).toBe(true);
  });

  it("preserves .reading-passage-title through sanitizeRichHtml and splitPassageParagraphs without affecting plain-text passages", () => {
    // Plain-text backward compatibility (all 54 golden tests)
    const plain = "A First paragraph text.\n\nB Second paragraph text.";
    const plainBlocks = splitPassageParagraphs(plain);
    expect(plainBlocks).toEqual([
      { index: 0, label: "A", text: "A First paragraph text." },
      { index: 1, label: "B", text: "B Second paragraph text." },
    ]);

    // Rich-Text HTML passage with reading-passage-title + XSS script stripped
    const rawHtml =
      '<h3 class="reading-passage-title" onclick="alert(1)">Coastal Salt Marshes</h3><script>evil()</script><p>A Salt marshes act as natural sponges.</p><p>B Researchers measured carbon storage.</p>';
    const sanitized = sanitizeRichHtml(rawHtml);
    expect(sanitized).toContain('class="reading-passage-title"');
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("<script>");

    const parsed = splitPassageParagraphs(sanitized);
    expect(parsed).toEqual([
      {
        index: 0,
        label: undefined,
        text: "Coastal Salt Marshes",
        kind: "passage-title",
      },
      {
        index: 1,
        label: "A",
        text: "A Salt marshes act as natural sponges.",
        kind: "paragraph",
      },
      {
        index: 2,
        label: "B",
        text: "B Researchers measured carbon storage.",
        kind: "paragraph",
      },
    ]);
  });
});

describe("6. End-to-End Wiring & Additive DB Safety", () => {
  it("shares heading-typography.css between public site and RichTextEditor and layers fallback :root defaults cleanly", () => {
    const globalsCss = readProjectFile("src/app/globals.css");
    expect(globalsCss).toContain('@import "./heading-typography.css";');

    const htCss = readProjectFile("src/app/heading-typography.css");
    expect(htCss).toContain("@layer base");
    expect(htCss).toContain(".reading-passage-title");
    expect(htCss).toContain('.cms-richtext[data-heading-scope="courses"] h2');
    expect(htCss).toContain('.cms-richtext[data-heading-scope="pages"] h2');
    expect(htCss).toContain('.cms-richtext[data-heading-scope="tests"] h2');

    const layoutTsx = readProjectFile("src/app/layout.tsx");
    expect(layoutTsx).toContain("buildCombinedGoogleFontsHref");
    expect(layoutTsx).toContain("appearance.headingTypography");
  });

  it("wires all 5 public areas with .ht-* classes, per-content data-title-size, and data-heading-scope", () => {
    const homePage = readProjectFile("src/app/page.tsx");
    expect(homePage).toContain("ht-home-h1");
    expect(homePage).toContain("ht-home-h2");
    expect(homePage).toContain("ht-home-h3");
    expect(homePage).toContain("data-title-size={sec.titleSize || undefined}");
    expect(homePage).toContain("titleSize={sec.titleSize}");

    const carousel = readProjectFile("src/components/horizontal-carousel.tsx");
    expect(carousel).toContain("ht-home-h2");
    expect(carousel).toContain("data-title-size={titleSize || undefined}");

    const blogIndex = readProjectFile("src/app/blog/page.tsx");
    expect(blogIndex).toContain("ht-blog-h1");

    const blogDetail = readProjectFile("src/app/blog/[slug]/page.tsx");
    expect(blogDetail).toContain("ht-blog-h1");
    expect(blogDetail).toContain("data-title-size=");
    expect(blogDetail).toContain('data-heading-scope="blog"');

    const testsIndex = readProjectFile("src/app/tests/page.tsx");
    expect(testsIndex).toContain("ht-tests-h1");
    const testDetail = readProjectFile("src/app/tests/[slug]/page.tsx");
    expect(testDetail).toContain("ht-tests-h1");
    expect(testDetail).toContain("ht-tests-h2");
    const testEngine = readProjectFile("src/components/test-engine-client.tsx");
    expect(testEngine).toContain("ht-tests-exam-h1");
    expect(testEngine).toContain("ht-tests-h2");
    const passageComp = readProjectFile("src/components/exam/annotatable-passage.tsx");
    expect(passageComp).toContain("reading-passage-title");

    const coursesIndex = readProjectFile("src/app/courses/page.tsx");
    expect(coursesIndex).toContain("ht-courses-h1");
    const courseDetail = readProjectFile("src/app/courses/[slug]/page.tsx");
    expect(courseDetail).toContain("ht-courses-h1");
    const coursePlayer = readProjectFile("src/components/course-player-client.tsx");
    expect(coursePlayer).toContain("ht-courses-h2");
    expect(coursePlayer).toContain('data-heading-scope="courses"');

    const legalPage = readProjectFile("src/app/legal/[slug]/page.tsx");
    expect(legalPage).toContain("ht-pages-h1");
    expect(legalPage).toContain("ht-pages-h2");
    expect(legalPage).toContain('data-heading-scope="pages"');

    const aboutPage = readProjectFile("src/app/about/page.tsx");
    expect(aboutPage).toContain("ht-pages-h1");
    expect(aboutPage).toContain("ht-pages-h2");
    expect(aboutPage).toContain('data-heading-scope="pages"');
  });

  it("wires Admin Heading Typography tab, RichTextEditor presets, and keeps title inputs as plain text", () => {
    const appearanceClient = readProjectFile("src/components/admin/appearance-cms-client.tsx");
    expect(appearanceClient).toContain("Kiểu chữ tiêu đề");
    expect(appearanceClient).toContain("AppearanceHeadingTypography");
    expect(appearanceClient).toContain("Cỡ tiêu đề khối");

    const blogEditor = readProjectFile("src/components/admin/blog-editor-client.tsx");
    expect(blogEditor).toContain('preset="blog"');
    expect(blogEditor).toContain("Cỡ tiêu đề bài viết");
    expect(blogEditor).toContain("auditHeadingStructure");

    const pagesEditor = readProjectFile("src/components/admin/pages-cms-client.tsx");
    expect(pagesEditor).toContain('preset="static-page"');
    expect(pagesEditor).toContain("auditHeadingStructure");

    const coursesEditor = readProjectFile("src/components/admin/courses-cms-client.tsx");
    expect(coursesEditor).toContain('preset="course"');
    expect(coursesEditor).toContain("auditHeadingStructure");

    const testBuilder = readProjectFile("src/components/admin/test-builder-client.tsx");
    expect(testBuilder).toContain('preset="reading-passage"');
    expect(testBuilder).toContain("auditHeadingStructure");

    const richEditor = readProjectFile("src/components/admin/rich-text-editor.tsx");
    expect(richEditor).toContain("Tiêu đề bài đọc");
    expect(richEditor).toContain("reading-passage-title");
    expect(richEditor).toContain("data-heading-scope={headingScope}");
  });

  it("keeps migration 0011_blog_title_size.sql strictly additive (no destructive SQL)", () => {
    const sql = readProjectFile("supabase/migrations/0011_blog_title_size.sql");
    expect(sql).toMatch(/ALTER TABLE\s+public\.blog_posts/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+title_size/i);
    expect(sql).not.toMatch(/\b(DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE)\b/i);
  });
});
