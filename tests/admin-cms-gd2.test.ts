import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  extractYoutubeVideoId,
  renderBlogContentToSafeHtml,
  sanitizeRichHtml,
  sanitizeSvg,
} from "@/lib/sanitize";
import {
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildNextMetadata,
  evaluateSeoChecklist,
  slugifyVi,
} from "@/lib/seo";
import {
  blogPostFormSchema,
  isBlogPostPubliclyVisible,
} from "@/lib/blog-shared";
import { verifyMediaMagicBytes } from "@/lib/cms-media";

describe("Admin CMS GĐ2 — XSS Sanitizer, SEO Engine, Media Validation & Blog Schema", () => {
  it("strips XSS vectors while preserving rich text tables, links, images, and YouTube embeds", () => {
    const hostile = `
      <h2>IELTS Reading Guide</h2>
      <p>Hello <strong>world</strong>!</p>
      <script>alert('xss')</script>
      <img src="https://cdn.example.com/a.webp" alt="Reading chart" onerror="alert(1)" />
      <a href="javascript:alert(2)">Bad link</a>
      <a href="&#x6a;avascript:alert(3)">Obfuscated link</a>
      <a href="https://ielts.org" target="_blank">Official IELTS</a>
      <iframe src="https://evil.example/phish"></iframe>
      <iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></iframe>
      <table><thead><tr><th>Band</th><th>Score</th></tr></thead><tbody><tr><td>8.0</td><td>35-36</td></tr></tbody></table>
    `;

    const clean = sanitizeRichHtml(hostile);
    expect(clean).toContain("<h2>IELTS Reading Guide</h2>");
    expect(clean).toContain("<strong>world</strong>");
    expect(clean).toContain('src="https://cdn.example.com/a.webp"');
    expect(clean).toContain('alt="Reading chart"');
    expect(clean).toContain('href="https://ielts.org"');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(clean).toContain("<table>");

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("alert(");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("evil.example");
  });

  it("extracts valid YouTube video IDs across standard URL formats", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=12")).toBe(
      "dQw4w9WgXcQ"
    );
    expect(extractYoutubeVideoId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
    expect(extractYoutubeVideoId("https://evil.example/embed/dQw4w9WgXcQ")).toBeNull();
  });

  it("converts legacy ### Markdown blog posts cleanly into safe HTML", () => {
    const legacy = "### Bước 1: Đọc tiêu đề\n\nĐọc kỹ câu hỏi trước khi tìm đoạn văn.\n\n### Bước 2: So sánh từ đồng nghĩa\n\nChú ý paraphrase.";
    const html = renderBlogContentToSafeHtml(legacy);
    expect(html).toContain("<h2>Bước 1: Đọc tiêu đề</h2>");
    expect(html).toContain("<p>Đọc kỹ câu hỏi trước khi tìm đoạn văn.</p>");
  });

  it("sanitizes clean SVG diagrams and blocks malicious SVG payloads", () => {
    const cleanSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#059669" /></svg>`;
    const okRes = sanitizeSvg(cleanSvg);
    expect(okRes.ok).toBe(true);

    const scriptSvg = `<svg onload="alert(1)"><script>alert(2)</script><circle r="10"/></svg>`;
    const stripped = sanitizeSvg(scriptSvg);
    expect(stripped.ok).toBe(true);
    if (stripped.ok) {
      expect(stripped.content).not.toContain("onload");
      expect(stripped.content).not.toContain("<script");
    }

    const jsHrefSvg = `<svg><a xlink:href="javascript:alert(1)"><rect width="10" height="10"/></a></svg>`;
    expect(sanitizeSvg(jsHrefSvg).ok).toBe(false);
    expect(sanitizeSvg("<html>not svg</html>").ok).toBe(false);
  });

  it("slugifies Vietnamese text and scores all 8 SEO checklist criteria", () => {
    expect(slugifyVi("Đề thi Reading — Chiến thuật đạt Band 8.0+")).toBe(
      "de-thi-reading-chien-thuat-dat-band-8-0"
    );

    const evalRes = evaluateSeoChecklist({
      title: "Mẹo làm IELTS Reading đạt Band 8.0+ nhanh nhất",
      slug: "meo-lam-ielts-reading-dat-band-8",
      excerpt:
        "Tổng hợp mẹo làm IELTS Reading giúp xử lý dạng True False Not Given và Matching Headings hiệu quả trong 60 phút.",
      contentHtml:
        "<h2>Tổng quan mẹo làm IELTS Reading</h2><p>Áp dụng đúng mẹo làm IELTS Reading sẽ giúp thí sinh Việt Nam tiết kiệm thời gian và tăng độ chính xác.</p>",
      coverImageUrl: "https://cdn.example.com/reading.webp",
      seoMeta: {
        primaryKeyword: "mẹo làm IELTS Reading",
        coverImageAlt: "Minh họa chiến thuật IELTS Reading",
      },
    });
    expect(evalRes.score).toBe(8);
    expect(evalRes.maxScore).toBe(8);
  });

  it("builds Next Metadata with summary_large_image when image is present and valid JSON-LD", () => {
    const withImg = buildNextMetadata({
      title: "Chiến thuật Writing Task 2",
      description: "Hướng dẫn viết mở bài và thân bài đạt Band 7.5+.",
      pathname: "/blog/writing-task-2",
      imageUrl: "https://cdn.example.com/og.webp",
      seoMeta: { robotsIndex: false, robotsFollow: true },
    });
    expect((withImg.twitter as { card?: string })?.card).toBe("summary_large_image");
    expect((withImg.robots as { index?: boolean; follow?: boolean })?.index).toBe(false);
    expect((withImg.robots as { index?: boolean; follow?: boolean })?.follow).toBe(true);

    const withoutImg = buildNextMetadata({
      title: "Text Only Post",
      description: "Short description for testing default OG image and summary_large_image.",
      pathname: "/blog/text-only",
    });
    expect((withoutImg.twitter as { card?: string })?.card).toBe("summary_large_image");
    expect(JSON.stringify(withoutImg.openGraph?.images)).toContain("/og-default.png");

    const articleLd = buildArticleJsonLd({
      id: "b1",
      slug: "writing-task-2",
      title_vi: "Chiến thuật Writing Task 2",
      title_en: "Writing Task 2",
      excerpt_vi: "Hướng dẫn chi tiết.",
      excerpt_en: "Guide.",
      content_vi: "<p>Hello</p>",
      content_en: "<p>Hello</p>",
      category: "Writing",
      author_name: "Ôn IELTS",
      read_minutes: 5,
      published_at: "2026-11-26T00:00:00.000Z",
      is_published: true,
      cover_image_url: "https://cdn.example.com/og.webp",
    });
    expect(articleLd["@type"]).toBe("Article");
    expect(articleLd.image).toEqual(["https://cdn.example.com/og.webp"]);

    const crumbs = buildBreadcrumbJsonLd([
      { name: "Trang chủ", pathname: "/" },
      { name: "Blog", pathname: "/blog" },
    ]);
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    expect(crumbs.itemListElement).toHaveLength(2);
  });

  it("validates media file magic bytes and rejects spoofed MIME types", () => {
    expect(
      verifyMediaMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), "image/png")
    ).toBe(true);
    expect(
      verifyMediaMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")
    ).toBe(true);
    expect(
      verifyMediaMagicBytes(Buffer.from("%PDF-1.7\n"), "application/pdf")
    ).toBe(true);
    expect(
      verifyMediaMagicBytes(Buffer.from("ID3\x03\x00\x00"), "audio/mpeg")
    ).toBe(true);
    expect(
      verifyMediaMagicBytes(Buffer.from("<script>alert(1)</script>"), "image/png")
    ).toBe(false);
    expect(
      verifyMediaMagicBytes(Buffer.from("<html>fake pdf</html>"), "application/pdf")
    ).toBe(false);
  });

  it("enforces scheduled/draft blog visibility and validates BlogPost Zod schema", () => {
    const now = new Date("2026-11-26T10:00:00Z").getTime();
    expect(isBlogPostPubliclyVisible({ status: "published", is_published: true }, now)).toBe(true);
    expect(isBlogPostPubliclyVisible({ status: "draft", is_published: false }, now)).toBe(false);
    expect(
      isBlogPostPubliclyVisible(
        { status: "scheduled", is_published: false, scheduled_at: "2026-11-26T12:00:00Z" },
        now
      )
    ).toBe(false);
    expect(
      isBlogPostPubliclyVisible(
        { status: "scheduled", is_published: false, scheduled_at: "2026-11-26T09:00:00Z" },
        now
      )
    ).toBe(true);

    const invalid = blogPostFormSchema.safeParse({
      title_vi: "Hi",
      slug: "a",
      excerpt_vi: "Short",
      content_vi: "Too short",
      category: "Tips",
    });
    expect(invalid.success).toBe(false);

    const valid = blogPostFormSchema.safeParse({
      title_vi: "Cách luyện nghe IELTS Listening Part 4 hiệu quả",
      slug: "Cách Luyện Nghe Part 4",
      excerpt_vi: "Hướng dẫn chi tiết cách bắt từ khóa và đoán loại từ trong Listening Part 4.",
      content_vi: "<h2>Bước 1: Đọc câu hỏi</h2><p>Gạch chân từ khóa và dự đoán danh từ hay động từ.</p>",
      category: "Listening",
      status: "published",
      is_featured: true,
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.slug).toBe("cach-luyen-nghe-part-4");
    }
  });

  it("enforces requireStaff and verifySameOrigin CSRF checks on all GĐ2 Admin APIs", () => {
    for (const rel of [
      "src/app/api/admin/media/route.ts",
      "src/app/api/admin/media/[id]/route.ts",
      "src/app/api/admin/blog/route.ts",
      "src/app/api/admin/blog/[id]/route.ts",
    ]) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), "utf-8");
      expect(src, `${rel} missing requireStaff`).toContain("requireStaff");
      expect(src, `${rel} missing verifySameOrigin`).toContain("verifySameOrigin");
    }
  });
});
