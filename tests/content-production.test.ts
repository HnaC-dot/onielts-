import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BLOG_TEMPLATES,
  buildSubscribersCsv,
  CONTENT_WORKFLOW_STEPS,
  contentCalendarItemSchema,
  CSV_IMPORT_TEMPLATE,
  DEFAULT_BLOG_QUALITY_CONFIG,
  escapeCsvCellSafe,
  evaluateBlogQualityGate,
  extractInternalLinks,
  extractTocAndInjectAnchors,
  getNextWorkflowStatus,
  JSON_IMPORT_TEMPLATE,
  newsletterSubscribeSchema,
  parseBulkTestCsv,
  parseBulkTestJson,
  rankInternalLinkSuggestions,
  type InternalLinkCandidate,
} from "../src/lib/content-production-shared";
import { renderBlogContentToSafeHtml } from "../src/lib/sanitize";

const ROOT = process.cwd();

describe("Content Production Toolkit — Migration 0007 & Schema Security", () => {
  it("defines RLS-protected tables content_calendar_items & newsletter_subscribers plus blog_posts.updated_at", () => {
    const sql = fs.readFileSync(
      path.join(ROOT, "supabase/migrations/0007_content_production.sql"),
      "utf-8"
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.content_calendar_items");
    expect(sql).toContain("ALTER TABLE public.content_calendar_items ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("'idea', 'writing', 'review', 'scheduled', 'published'");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.newsletter_subscribers");
    expect(sql).toContain("ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("public.is_staff()");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ");
  });

  it("enforces staff RBAC & CSRF verifySameOrigin across all admin content toolkit API routes", () => {
    const routes = [
      "src/app/api/admin/calendar/route.ts",
      "src/app/api/admin/content/config/route.ts",
      "src/app/api/admin/tests/import/route.ts",
      "src/app/api/admin/subscribers/route.ts",
    ];
    for (const rel of routes) {
      const code = fs.readFileSync(path.join(ROOT, rel), "utf-8");
      expect(code).toContain("requireStaff");
      expect(code).toContain("verifySameOrigin");
    }

    const newsletterApi = fs.readFileSync(
      path.join(ROOT, "src/app/api/newsletter/route.ts"),
      "utf-8"
    );
    expect(newsletterApi).toContain("checkRateLimit");
    expect(newsletterApi).toContain("verifySameOrigin");
  });
});

describe("1. Editorial Content Calendar Workflow", () => {
  it("supports all 5 workflow statuses in strict progression order", () => {
    expect(CONTENT_WORKFLOW_STEPS.map((s) => s.value)).toEqual([
      "idea",
      "writing",
      "review",
      "scheduled",
      "published",
    ]);
    expect(getNextWorkflowStatus("idea")).toBe("writing");
    expect(getNextWorkflowStatus("writing")).toBe("review");
    expect(getNextWorkflowStatus("review")).toBe("scheduled");
    expect(getNextWorkflowStatus("scheduled")).toBe("published");
    expect(getNextWorkflowStatus("published")).toBeNull();
  });

  it("validates calendar entries and rejects unsafe linked_href schemes", () => {
    const valid = contentCalendarItemSchema.safeParse({
      title: "Hướng dẫn IELTS Reading Matching Headings",
      content_type: "blog",
      workflow_status: "writing",
      assignee_name: "Minh Anh",
      planned_date: "2026-12-05",
      linked_href: "/admin/blog/new",
    });
    expect(valid.success).toBe(true);

    const badHref = contentCalendarItemSchema.safeParse({
      title: "Bad link test",
      content_type: "video",
      workflow_status: "idea",
      planned_date: "2026-12-05",
      linked_href: "javascript:alert(1)",
    });
    expect(badHref.success).toBe(false);
  });
});

describe("2. Blog Templates (4 structured templates)", () => {
  it("provides all 4 requested templates with headings, FAQ section, and Bài tập luyện thêm internal links", () => {
    expect(BLOG_TEMPLATES).toHaveLength(4);
    const names = BLOG_TEMPLATES.map((t) => t.nameVi);
    expect(names).toEqual([
      "Mẹo từng dạng câu hỏi",
      "Lộ trình theo band",
      "Từ vựng theo chủ đề",
      "Lỗi thường gặp",
    ]);

    for (const tpl of BLOG_TEMPLATES) {
      expect(tpl.contentHtml).toContain("<h2>");
      expect(tpl.contentHtml).toContain("FAQ");
      expect(tpl.contentHtml).toContain("Bài tập luyện thêm");
      const internalLinks = extractInternalLinks(tpl.contentHtml);
      expect(internalLinks.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("3. Internal Link Extraction & Auto-Suggestion Engine", () => {
  const sampleCatalog: InternalLinkCandidate[] = [
    {
      id: "t1",
      kind: "test",
      title: "IELTS Reading Test 1 — True False Not Given",
      href: "/tests/reading-test-1",
      subtitle: "Reading 40 câu",
      keywords: ["reading", "true false not given", "tfng"],
    },
    {
      id: "c1",
      kind: "course",
      title: "Khóa học Reading Band 7.5+",
      href: "/courses/reading-75",
      subtitle: "Khóa học Reading",
      keywords: ["reading", "lo trinh", "khoa hoc"],
    },
    {
      id: "tool1",
      kind: "tool",
      title: "Chấm bài Writing AI",
      href: "/writing",
      subtitle: "Writing AI",
      keywords: ["writing", "essay", "task 2"],
    },
  ];

  it("extracts internal links and flags zero-link articles", () => {
    const htmlWithLinks =
      '<p>Luyện <a href="/tests/reading-test-1">đề này</a> và <a href="https://onielts.vn/writing">chấm Writing</a>, xem <a href="https://example.org/ext">ngoài</a>.</p>';
    const links = extractInternalLinks(htmlWithLinks);
    expect(links).toEqual(["/tests/reading-test-1", "/writing"]);
    expect(extractInternalLinks("<p>Bài viết chưa gắn link nào.</p>")).toEqual([]);
  });

  it("ranks contextually matching internal links first and marks already-linked targets", () => {
    const ranked = rankInternalLinkSuggestions(
      {
        title: "Mẹo làm True False Not Given IELTS Reading",
        category: "Reading",
        tags: ["reading", "tfng"],
        contentHtml: '<p>Xem <a href="/courses/reading-75">khóa học</a></p>',
      },
      sampleCatalog
    );
    expect(ranked[0].id).toBe("t1");
    expect(ranked.find((r) => r.id === "c1")?.alreadyLinked).toBe(true);
  });
});

describe("4. Pre-Publish Quality Gate (configurable min words, default 800)", () => {
  it("fails incomplete posts and warns when 0 internal links exist", () => {
    const report = evaluateBlogQualityGate({
      title: "Ngắn",
      excerpt: "Quá ngắn",
      contentHtml: "<p>Đây là đoạn nội dung rất ngắn chưa có link nội bộ.</p>",
      coverImageUrl: "",
      seoMeta: {},
    });
    expect(DEFAULT_BLOG_QUALITY_CONFIG.minWordCount).toBe(800);
    expect(report.passed).toBe(false);
    expect(report.hasZeroInternalLinks).toBe(true);
    expect(report.score).toBe(0);
  });

  it("passes when all 5 criteria are satisfied and respects custom minWordCount config", () => {
    const longWords = Array.from({ length: 320 }, (_, i) => `ieltsword${i}`).join(" ");
    const html = `<h2>Mẹo làm bài Reading</h2><p>${longWords}</p><p><a href="/tests">Đề thi</a> và <a href="/courses">Khóa học</a></p>`;

    const strictReport = evaluateBlogQualityGate({
      title: "Chiến thuật IELTS Reading toàn diện đạt Band 8.0",
      excerpt:
        "Hướng dẫn chi tiết chiến thuật làm bài IELTS Reading cho người tự học giúp tăng band nhanh chóng và tránh bẫy paraphrase.",
      contentHtml: html,
      coverImageUrl: "/og-default.png",
      seoMeta: {
        coverImageAlt: "Minh họa chiến thuật IELTS Reading",
        primaryKeyword: "ielts reading",
      },
    });
    expect(strictReport.passed).toBe(false);
    expect(strictReport.checks.find((c) => c.id === "min_words")?.passed).toBe(false);

    const customReport = evaluateBlogQualityGate(
      {
        title: "Chiến thuật IELTS Reading toàn diện đạt Band 8.0",
        excerpt:
          "Hướng dẫn chi tiết chiến thuật làm bài IELTS Reading cho người tự học giúp tăng band nhanh chóng và tránh bẫy paraphrase.",
        contentHtml: html,
        coverImageUrl: "/og-default.png",
        seoMeta: {
          coverImageAlt: "Minh họa chiến thuật IELTS Reading",
          primaryKeyword: "ielts reading",
        },
      },
      { minWordCount: 300, minInternalLinks: 2 }
    );
    expect(customReport.passed).toBe(true);
    expect(customReport.score).toBe(5);
  });
});

describe("5. Auto Table of Contents & Post-Sanitization Anchor Injection", () => {
  it("extracts H2/H3 items and injects unique deterministic id anchors safely", () => {
    const raw = `
      <h2>1. Chiến thuật Đọc hiểu</h2>
      <p>Nội dung...</p>
      <h3>Bước 1: Đọc câu hỏi</h3>
      <h2>1. Chiến thuật Đọc hiểu</h2>
      <script>alert('xss')</script>
    `;
    const safeHtml = renderBlogContentToSafeHtml(raw);
    const { htmlWithAnchors, items } = extractTocAndInjectAnchors(safeHtml);

    expect(htmlWithAnchors).not.toContain("<script");
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      id: "muc-1-chien-thuat-doc-hieu",
      level: 2,
      text: "1. Chiến thuật Đọc hiểu",
    });
    expect(items[1].level).toBe(3);
    expect(items[2].id).toBe("muc-1-chien-thuat-doc-hieu-2");
    expect(htmlWithAnchors).toContain('id="muc-1-chien-thuat-doc-hieu"');
    expect(htmlWithAnchors).toContain('id="muc-1-chien-thuat-doc-hieu-2"');
  });
});

describe("6. Bulk Test Import (CSV & JSON) — Row Validation & Draft Enforcement", () => {
  it("parses built-in CSV template cleanly and enforces is_published = false (Draft)", () => {
    const res = parseBulkTestCsv(CSV_IMPORT_TEMPLATE);
    expect(res.errors).toEqual([]);
    expect(res.tests).toHaveLength(1);
    expect(res.tests[0].slug).toBe("reading-urban-vertical-farming");
    expect(res.tests[0].is_published).toBe(false);
    expect(res.tests[0].sections[0].questions).toHaveLength(3);
    expect(res.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("reports row-level errors in CSV before import", () => {
    const brokenCsv = [
      "test_slug,test_title_vi,skill,section_title,question_number,question_type,prompt,options,correct_answers",
      "ab,Ngắn,invalid_skill,,99,bad_type,,,",
    ].join("\n");
    const res = parseBulkTestCsv(brokenCsv);
    expect(res.tests).toHaveLength(0);
    expect(res.errors.length).toBeGreaterThanOrEqual(5);
    expect(res.errors.every((e) => e.row === 2)).toBe(true);
  });

  it("parses built-in JSON template cleanly and overrides is_published: true back to Draft (false)", () => {
    const tampered = JSON.parse(JSON_IMPORT_TEMPLATE);
    tampered[0].is_published = true;
    const res = parseBulkTestJson(JSON.stringify(tampered));
    expect(res.errors).toEqual([]);
    expect(res.tests).toHaveLength(1);
    expect(res.tests[0].is_published).toBe(false);
    expect(res.tests[0].sections[0].questions).toHaveLength(2);
  });
});

describe("7. Newsletter Validation & Safe CSV Export", () => {
  it("validates and lowercases email addresses", () => {
    const ok = newsletterSubscribeSchema.safeParse({
      email: "  HocVien.IELTS@Example.COM ",
      source_slug: "lo-trinh-tu-hoc-ielts",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.email).toBe("hocvien.ielts@example.com");
    }

    const bad = newsletterSubscribeSchema.safeParse({ email: "not-an-email" });
    expect(bad.success).toBe(false);
  });

  it("guards against spreadsheet CSV formula injection and prepends UTF-8 BOM", () => {
    expect(escapeCsvCellSafe("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(escapeCsvCellSafe("+123456")).toBe("'+123456");

    const csv = buildSubscribersCsv([
      {
        id: "1",
        email: "learner@onielts.vn",
        source_slug: "=HYPERLINK(\"http://evil\")",
        locale: "vi",
        status: "active",
        subscribed_at: "2026-11-27T08:00:00.000Z",
      },
    ]);
    expect(csv.startsWith("\uFEFFemail,source_slug,locale,status,subscribed_at")).toBe(true);
    expect(csv).toContain("learner@onielts.vn");
    expect(csv).toContain("\"'=HYPERLINK(");
  });
});
