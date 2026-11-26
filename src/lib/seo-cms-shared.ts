import { z } from "zod";
import type { MetadataRoute } from "next";
import type { SeoRedirectItem, SiteSeoSettings } from "./types";

// =============================================================================
// CONSTANTS & SECURITY ALLOWLISTS (Pure, Client & Edge Safe)
// =============================================================================
export const GA4_ID_REGEX = /^G-[A-Z0-9]{4,20}$/;
export const GSC_TOKEN_REGEX = /^[A-Za-z0-9._-]{4,120}$/;

export const PROTECTED_ROBOTS_DISALLOW = [
  "/admin",
  "/api/",
  "/auth",
  "/profile",
] as const;

export const RESERVED_REDIRECT_PREFIXES = [
  "/admin",
  "/api",
  "/auth",
  "/_next",
  "/sitemap.xml",
  "/robots.txt",
] as const;

export const DEFAULT_SITE_SEO_SETTINGS: SiteSeoSettings = {
  defaultMetaTitle: "Ôn IELTS — Ôn luyện IELTS thông minh cùng AI",
  titleTemplate: "%s | Ôn IELTS",
  defaultMetaDescription:
    "Nền tảng tự học và luyện thi IELTS toàn diện cho người Việt: làm đề thi chuẩn máy tính, chấm Writing & Speaking bằng AI, luyện phát âm IPA, chép chính tả, Shadowing và Flashcard lặp lại ngắt quãng.",
  defaultKeywords: [
    "Ôn IELTS",
    "luyện thi IELTS",
    "chấm Writing IELTS AI",
    "luyện Speaking IELTS AI",
    "tính điểm band IELTS",
    "chép chính tả IELTS",
    "phát âm IPA",
  ],
  defaultOgImage: "",
  defaultOgImageAlt: "Ôn IELTS — Nền tảng ôn luyện IELTS thông minh cùng AI",
  twitterHandle: "",
  googleSiteVerification: "",
  googleAnalyticsId: "",
  organizationLogo: "",
  robotsDisallowPaths: [],
  sitemapIncludeTests: true,
  sitemapIncludeBlog: true,
  sitemapIncludeCourses: true,
  sitemapIncludePronunciation: true,
  sitemapIncludeVideos: true,
  sitemapIncludeStaticPages: true,
};

// =============================================================================
// PATH NORMALIZATION & REDIRECT MATCHING (Shared by Proxy, CMS & Unit Tests)
// =============================================================================
export function normalizeRedirectPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Strip hash and query from path segment when normalizing sources
  const withoutHash = trimmed.split("#")[0] ?? "";
  const withoutQuery = withoutHash.split("?")[0] ?? "";
  const withLeadingSlash = withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, "/");
  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

export function normalizeRedirectDestination(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const [pathPart, ...rest] = trimmed.split("?");
  const normalizedPath = normalizeRedirectPath(pathPart ?? "");
  if (!normalizedPath) return "";
  const queryPart = rest.join("?").trim();
  return queryPart ? `${normalizedPath}?${queryPart}` : normalizedPath;
}

export function isSafeInternalRedirectTarget(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return false;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return false;
  if (/[\r\n\t]/.test(trimmed)) return false;
  return true;
}

export function isReservedRedirectSource(rawPath: string): boolean {
  const normalized = normalizeRedirectPath(rawPath).toLowerCase();
  if (!normalized || normalized === "/") return true;
  return RESERVED_REDIRECT_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

export function isValidGa4Id(id: string): boolean {
  const trimmed = id.trim();
  return trimmed === "" || GA4_ID_REGEX.test(trimmed);
}

export function matchSeoRedirect(
  pathname: string,
  redirects: Array<
    Pick<
      SeoRedirectItem,
      "id" | "source_path" | "destination_path" | "status_code" | "is_active"
    >
  >
): Pick<
  SeoRedirectItem,
  "id" | "source_path" | "destination_path" | "status_code" | "is_active"
> | null {
  const normalizedPath = normalizeRedirectPath(pathname);
  if (!normalizedPath || isReservedRedirectSource(normalizedPath)) {
    return null;
  }

  for (const r of redirects) {
    if (!r.is_active) continue;
    const src = normalizeRedirectPath(r.source_path);
    if (!src || isReservedRedirectSource(src)) continue;
    if (src !== normalizedPath) continue;

    if (!isSafeInternalRedirectTarget(r.destination_path)) continue;
    const destPathOnly = normalizeRedirectPath(r.destination_path);
    // Never redirect a path back to itself (prevents infinite redirect loop)
    if (!destPathOnly || destPathOnly === normalizedPath) continue;

    return r;
  }

  return null;
}

export function buildRobotsConfig(
  seo: SiteSeoSettings,
  baseUrl: string
): MetadataRoute.Robots {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const mergedDisallow = new Set<string>(PROTECTED_ROBOTS_DISALLOW);

  for (const raw of seo.robotsDisallowPaths ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    // Never accidentally disallow entire site unless explicitly valid path (block bare "/" to prevent SEO disaster)
    if (trimmed === "/") continue;
    const safePath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (!/[\r\n]/.test(safePath)) {
      mergedDisallow.add(safePath);
    }
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: Array.from(mergedDisallow),
      },
    ],
    sitemap: `${cleanBase}/sitemap.xml`,
  };
}

