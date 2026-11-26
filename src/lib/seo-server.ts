import "server-only";
import type { Metadata } from "next";
import { buildNextMetadata, DEFAULT_FALLBACK_OG_IMAGE } from "./seo";
import { getSiteGeneralSettings, getSiteSeoSettings } from "./site-content";
import type { SeoMeta } from "./types";

/**
 * Builds complete, page-specific OpenGraph, Canonical, and Twitter (`summary_large_image`)
 * metadata so child pages never inherit homepage og:title / og:description / og:url.
 * Falls back cleanly to CMS default OG image -> `/og-default.png`.
 */
export async function buildPublicPageMetadata(params: {
  title: string;
  description: string;
  pathname: string;
  imageUrl?: string | null;
  imageAlt?: string;
  seoMeta?: SeoMeta;
  type?: "website" | "article";
  publishedTime?: string;
  authors?: string[];
  keywords?: string[];
  noindex?: boolean;
  /** Set true on homepage so title does not get wrapped by title.template */
  useAbsoluteTitle?: boolean;
}): Promise<Metadata> {
  const [seo, general] = await Promise.all([
    getSiteSeoSettings(),
    getSiteGeneralSettings(),
  ]);

  const built = buildNextMetadata({
    title: params.title,
    description: params.description,
    pathname: params.pathname,
    imageUrl: params.imageUrl,
    imageAlt: params.imageAlt,
    defaultImageUrl: seo.defaultOgImage || DEFAULT_FALLBACK_OG_IMAGE,
    defaultImageAlt: seo.defaultOgImageAlt || general.siteName || "Ôn IELTS",
    seoMeta: params.seoMeta,
    type: params.type ?? "website",
    publishedTime: params.publishedTime,
    authors: params.authors,
    keywords: params.keywords,
    siteName: general.siteName || "Ôn IELTS",
    twitterHandle: seo.twitterHandle,
    noindex: params.noindex,
  });

  if (params.useAbsoluteTitle && typeof built.title === "string") {
    built.title = { absolute: built.title };
  }

  return built;
}
