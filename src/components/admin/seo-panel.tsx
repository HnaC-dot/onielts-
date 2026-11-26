"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Globe,
  Image as ImageIcon,
  Share2,
  Sparkles,
} from "lucide-react";
import type { SeoMeta } from "@/lib/types";
import { evaluateSeoChecklist } from "@/lib/seo";
import { MediaPickerModal } from "./media-picker-modal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SeoPanelProps {
  seoMeta: SeoMeta;
  onChange: (next: SeoMeta) => void;
  fallbackTitle: string;
  fallbackDescription: string;
  slug: string;
  basePath: string; // e.g. "/blog"
  contentHtml: string;
  coverImageUrl?: string | null;
  siteHost?: string;
}

function getDefaultPreviewHost(): string {
  const raw = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  ).trim();
  if (!raw) return "onielts.vn";
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).host;
  } catch {
    return "onielts.vn";
  }
}

export function SeoPanel({
  seoMeta,
  onChange,
  fallbackTitle,
  fallbackDescription,
  slug,
  basePath,
  contentHtml,
  coverImageUrl,
  siteHost = getDefaultPreviewHost(),
}: SeoPanelProps) {
  const [ogPickerOpen, setOgPickerOpen] = useState(false);
  const [secondaryDraft, setSecondaryDraft] = useState(
    (seoMeta.secondaryKeywords ?? []).join(", ")
  );

  const checklist = useMemo(
    () =>
      evaluateSeoChecklist({
        title: fallbackTitle,
        slug,
        excerpt: fallbackDescription,
        contentHtml,
        coverImageUrl,
        seoMeta,
      }),
    [fallbackTitle, slug, fallbackDescription, contentHtml, coverImageUrl, seoMeta]
  );

  const previewTitle = (seoMeta.metaTitle || fallbackTitle || "Tiêu đề bài viết Ôn IELTS").trim();
  const previewDesc = (
    seoMeta.metaDescription ||
    fallbackDescription ||
    "Mô tả ngắn gọn xuất hiện trên Google Search giúp tăng tỉ lệ nhấp (CTR)..."
  ).trim();
  const previewOgTitle = (seoMeta.ogTitle || previewTitle).trim();
  const previewOgDesc = (seoMeta.ogDescription || previewDesc).trim();
  const previewImage = (seoMeta.ogImage || coverImageUrl || "").trim();
  const previewUrl = `https://${siteHost}${basePath}/${slug || "duong-dan-bai-viet"}`;

  const update = (patch: Partial<SeoMeta>) => {
    onChange({ ...seoMeta, ...patch });
  };

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Tối ưu SEO, Open Graph &amp; Xem trước Google / Facebook
          </h2>
        </div>
        <Badge
          variant={
            checklist.score >= 6 ? "default" : "secondary"
          }
        >
          Điểm SEO: {checklist.score}/{checklist.maxScore}
        </Badge>
      </div>

      {/* Meta Title & Description */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <label className="font-semibold text-slate-800 dark:text-slate-200">
              Meta Title (gợi ý ≤ 60 ký tự)
            </label>
            <span
              className={`font-mono text-[11px] font-bold ${
                checklist.metaTitleLen > 60
                  ? "text-red-600"
                  : checklist.metaTitleLen >= 30
                  ? "text-emerald-600"
                  : "text-amber-600"
              }`}
            >
              {checklist.metaTitleLen}/60
            </span>
          </div>
          <input
            type="text"
            value={seoMeta.metaTitle ?? ""}
            onChange={(e) => update({ metaTitle: e.target.value })}
            placeholder={fallbackTitle || "Để trống sẽ tự lấy tiêu đề bài viết"}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Từ khóa chính (Focus Keyword)
          </label>
          <input
            type="text"
            value={seoMeta.primaryKeyword ?? ""}
            onChange={(e) => update({ primaryKeyword: e.target.value })}
            placeholder="VD: luyện thi ielts reading"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-slate-800 dark:text-slate-200">
            Meta Description (gợi ý ≤ 160 ký tự)
          </label>
          <span
            className={`font-mono text-[11px] font-bold ${
              checklist.metaDescLen > 160
                ? "text-red-600"
                : checklist.metaDescLen >= 70
                ? "text-emerald-600"
                : "text-amber-600"
            }`}
          >
            {checklist.metaDescLen}/160
          </span>
        </div>
        <textarea
          rows={2}
          value={seoMeta.metaDescription ?? ""}
          onChange={(e) => update({ metaDescription: e.target.value })}
          placeholder={fallbackDescription || "Để trống sẽ tự lấy đoạn tóm tắt bài viết"}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
      </div>

      {/* Secondary Keywords + Canonical + Robots */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Từ khóa phụ (phân tách bởi dấu phẩy)
          </label>
          <input
            type="text"
            value={secondaryDraft}
            onChange={(e) => {
              setSecondaryDraft(e.target.value);
              const list = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              update({ secondaryKeywords: list });
            }}
            placeholder="VD: mẹo làm reading, true false not given, band 7.5"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Canonical URL (tùy chọn)
          </label>
          <input
            type="url"
            value={seoMeta.canonicalUrl ?? ""}
            onChange={(e) => update({ canonicalUrl: e.target.value })}
            placeholder={previewUrl}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-5 text-xs">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={seoMeta.robotsIndex !== false}
            onChange={(e) => update({ robotsIndex: e.target.checked })}
            className="rounded border-slate-300 text-emerald-600"
          />
          <span>
            Cho phép Google lập chỉ mục (<code>index</code>)
          </span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={seoMeta.robotsFollow !== false}
            onChange={(e) => update({ robotsFollow: e.target.checked })}
            className="rounded border-slate-300 text-emerald-600"
          />
          <span>
            Theo dõi liên kết (<code>follow</code>)
          </span>
        </label>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          twitter:card = summary_large_image
        </span>
      </div>

      {/* Live 8-point SEO Checklist */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 dark:border-slate-800 dark:bg-slate-900/50">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Checklist kiểm tra SEO tự động
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {checklist.checks.map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-xs">
              {item.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <div>
                <p
                  className={
                    item.passed
                      ? "font-medium text-slate-800 dark:text-slate-200"
                      : "text-slate-600 dark:text-slate-400"
                  }
                >
                  {item.label}
                </p>
                <p className="text-[10px] text-slate-400">{item.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Open Graph / Social Overrides */}
      <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
          <Share2 className="h-3.5 w-3.5 text-sky-600" />
          Open Graph &amp; Twitter Card riêng cho trang này (Facebook / Zalo / X)
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={seoMeta.ogTitle ?? ""}
            onChange={(e) => update({ ogTitle: e.target.value })}
            placeholder="OG Title (mặc định dùng Meta Title)"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <input
            type="text"
            value={seoMeta.ogImageAlt ?? ""}
            onChange={(e) => update({ ogImageAlt: e.target.value })}
            placeholder="Alt Text cho ảnh OG"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <textarea
          rows={2}
          value={seoMeta.ogDescription ?? ""}
          onChange={(e) => update({ ogDescription: e.target.value })}
          placeholder="OG Description (mặc định dùng Meta Description)"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={seoMeta.ogImage ?? ""}
            onChange={(e) => update({ ogImage: e.target.value })}
            placeholder="URL ảnh OG riêng (để trống dùng ảnh bìa hoặc ảnh OG mặc định 1200×630)"
            className="flex-1 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOgPickerOpen(true)}
          >
            <ImageIcon className="h-3.5 w-3.5" /> Chọn ảnh OG riêng
          </Button>
        </div>
      </div>

      {/* Live Google SERP & Facebook Share Previews */}
      <div className="grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2 dark:border-slate-800">
        {/* Google Snippet */}
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Globe className="h-3.5 w-3.5 text-emerald-600" />
            Xem trước kết quả tìm kiếm Google
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 space-y-1">
            <p className="truncate text-[11px] text-slate-500">{previewUrl}</p>
            <p className="line-clamp-1 text-base font-medium text-[#1a0dab] dark:text-sky-400">
              {previewTitle.slice(0, 65)}
              {previewTitle.length > 65 ? "..." : ""}
            </p>
            <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {previewDesc.slice(0, 165)}
              {previewDesc.length > 165 ? "..." : ""}
            </p>
          </div>
        </div>

        {/* Facebook Card */}
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Share2 className="h-3.5 w-3.5 text-blue-600" />
            Xem trước khi chia sẻ Facebook / Zalo / X
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
            <div className="relative h-36 w-full bg-slate-200 dark:bg-slate-900">
              <img
                src={previewImage || "/og-default.png"}
                alt={seoMeta.ogImageAlt || seoMeta.coverImageAlt || previewOgTitle}
                className="h-full w-full object-cover"
              />
              {!previewImage && (
                <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Ảnh OG mặc định
                </span>
              )}
            </div>
            <div className="p-3 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {siteHost}
              </p>
              <p className="line-clamp-1 text-xs font-bold text-slate-900 dark:text-white">
                {previewOgTitle}
              </p>
              <p className="line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">
                {previewOgDesc}
              </p>
            </div>
          </div>
        </div>
      </div>

      <MediaPickerModal
        open={ogPickerOpen}
        onClose={() => setOgPickerOpen(false)}
        acceptKind="image"
        defaultFolder="seo"
        title="Chọn ảnh Open Graph (1200×630px)"
        onSelect={(asset) => {
          update({
            ogImage: asset.public_url,
            ogImageAlt: seoMeta.ogImageAlt || asset.alt_text || "",
          });
        }}
      />
    </Card>
  );
}