export function formatRobotsPreviewText(
  seo: SiteSeoSettings,
  baseUrl: string
): string {
  const cfg = buildRobotsConfig(seo, baseUrl);
  const firstRule = Array.isArray(cfg.rules) ? cfg.rules[0] : cfg.rules;
  const disallowList = Array.isArray(firstRule?.disallow)
    ? firstRule.disallow
    : firstRule?.disallow
    ? [firstRule.disallow]
    : [];

  const lines = ["User-Agent: *", "Allow: /"];
  for (const d of disallowList) {
    lines.push(`Disallow: ${d}`);
  }
  lines.push("");
  lines.push(`Sitemap: ${cfg.sitemap}`);
  return lines.join("\n");
}

// =============================================================================
// ZOD VALIDATION SCHEMAS
// =============================================================================
export const siteSeoSettingsSchema = z.object({
  defaultMetaTitle: z
    .string()
    .trim()
    .min(5, "Tiêu đề SEO mặc định quá ngắn (tối thiểu 5 ký tự)")
    .max(120, "Tiêu đề SEO tối đa 120 ký tự"),
  titleTemplate: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .refine(
      (val) => val.includes("%s"),
      "Mẫu tiêu đề (Title Template) phải chứa %s — ví dụ: %s | Ôn IELTS"
    ),
  defaultMetaDescription: z
    .string()
    .trim()
    .min(20, "Mô tả SEO mặc định quá ngắn (tối thiểu 20 ký tự)")
    .max(320, "Mô tả SEO tối đa 320 ký tự"),
  defaultKeywords: z
    .array(z.string().trim().min(1).max(80))
    .max(25)
    .default([]),
  defaultOgImage: z
    .string()
    .trim()
    .max(1000)
    .default("")
    .refine(
      (val) => !val || val.startsWith("/") || /^https?:\/\//i.test(val),
      "URL ảnh OG phải bắt đầu bằng / hoặc https://"
    ),
  defaultOgImageAlt: z.string().trim().max(200).default(""),
  twitterHandle: z
    .string()
    .trim()
    .max(50)
    .default("")
    .refine(
      (val) => !val || /^@?[A-Za-z0-9_]{1,30}$/.test(val),
      "Twitter handle chỉ gồm chữ, số, dấu gạch dưới (ví dụ @onieltsvn)"
    ),
  googleSiteVerification: z
    .string()
    .trim()
    .max(120)
    .default("")
    .refine(
      (val) => !val || GSC_TOKEN_REGEX.test(val),
      "Mã xác minh Google Search Console chỉ gồm chữ, số, '.', '-', '_' (không dán cả thẻ HTML <meta>)"
    ),
  googleAnalyticsId: z
    .string()
    .trim()
    .max(32)
    .default("")
    .refine(
      (val) => isValidGa4Id(val),
      "Mã Google Analytics 4 phải đúng định dạng G-XXXXXXXXXX (ví dụ: G-AB12CD34EF)"
    ),
  organizationLogo: z
    .string()
    .trim()
    .max(1000)
    .default("")
    .refine(
      (val) => !val || val.startsWith("/") || /^https?:\/\//i.test(val),
      "URL logo Organization phải bắt đầu bằng / hoặc https://"
    ),
  robotsDisallowPaths: z
    .array(
      z
        .string()
        .trim()
        .min(2, "Đường dẫn chặn tối thiểu 2 ký tự")
        .max(120)
        .refine(
          (p) => p.startsWith("/") && p !== "/" && !/[\r\n\s]/.test(p),
          "Đường dẫn chặn trong robots.txt phải bắt đầu bằng / (không được chặn toàn bộ /)"
        )
    )
    .max(50)
    .default([]),
  sitemapIncludeTests: z.boolean().default(true),
  sitemapIncludeBlog: z.boolean().default(true),
  sitemapIncludeCourses: z.boolean().default(true),
  sitemapIncludePronunciation: z.boolean().default(true),
  sitemapIncludeVideos: z.boolean().default(true),
  sitemapIncludeStaticPages: z.boolean().default(true),
});

export const seoRedirectUpsertSchema = z
  .object({
    id: z.string().optional(),
    source_path: z
      .string()
      .trim()
      .min(2, "Đường dẫn cũ phải bắt đầu bằng / (ví dụ: /blog/bai-cu)")
      .max(300),
    destination_path: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập đường dẫn mới (ví dụ: /blog/bai-moi)")
      .max(300),
    status_code: z
      .union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)])
      .default(301),
    is_active: z.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    const src = normalizeRedirectPath(val.source_path);
    if (!val.source_path.trim().startsWith("/") || val.source_path.trim().startsWith("//")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_path"],
        message: "Đường dẫn cũ phải là đường dẫn nội bộ bắt đầu bằng /",
      });
      return;
    }
    if (isReservedRedirectSource(src)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source_path"],
        message:
          "Không được tạo redirect đè lên trang chủ (/) hoặc đường dẫn hệ thống (/admin, /api, /auth, /_next, /sitemap.xml, /robots.txt).",
      });
    }
    if (!isSafeInternalRedirectTarget(val.destination_path)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination_path"],
        message:
          "Đường dẫn đích phải là đường dẫn nội bộ hợp lệ bắt đầu bằng / (không cho phép redirect ra tên miền lạ).",
      });
      return;
    }
    const destPathOnly = normalizeRedirectPath(val.destination_path);
    if (src === destPathOnly) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destination_path"],
        message: "Đường dẫn mới không được trùng với đường dẫn cũ (gây vòng lặp vô hạn).",
      });
    }
  });

export const seoRedirectToggleSchema = z.object({
  id: z.string().min(1),
  is_active: z.boolean(),
});
