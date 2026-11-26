"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  FileCode2,
  Globe,
  Image as ImageIcon,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type {
  MediaAsset,
  SeoHealthSummary,
  SeoRedirectItem,
  SiteSeoSettings,
} from "@/lib/types";
import {
  formatRobotsPreviewText,
  isValidGa4Id,
  PROTECTED_ROBOTS_DISALLOW,
} from "@/lib/seo-cms-shared";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { MediaPickerModal } from "./media-picker-modal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SeoCmsClientProps {
  initialSettings: SiteSeoSettings;
  initialRedirects: SeoRedirectItem[];
  initialHealth: SeoHealthSummary;
  baseUrl: string;
}

type ActiveTab = "global" | "redirects" | "sitemap";

interface RedirectFormState {
  id?: string;
  source_path: string;
  destination_path: string;
  status_code: 301 | 302 | 307 | 308;
  is_active: boolean;
}

const EMPTY_REDIRECT_FORM: RedirectFormState = {
  source_path: "",
  destination_path: "",
  status_code: 301,
  is_active: true,
};

export function SeoCmsClient({
  initialSettings,
  initialRedirects,
  initialHealth,
  baseUrl,
}: SeoCmsClientProps) {
  const toast = useAdminToast();
  const [tab, setTab] = useState<ActiveTab>("global");

  // Global SEO Settings state
  const [settings, setSettings] = useState<SiteSeoSettings>(initialSettings);
  const [keywordsText, setKeywordsText] = useState(
    (initialSettings.defaultKeywords ?? []).join(", ")
  );
  const [disallowText, setDisallowText] = useState(
    (initialSettings.robotsDisallowPaths ?? []).join("\n")
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<null | "og" | "logo">(null);

  // Redirects state
  const [redirects, setRedirects] = useState<SeoRedirectItem[]>(initialRedirects);
  const [redirectSearch, setRedirectSearch] = useState("");
  const [redirectFilter, setRedirectFilter] = useState<"all" | "active" | "inactive">("all");
  const [redirectForm, setRedirectForm] = useState<RedirectFormState>(EMPTY_REDIRECT_FORM);
  const [savingRedirect, setSavingRedirect] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SeoRedirectItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Health Audit state
  const [health, setHealth] = useState<SeoHealthSummary>(initialHealth);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [healthFilter, setHealthFilter] = useState<string>("all");

  const parsedSettingsForPreview = useMemo<SiteSeoSettings>(() => {
    const customDisallow = disallowText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const kws = keywordsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return {
      ...settings,
      defaultKeywords: kws,
      robotsDisallowPaths: customDisallow,
    };
  }, [settings, keywordsText, disallowText]);

  const robotsPreview = useMemo(
    () => formatRobotsPreviewText(parsedSettingsForPreview, baseUrl),
    [parsedSettingsForPreview, baseUrl]
  );

  const filteredRedirects = useMemo(() => {
    const q = redirectSearch.trim().toLowerCase();
    return redirects.filter((r) => {
      if (redirectFilter === "active" && !r.is_active) return false;
      if (redirectFilter === "inactive" && r.is_active) return false;
      if (q) {
        const hay = `${r.source_path} ${r.destination_path} ${r.status_code}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [redirects, redirectSearch, redirectFilter]);

  const filteredIssues = useMemo(() => {
    if (healthFilter === "all") return health.issues;
    if (healthFilter === "noindex") return health.issues.filter((i) => !i.robotsIndex);
    return health.issues.filter((i) => i.module === healthFilter);
  }, [health.issues, healthFilter]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSavingSettings(true);
    try {
      const payload: SiteSeoSettings = {
        ...settings,
        defaultKeywords: keywordsText
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        robotsDisallowPaths: disallowText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      };

      const res = await fetch("/api/admin/seo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu cấu hình SEO thất bại.");
        return;
      }
      if (data.settings) {
        setSettings(data.settings);
        setKeywordsText((data.settings.defaultKeywords ?? []).join(", "));
        setDisallowText((data.settings.robotsDisallowPaths ?? []).join("\n"));
      }
      toast.success("Đã lưu cấu hình SEO, Sitemap & Robots.txt thành công!");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSubmitRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRedirect(true);
    try {
      const res = await fetch("/api/admin/seo/redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(redirectForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu Redirect thất bại.");
        return;
      }
      const saved: SeoRedirectItem = data.item;
      setRedirects((prev) => {
        const idx = prev.findIndex((r) => r.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
      setRedirectForm(EMPTY_REDIRECT_FORM);
      toast.success(
        redirectForm.id
          ? `Đã cập nhật Redirect ${saved.source_path}`
          : `Đã tạo Redirect ${saved.status_code}: ${saved.source_path} → ${saved.destination_path}`
      );
    } finally {
      setSavingRedirect(false);
    }
  };

  const handleToggleRedirect = async (item: SeoRedirectItem) => {
    const nextState = !item.is_active;
    const res = await fetch("/api/admin/seo/redirects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, is_active: nextState }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Không thể đổi trạng thái Redirect.");
      return;
    }
    setRedirects((prev) =>
      prev.map((r) => (r.id === item.id ? data.item ?? { ...r, is_active: nextState } : r))
    );
    toast.success(nextState ? `Đã bật ${item.source_path}` : `Đã tắt ${item.source_path}`);
  };

  const handleDeleteRedirect = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/seo/redirects?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Xóa Redirect thất bại.");
        return;
      }
      setRedirects((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      if (redirectForm.id === deleteTarget.id) {
        setRedirectForm(EMPTY_REDIRECT_FORM);
      }
      toast.success(`Đã xóa Redirect ${deleteTarget.source_path}`);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleRefreshHealth = async () => {
    setRefreshingHealth(true);
    try {
      const res = await fetch("/api/admin/seo");
      if (res.ok) {
        const data = await res.json();
        if (data.health) setHealth(data.health);
        if (Array.isArray(data.redirects)) setRedirects(data.redirects);
        toast.success("Đã quét lại toàn bộ sức khỏe SEO!");
      }
    } finally {
      setRefreshingHealth(false);
    }
  };

  const ga4Valid = isValidGa4Id(settings.googleAnalyticsId);
  const activeRedirectsCount = redirects.filter((r) => r.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              SEO toàn trang &amp; Redirect 301
            </h1>
            <Badge variant="default">Admin Only</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Cấu hình thẻ Meta/OpenGraph/Twitter mặc định, xác minh Google Search Console, GA4, quản lý chuyển hướng 301/302 chạy trực tiếp trên Proxy, Sitemap động và kiểm tra sức khỏe SEO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <FileCode2 className="h-3.5 w-3.5 text-emerald-600" />
            Xem sitemap.xml
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
          <a
            href="/robots.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Xem robots.txt
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          {
            id: "global" as const,
            label: "1. Meta, OG & Google Analytics",
            icon: Globe,
          },
          {
            id: "redirects" as const,
            label: `2. Redirect 301 / 302 (${activeRedirectsCount}/${redirects.length})`,
            icon: ArrowRight,
          },
          {
            id: "sitemap" as const,
            label: `3. Sitemap, Robots & Sức khỏe SEO (${health.healthyCount}/${health.totalPublicItems})`,
            icon: Activity,
          },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                active
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-400 hover:text-emerald-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: GLOBAL SEO & ANALYTICS */}
      {tab === "global" && (
        <form onSubmit={handleSaveSettings} className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-5">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Globe className="h-4 w-4 text-emerald-600" />
                  Thẻ Meta mặc định toàn website
                </div>
                <Button type="submit" size="sm" disabled={savingSettings}>
                  <Save className="h-4 w-4" />
                  {savingSettings ? "Đang lưu..." : "Lưu cấu hình SEO"}
                </Button>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Tiêu đề SEO mặc định (Trang chủ) *
                  </label>
                  <span
                    className={
                      settings.defaultMetaTitle.length <= 65
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }
                  >
                    {settings.defaultMetaTitle.length}/65 ký tự khuyến nghị
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={settings.defaultMetaTitle}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultMetaTitle: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mẫu tiêu đề trang con (Title Template) *
                  </label>
                  <input
                    type="text"
                    required
                    value={settings.titleTemplate}
                    onChange={(e) =>
                      setSettings({ ...settings, titleTemplate: e.target.value })
                    }
                    placeholder="%s | Ôn IELTS"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-950"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Bắt buộc chứa <code>%s</code> để Next.js chèn tên từng trang con.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Twitter / X Handle (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={settings.twitterHandle}
                    onChange={(e) =>
                      setSettings({ ...settings, twitterHandle: e.target.value })
                    }
                    placeholder="@onieltsvn"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tự động gắn thẻ <code>twitter:card = summary_large_image</code>.
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Mô tả SEO mặc định (Meta Description) *
                  </label>
                  <span
                    className={
                      settings.defaultMetaDescription.length >= 50 &&
                      settings.defaultMetaDescription.length <= 165
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }
                  >
                    {settings.defaultMetaDescription.length}/160 ký tự khuyến nghị
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  maxLength={320}
                  value={settings.defaultMetaDescription}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      defaultMetaDescription: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Từ khóa chính toàn trang (cách nhau bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  placeholder="Ôn IELTS, luyện thi IELTS, chấm Writing IELTS AI..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </Card>

            {/* Default OG & Organization Logo */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Share2 className="h-4 w-4 text-emerald-600" />
                Ảnh chia sẻ Facebook / Zalo / Twitter (OG Image) &amp; Logo JSON-LD
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ảnh OG mặc định toàn trang (khuyến nghị 1200 × 630px)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.defaultOgImage}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultOgImage: e.target.value })
                    }
                    placeholder="https://... hoặc chọn từ Thư viện Media"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPickerTarget("og")}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Chọn ảnh
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mô tả Alt cho ảnh OG
                  </label>
                  <input
                    type="text"
                    value={settings.defaultOgImageAlt}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultOgImageAlt: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Logo Organization (Schema JSON-LD)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.organizationLogo}
                      onChange={(e) =>
                        setSettings({ ...settings, organizationLogo: e.target.value })
                      }
                      placeholder="Để trống sẽ dùng Logo Cài đặt chung"
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPickerTarget("logo")}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Google Search Console & GA4 */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                Google Search Console &amp; Google Analytics 4 (GA4)
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mã xác minh Google Search Console
                  </label>
                  <input
                    type="text"
                    value={settings.googleSiteVerification}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        googleSiteVerification: e.target.value,
                      })
                    }
                    placeholder="Chỉ dán chuỗi content=... (không dán cả thẻ <meta>)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-950"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tự động xuất thẻ{" "}
                    <code>&lt;meta name=&quot;google-site-verification&quot; /&gt;</code>{" "}
                    trên mọi trang public.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Google Analytics 4 Measurement ID
                  </label>
                  <input
                    type="text"
                    value={settings.googleAnalyticsId}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        googleAnalyticsId: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="G-XXXXXXXXXX"
                    className={`w-full rounded-xl border bg-white px-3 py-2 text-xs font-mono dark:bg-slate-950 ${
                      ga4Valid
                        ? "border-slate-200 dark:border-slate-700"
                        : "border-red-400 dark:border-red-600"
                    }`}
                  />
                  <p
                    className={`mt-1 text-[11px] ${
                      ga4Valid ? "text-slate-500" : "text-red-600 font-semibold"
                    }`}
                  >
                    {ga4Valid
                      ? "Để trống nếu chưa bật GA4. Chỉ chấp nhận định dạng G-XXXX để đảm bảo bảo mật."
                      : "Định dạng chưa đúng! Phải bắt đầu bằng G- và chỉ gồm chữ hoa, số (ví dụ G-AB12CD34EF)."}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Live Google & Social Preview */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Xem trước trên Google Search
              </p>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 space-y-1">
                <p className="text-[11px] text-slate-500 truncate">{baseUrl}</p>
                <p className="text-base font-semibold text-blue-700 dark:text-blue-400 leading-snug line-clamp-2">
                  {settings.defaultMetaTitle || "Ôn IELTS"}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                  {settings.defaultMetaDescription}
                </p>
              </div>
            </Card>

            <Card className="p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Xem trước thẻ chia sẻ Facebook / Zalo / X
              </p>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                {settings.defaultOgImage ? (
                  <img
                    src={settings.defaultOgImage}
                    alt={settings.defaultOgImageAlt || settings.defaultMetaTitle}
                    className="h-44 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-36 flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-800 dark:from-emerald-950/60 dark:to-slate-900 dark:text-emerald-300 px-4 text-center">
                    <ImageIcon className="h-7 w-7 opacity-60 mb-1.5" />
                    <p className="text-xs font-semibold">Chưa chọn ảnh OG mặc định</p>
                    <p className="text-[11px] opacity-75">
                      Hãy upload banner 1200×630 ở Media Library để chia sẻ đẹp hơn
                    </p>
                  </div>
                )}
                <div className="p-3.5 space-y-1 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {baseUrl.replace(/^https?:\/\//i, "")}
                  </p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {settings.defaultMetaTitle}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-2">
                    {settings.defaultMetaDescription}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900 text-xs space-y-1.5">
              <p className="font-bold text-emerald-900 dark:text-emerald-300">
                Structured Data (JSON-LD) đang hoạt động tự động:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-emerald-800/90 dark:text-emerald-200/80">
                <li>
                  <code>EducationalOrganization</code> trên toàn trang (kèm Logo &amp; mạng xã hội)
                </li>
                <li>
                  <code>Article</code> + <code>BreadcrumbList</code> trên <code>/blog/[slug]</code>
                </li>
                <li>
                  <code>Course</code> trên <code>/courses/[slug]</code> · <code>VideoObject</code> trên{" "}
                  <code>/videos/[slug]</code>
                </li>
                <li>
                  <code>FAQPage</code> trên <code>/pricing</code> và <code>/legal/faqs</code>
                </li>
              </ul>
            </Card>
          </div>
        </form>
      )}

      {/* TAB 2: 301 / 302 REDIRECT MANAGER */}
      {tab === "redirects" && (
        <div className="space-y-5">
          {/* Add / Edit Form */}
          <Card className="p-5">
            <form onSubmit={handleSubmitRedirect} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {redirectForm.id
                      ? "Đang chỉnh sửa quy tắc Redirect"
                      : "Thêm quy tắc chuyển hướng URL (301 / 302)"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Khi bạn đổi slug của bài Blog, Khóa học, Phát âm IPA hoặc Video, hệ thống cũng tự động thêm 1 dòng 301 tại đây để giữ nguyên thứ hạng Google.
                  </p>
                </div>
                {redirectForm.id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRedirectForm(EMPTY_REDIRECT_FORM)}
                  >
                    Hủy sửa
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-12 items-end">
                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Đường dẫn cũ (Source Path) *
                  </label>
                  <input
                    type="text"
                    required
                    value={redirectForm.source_path}
                    onChange={(e) =>
                      setRedirectForm({
                        ...redirectForm,
                        source_path: e.target.value,
                      })
                    }
                    placeholder="/blog/bai-viet-cu"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Đường dẫn mới (Destination Path) *
                  </label>
                  <input
                    type="text"
                    required
                    value={redirectForm.destination_path}
                    onChange={(e) =>
                      setRedirectForm({
                        ...redirectForm,
                        destination_path: e.target.value,
                      })
                    }
                    placeholder="/blog/bai-viet-moi"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Mã HTTP
                  </label>
                  <select
                    value={redirectForm.status_code}
                    onChange={(e) =>
                      setRedirectForm({
                        ...redirectForm,
                        status_code: Number(e.target.value) as 301 | 302 | 307 | 308,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value={301}>301 (Vĩnh viễn · SEO)</option>
                    <option value={302}>302 (Tạm thời)</option>
                    <option value={307}>307 (Tạm thời · Giữ method)</option>
                    <option value={308}>308 (Vĩnh viễn · Giữ method)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingRedirect}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4" />
                    {savingRedirect
                      ? "Đang lưu..."
                      : redirectForm.id
                      ? "Cập nhật"
                      : "Thêm Redirect"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={redirectForm.is_active}
                    onChange={(e) =>
                      setRedirectForm({
                        ...redirectForm,
                        is_active: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <span>Kích hoạt ngay lập tức trên Next.js Proxy (tối đa 30s đồng bộ cache)</span>
                </label>
                <span>
                  Hệ thống tự chặn vòng lặp &amp; bảo vệ <code>/admin</code>,{" "}
                  <code>/api</code>, <code>/auth</code>.
                </span>
              </div>
            </form>
          </Card>

          {/* Search & List */}
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={redirectSearch}
                  onChange={(e) => setRedirectSearch(e.target.value)}
                  placeholder="Tìm theo đường dẫn cũ hoặc mới..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex items-center gap-1.5">
                {(["all", "active", "inactive"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRedirectFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      redirectFilter === f
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {f === "all"
                      ? `Tất cả (${redirects.length})`
                      : f === "active"
                      ? `Đang bật (${activeRedirectsCount})`
                      : `Đang tắt (${redirects.length - activeRedirectsCount})`}
                  </button>
                ))}
              </div>
            </div>

            {filteredRedirects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800">
                Chưa có quy tắc Redirect nào khớp bộ lọc. Hãy thêm quy tắc ở biểu mẫu phía trên hoặc thử đổi slug một bài Blog bất kỳ để thấy 301 tự động sinh ra tại đây!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-400 dark:border-slate-800">
                      <th className="py-2.5 pr-3">Đường dẫn cũ</th>
                      <th className="py-2.5 px-3">Chuyển tới</th>
                      <th className="py-2.5 px-3">Mã</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                      <th className="py-2.5 pl-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRedirects.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                        <td className="py-3 pr-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {item.source_path}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-700 dark:text-emerald-400">
                          <span className="inline-flex items-center gap-1.5">
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                            {item.destination_path}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <Badge
                            variant={
                              item.status_code === 301 || item.status_code === 308
                                ? "default"
                                : "secondary"
                            }
                          >
                            {item.status_code}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => handleToggleRedirect(item)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                              item.is_active
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {item.is_active ? "Đang bật" : "Đang tắt"}
                          </button>
                        </td>
                        <td className="py-3 pl-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={item.source_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Mở link cũ để kiểm tra redirect trực tiếp"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <button
                              type="button"
                              title="Chỉnh sửa"
                              onClick={() =>
                                setRedirectForm({
                                  id: item.id,
                                  source_path: item.source_path,
                                  destination_path: item.destination_path,
                                  status_code: item.status_code,
                                  is_active: item.is_active,
                                })
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Xóa"
                              onClick={() => setDeleteTarget(item)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:hover:bg-red-950/40 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: SITEMAP, ROBOTS.TXT & SEO HEALTH AUDIT */}
      {tab === "sitemap" && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Dynamic Sitemap Controls */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <FileCode2 className="h-4 w-4 text-emerald-600" />
                  Cấu hình Sitemap động (/sitemap.xml)
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingSettings}
                  onClick={() => handleSaveSettings()}
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingSettings ? "Đang lưu..." : "Lưu Sitemap & Robots"}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Sitemap tự động cập nhật theo thời gian thực từ Supabase và luôn tự loại bỏ các bài nháp hoặc nội dung đang bật <code>noindex</code>.
              </p>

              <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
                {[
                  {
                    key: "sitemapIncludeTests" as const,
                    label: "Kho đề thi IELTS (/tests/*)",
                  },
                  {
                    key: "sitemapIncludeBlog" as const,
                    label: "Bài viết Blog (/blog/*)",
                  },
                  {
                    key: "sitemapIncludeCourses" as const,
                    label: "Khóa học IELTS (/courses/*)",
                  },
                  {
                    key: "sitemapIncludePronunciation" as const,
                    label: "44 âm phát âm IPA (/pronunciation/*)",
                  },
                  {
                    key: "sitemapIncludeVideos" as const,
                    label: "Video tương tác (/videos/*)",
                  },
                  {
                    key: "sitemapIncludeStaticPages" as const,
                    label: "Trang tĩnh & Pháp lý (/about, /legal/*)",
                  },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5 cursor-pointer hover:border-emerald-400 dark:border-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={settings[opt.key]}
                      onChange={(e) =>
                        setSettings({ ...settings, [opt.key]: e.target.checked })
                      }
                      className="h-4 w-4 rounded accent-emerald-600"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </Card>

            {/* Robots.txt Editor & Live Preview */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Cấu hình Robots.txt (/robots.txt)
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  Đường dẫn luôn được bảo vệ tự động (không thể gỡ nhầm):
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PROTECTED_ROBOTS_DISALLOW.map((p) => (
                    <code
                      key={p}
                      className="rounded bg-white px-2 py-0.5 font-mono text-[11px] border border-slate-200 dark:bg-slate-950 dark:border-slate-800"
                    >
                      {p}
                    </code>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Đường dẫn chặn thêm (mỗi dòng 1 đường dẫn, bắt đầu bằng /)
                </label>
                <textarea
                  rows={3}
                  value={disallowText}
                  onChange={(e) => setDisallowText(e.target.value)}
                  placeholder={"/checkout\n/private-preview"}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div>
                <p className="mb-1 text-[11px] font-bold uppercase text-slate-400">
                  Xem trước nội dung /robots.txt
                </p>
                <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3.5 text-[11px] text-emerald-300 font-mono leading-relaxed">
                  {robotsPreview}
                </pre>
              </div>
            </Card>
          </div>

          {/* SEO Health Audit */}
          <Card className="p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Kiểm tra sức khỏe SEO toàn bộ nội dung công khai
                </h2>
                <p className="text-xs text-slate-500">
                  Quét tự động Đề thi, Blog, Khóa học, Video, Phát âm IPA và Trang tĩnh để phát hiện thiếu Meta Description, thiếu ảnh OG hoặc đang đặt noindex.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={refreshingHealth}
                onClick={handleRefreshHealth}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshingHealth ? "animate-spin" : ""}`}
                />
                Quét lại
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-[11px] text-slate-500">Tổng trang nội dung công khai</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {health.totalPublicItems}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Đạt chuẩn SEO tốt
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                  {health.healthyCount}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Cần tối ưu thêm
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {health.needsAttentionCount}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {health.missingDescCount} thiếu mô tả · {health.missingOgImageCount} thiếu ảnh OG
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-[11px] text-slate-500">Đang ẩn khỏi Google (noindex)</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                  {health.noindexCount}
                </p>
              </div>
            </div>

            {/* Issue filter */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "all", label: `Tất cả (${health.issues.length})` },
                { key: "blog", label: "Blog" },
                { key: "test", label: "Đề thi" },
                { key: "course", label: "Khóa học" },
                { key: "pronunciation", label: "Phát âm IPA" },
                { key: "video", label: "Video" },
                { key: "page", label: "Trang tĩnh" },
                { key: "noindex", label: "Đang noindex" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setHealthFilter(f.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                    healthFilter === f.key
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredIssues.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-6 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
                Tuyệt vời! Không có mục nào cần khắc phục trong nhóm này.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{issue.moduleLabel}</Badge>
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {issue.title}
                        </span>
                        <a
                          href={issue.publicPath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[11px] text-slate-400 hover:text-emerald-600 hover:underline"
                        >
                          {issue.publicPath}
                        </a>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {issue.problems.map((prob) => (
                          <span
                            key={prob}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {prob}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Link
                      href={issue.editHref}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-slate-700 dark:text-emerald-400"
                    >
                      Sửa ngay
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Media Picker for Default OG Image / Organization Logo */}
      <MediaPickerModal
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        acceptKind="image"
        defaultFolder="seo"
        title={
          pickerTarget === "og"
            ? "Chọn ảnh OG mặc định (1200×630)"
            : "Chọn Logo Organization (JSON-LD)"
        }
        onSelect={(asset: MediaAsset) => {
          if (pickerTarget === "og") {
            setSettings((prev) => ({
              ...prev,
              defaultOgImage: asset.public_url,
              defaultOgImageAlt: prev.defaultOgImageAlt || asset.alt_text || prev.defaultMetaTitle,
            }));
          } else if (pickerTarget === "logo") {
            setSettings((prev) => ({
              ...prev,
              organizationLogo: asset.public_url,
            }));
          }
          setPickerTarget(null);
        }}
      />

      {/* Delete Redirect Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa quy tắc Redirect?"
        description={
          deleteTarget
            ? `Đường dẫn cũ "${deleteTarget.source_path}" sẽ ngừng chuyển hướng sang "${deleteTarget.destination_path}".`
            : ""
        }
        confirmLabel="Xóa Redirect"
        destructive
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteRedirect}
      />
    </div>
  );
}
