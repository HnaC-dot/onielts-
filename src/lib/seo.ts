import type { Metadata } from "next";
import { z } from "zod";
import { getEffectiveSiteBaseUrl } from "./domain-redirect";
import { extractFirstHeading, extractPlainText } from "./sanitize";
import type { BlogPost, CourseItem, LearnVideo, SeoMeta } from "./types";

export const seoMetaSchema = z
  .object({
    metaTitle: z.string().max(120).optional(),
    metaDescription: z.string().max(320).optional(),
    primaryKeyword: z.string().max(100).optional(),
    secondaryKeywords: z.array(z.string().max(80)).max(15).optional(),
    canonicalUrl: z.string().max(500).optional(),
    robotsIndex: z.boolean().optional(),
    robotsFollow: z.boolean().optional(),
    ogTitle: z.string().max(120).optional(),
    ogDescription: z.string().max(320).optional(),
    ogImage: z.string().max(1000).optional(),
    ogImageAlt: z.string().max(200).optional(),
    coverImageAlt: z.string().max(200).optional(),
    titleSize: z.enum(["", "lg", "xl"]).optional(),
  })
  .optional()
  .default({});

export function slugifyVi(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalizeForKeywordMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SeoCheckItem {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
}

export function evaluateSeoChecklist(params: {
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  coverImageUrl?: string | null;
  seoMeta: SeoMeta;
}): {
  checks: SeoCheckItem[];
  score: number;
  maxScore: number;
  metaTitleLen: number;
  metaDescLen: number;
} {
  const effectiveTitle = (params.seoMeta.metaTitle || params.title || "").trim();
  const effectiveDesc = (params.seoMeta.metaDescription || params.excerpt || "").trim();
  const primaryKw = (params.seoMeta.primaryKeyword || "").trim();
  const kwNorm = normalizeForKeywordMatch(primaryKw);
  const kwSlug = slugifyVi(primaryKw);

  const plainText = extractPlainText(params.contentHtml);
  const first100Words = plainText.split(/\s+/).filter(Boolean).slice(0, 100).join(" ");
  const firstHeading = extractFirstHeading(params.contentHtml);
  const imageAlt = (
    params.seoMeta.coverImageAlt ||
    params.seoMeta.ogImageAlt ||
    ""
  ).trim();

  const checks: SeoCheckItem[] = [
    {
      id: "meta_title_len",
      label: "Độ dài Meta Title hợp lý (10–60 ký tự)",
      passed: effectiveTitle.length >= 10 && effectiveTitle.length <= 60,
      hint: `Hiện tại: ${effectiveTitle.length}/60 ký tự`,
    },
    {
      id: "meta_desc_len",
      label: "Độ dài Meta Description hợp lý (50–160 ký tự)",
      passed: effectiveDesc.length >= 50 && effectiveDesc.length <= 160,
      hint: `Hiện tại: ${effectiveDesc.length}/160 ký tự`,
    },
    {
      id: "kw_in_title",
      label: "Từ khóa chính xuất hiện trong Meta Title",
      passed:
        Boolean(kwNorm) &&
        normalizeForKeywordMatch(effectiveTitle).includes(kwNorm),
      hint: primaryKw
        ? `Từ khóa: "${primaryKw}"`
        : "Nhập từ khóa chính để kiểm tra",
    },
    {
      id: "kw_in_desc",
      label: "Từ khóa chính xuất hiện trong Meta Description",
      passed:
        Boolean(kwNorm) &&
        normalizeForKeywordMatch(effectiveDesc).includes(kwNorm),
      hint: primaryKw ? `Kiểm tra trong mô tả SEO` : "Chưa nhập từ khóa chính",
    },
    {
      id: "kw_in_slug",
      label: "Từ khóa chính có trong đường dẫn (Slug)",
      passed: Boolean(kwSlug) && slugifyVi(params.slug).includes(kwSlug),
      hint: params.slug ? `/${params.slug}` : "Chưa có slug",
    },
    {
      id: "kw_in_heading",
      label: "Từ khóa chính có trong Heading đầu tiên (H2/H3)",
      passed:
        Boolean(kwNorm) &&
        Boolean(firstHeading) &&
        normalizeForKeywordMatch(firstHeading).includes(kwNorm),
      hint: firstHeading
        ? `Heading đầu: "${firstHeading.slice(0, 50)}"`
        : "Chưa có thẻ tiêu đề H2/H3 trong nội dung",
    },
    {
      id: "kw_in_first_100",
      label: "Từ khóa chính có trong 100 từ đầu tiên",
      passed:
        Boolean(kwNorm) &&
        normalizeForKeywordMatch(first100Words).includes(kwNorm),
      hint: `Đã kiểm tra ${Math.min(100, plainText.split(/\s+/).filter(Boolean).length)} từ đầu`,
    },
    {
      id: "image_alt",
      label: "Ảnh đại diện / OG có mô tả Alt Text",
      passed:
        Boolean(params.coverImageUrl || params.seoMeta.ogImage) &&
        imageAlt.length >= 3,
      hint: imageAlt
        ? `Alt: "${imageAlt.slice(0, 45)}"`
        : "Chọn ảnh và nhập Alt Text để tăng điểm SEO & accessibility",
    },
  ];

  const score = checks.filter((c) => c.passed).length;
  return {
    checks,
    score,
    maxScore: checks.length,
    metaTitleLen: effectiveTitle.length,
    metaDescLen: effectiveDesc.length,
  };
}

export const DEFAULT_FALLBACK_OG_IMAGE = "/og-default.png";

export function getAppBaseUrl(): string {
  return getEffectiveSiteBaseUrl();
}

export function resolveAbsoluteAssetUrl(
  rawUrl: string | null | undefined,
  baseUrl = getAppBaseUrl()
): string | undefined {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${baseUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export function buildNextMetadata(params: {
  title: string;
  description: string;
  pathname: string;
  imageUrl?: string | null;
  imageAlt?: string;
  defaultImageUrl?: string | null;
  defaultImageAlt?: string;
  seoMeta?: SeoMeta;
  type?: "website" | "article";
  publishedTime?: string;
  authors?: string[];
  keywords?: string[];
  siteName?: string;
  twitterHandle?: string;
  noindex?: boolean;
}): Metadata {
  const baseUrl = getAppBaseUrl();
  const seo = params.seoMeta ?? {};
  const siteName = (params.siteName || "Ôn IELTS").trim();
  const metaTitle = (seo.metaTitle || params.title).trim();
  const metaDesc = (seo.metaDescription || params.description).trim();
  const ogTitle = (seo.ogTitle || metaTitle).trim();
  const ogDesc = (seo.ogDescription || metaDesc).trim();

  const rawImage = (
    seo.ogImage ||
    params.imageUrl ||
    params.defaultImageUrl ||
    DEFAULT_FALLBACK_OG_IMAGE
  ).trim();
  const absoluteImage =
    resolveAbsoluteAssetUrl(rawImage, baseUrl) ||
    `${baseUrl}${DEFAULT_FALLBACK_OG_IMAGE}`;
  const imageAlt = (
    seo.ogImageAlt ||
    seo.coverImageAlt ||
    params.imageAlt ||
    params.defaultImageAlt ||
    ogTitle
  ).trim();

  const normalizedPath = params.pathname === "/"
    ? ""
    : params.pathname.startsWith("/")
    ? params.pathname
    : `/${params.pathname}`;
  const canonical = seo.canonicalUrl?.trim()
    ? seo.canonicalUrl.trim()
    : `${baseUrl}${normalizedPath || "/"}`;

  const keywords = [
    ...(seo.primaryKeyword ? [seo.primaryKeyword] : []),
    ...(seo.secondaryKeywords ?? []),
    ...(params.keywords ?? []),
  ].filter(Boolean);

  const allowIndex = params.noindex ? false : seo.robotsIndex !== false;
  const allowFollow = params.noindex ? false : seo.robotsFollow !== false;

  return {
    title: metaTitle,
    description: metaDesc,
    keywords: keywords.length > 0 ? Array.from(new Set(keywords)) : undefined,
    alternates: {
      canonical,
    },
    robots: {
      index: allowIndex,
      follow: allowFollow,
    },
    openGraph: {
      type: params.type ?? "website",
      url: canonical,
      title: ogTitle,
      description: ogDesc,
      siteName,
      locale: "vi_VN",
      alternateLocale: ["en_US"],
      publishedTime: params.publishedTime,
      authors: params.authors,
      images: [
        {
          url: absoluteImage,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDesc,
      creator: params.twitterHandle?.trim() || undefined,
      images: [absoluteImage],
    },
  };
}

export function buildArticleJsonLd(post: BlogPost, baseUrl = getAppBaseUrl()) {
  const url = `${baseUrl}/blog/${post.slug}`;
  const rawImage = post.seo_meta?.ogImage || post.cover_image_url || "";
  const image = rawImage
    ? rawImage.startsWith("http")
      ? rawImage
      : `${baseUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.seo_meta?.metaTitle || post.title_vi,
    description: post.seo_meta?.metaDescription || post.excerpt_vi,
    image: image ? [image] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: {
      "@type": "Person",
      name: post.author_name || "Đội ngũ học thuật Ôn IELTS",
    },
    publisher: {
      "@type": "Organization",
      name: "Ôn IELTS",
      url: baseUrl,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    articleSection: post.category,
    keywords: [
      ...(post.seo_meta?.primaryKeyword ? [post.seo_meta.primaryKeyword] : []),
      ...(post.seo_meta?.secondaryKeywords ?? []),
      ...(post.tags ?? []),
    ]
      .filter(Boolean)
      .join(", "),
  };
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; pathname: string }>,
  baseUrl = getAppBaseUrl()
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: `${baseUrl}${item.pathname.startsWith("/") ? "" : "/"}${item.pathname}`,
    })),
  };
}

export function buildCourseJsonLd(course: CourseItem, baseUrl = getAppBaseUrl()) {
  const url = `${baseUrl}/courses/${course.slug}`;
  const rawImage = course.seo_meta?.ogImage || course.cover_image_url || "";
  const image = rawImage
    ? rawImage.startsWith("http")
      ? rawImage
      : `${baseUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`
    : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.seo_meta?.metaTitle || course.title_vi,
    description: course.seo_meta?.metaDescription || course.description_vi,
    url,
    image: image ? [image] : undefined,
    educationalLevel: course.level,
    inLanguage: "vi",
    provider: {
      "@type": "Organization",
      name: "Ôn IELTS",
      sameAs: baseUrl,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${Math.max(1, course.duration_hours)}H`,
    },
    numberOfLessons: course.lessons.length,
  };
}

function durationLabelToIso8601(label: string): string {
  const parts = label
    .trim()
    .split(":")
    .map((p) => Number.parseInt(p, 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (parts.length === 3) {
    return `PT${parts[0]}H${parts[1]}M${parts[2]}S`;
  }
  if (parts.length === 2) {
    return `PT${parts[0]}M${parts[1]}S`;
  }
  if (parts.length === 1 && parts[0] > 0) {
    return `PT${parts[0]}M`;
  }
  return "PT5M";
}

export function buildVideoObjectJsonLd(video: LearnVideo, baseUrl = getAppBaseUrl()) {
  const url = `${baseUrl}/videos/${video.slug}`;
  const ytThumb = `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;
  const rawImage = video.seo_meta?.ogImage || ytThumb;
  const thumbnailUrl = rawImage.startsWith("http")
    ? rawImage
    : `${baseUrl}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`;

  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.seo_meta?.metaTitle || video.title_vi,
    description: video.seo_meta?.metaDescription || video.description_vi,
    thumbnailUrl: [thumbnailUrl],
    embedUrl: `https://www.youtube-nocookie.com/embed/${video.youtube_id}`,
    contentUrl: `https://www.youtube.com/watch?v=${video.youtube_id}`,
    duration: durationLabelToIso8601(video.duration_label),
    educationalLevel: video.level,
    inLanguage: "en",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    publisher: {
      "@type": "Organization",
      name: "Ôn IELTS",
      url: baseUrl,
    },
  };
}

export function buildFaqPageJsonLd(
  faqs: Array<{ question: string; answer: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs
      .filter((f) => f.question.trim() && f.answer.trim())
      .map((f) => ({
        "@type": "Question",
        name: f.question.trim(),
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer.trim(),
        },
      })),
  };
}

/**
 * Safely serializes JSON-LD payloads for embedding inside `<script type="application/ld+json">`.
 * Escapes `<`, `>`, `&`, and line/paragraph separators to prevent `</script>` breakout XSS.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

