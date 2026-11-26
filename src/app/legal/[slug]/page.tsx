import React from "react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getPublicFaqs, getStaticPageBySlug } from "@/lib/site-content";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
} from "@/lib/seo";
import { buildPublicPageMetadata } from "@/lib/seo-server";
import { renderBlogContentToSafeHtml } from "@/lib/sanitize";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getStaticPageBySlug(`legal/${slug}`, false);
  if (!page) return {};
  return buildPublicPageMetadata({
    title: page.title_vi,
    description: page.seo_meta?.metaDescription || page.title_vi,
    pathname: `/legal/${slug}`,
    seoMeta: page.seo_meta,
    type: "article",
  });
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [locale, cmsPage, faqs] = await Promise.all([
    getLocale(),
    getStaticPageBySlug(`legal/${slug}`, false),
    slug === "faqs" ? getPublicFaqs() : Promise.resolve([]),
  ]);

  if (!cmsPage) notFound();

  const isEn = locale === "en";
  const title = isEn ? cmsPage.title_en || cmsPage.title_vi : cmsPage.title_vi;
  const rawBody = isEn ? cmsPage.body_en || cmsPage.body_vi : cmsPage.body_vi;
  const safeHtml = renderBlogContentToSafeHtml(rawBody);
  const updatedLabel = new Date(cmsPage.updated_at).toLocaleDateString("vi-VN");

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Trang chủ", pathname: "/" },
    { name: title, pathname: `/legal/${slug}` },
  ]);

  const faqJsonLd =
    slug === "faqs" && faqs.length > 0
      ? buildFaqPageJsonLd(
          faqs.map((f) => ({
            question: isEn ? f.question_en || f.question_vi : f.question_vi,
            answer: isEn ? f.answer_en || f.answer_vi : f.answer_vi,
          }))
        )
      : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <Card className="p-6 sm:p-10 space-y-6">
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {isEn ? `Last updated: ${updatedLabel}` : `Cập nhật lần cuối: ${updatedLabel}`}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
        </div>

        <div
          className="prose prose-sm prose-slate max-w-none leading-7 text-slate-700 dark:prose-invert dark:text-slate-300"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />

        {slug === "faqs" && faqs.length > 0 && (
          <div className="space-y-4 border-t border-slate-100 pt-6 dark:border-slate-800">
            {faqs.map((f) => (
              <div
                key={f.id}
                className="rounded-2xl border border-slate-200 p-5 space-y-2 dark:border-slate-800"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {isEn ? f.question_en || f.question_vi : f.question_vi}
                  </h2>
                  <Badge variant="secondary">{f.category}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {isEn ? f.answer_en || f.answer_vi : f.answer_vi}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
