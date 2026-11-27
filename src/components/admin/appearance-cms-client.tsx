"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  CheckCircle2,
  Eye,
  FileText,
  GripVertical,
  History,
  Image as ImageIcon,
  Languages,
  Layout,
  Menu as MenuIcon,
  Palette,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  APPEARANCE_FONTS,
  BORDER_RADIUS_OPTIONS,
  DEFAULT_THEME_CONFIG,
  DEFAULT_UI_TEXT_KEYS,
  buildThemeCssVariables,
  restoreDefaultMenuNames,
  type AppearanceFontId,
  type AppearanceVersionEntry,
  type BorderRadiusPreset,
  type HomeSectionConfig,
  type HomeSectionId,
  type SiteAppearanceConfig,
} from "@/lib/appearance-shared";
import { GA4_ID_REGEX } from "@/lib/seo-cms-shared";
import type { MediaAsset } from "@/lib/types";
import { AppearanceMenusEditor } from "./appearance-menus-editor";
import { MediaPickerModal } from "./media-picker-modal";
import { ConfirmDialog } from "./confirm-dialog";
import { useAdminToast } from "./toast-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AppearanceCmsClientProps {
  initialPublished: SiteAppearanceConfig;
  initialDraft: SiteAppearanceConfig;
  initialHistory: AppearanceVersionEntry[];
  initialHasUnpublished: boolean;
}

type MainTab =
  | "homepage"
  | "theme"
  | "branding"
  | "menus"
  | "footer"
  | "widgets"
  | "analytics"
  | "texts"
  | "history";

type PickerTarget =
  | null
  | "logoLight"
  | "logoDark"
  | "favicon"
  | "popupImage";

const SECTION_DESCRIPTIONS: Record<HomeSectionId, string> = {
  hero: "Khối mở đầu (Hero) + 4 thẻ số liệu thống kê động từ DB",
  testimonials: "Khối 'Ví dụ minh họa lộ trình tự học' (có thể sửa hoặc tắt hoàn toàn)",
  latestTests: "Danh sách Đề thi IELTS mới nhất",
  dailyExam: "Khối CTA Đề thi mỗi ngày (UTC+7) & Top dẫn đầu",
  tools: "Lưới công cụ AI & Tiện ích học tập",
  courses: "Carousel Khóa học IELTS bài bản",
  conversations: "Carousel Hội thoại AI theo chủ đề",
  writingExercises: "Carousel Bài tập nâng cấp câu viết",
  pronunciation: "Carousel Phát âm chuẩn bảng IPA",
  dictation: "Carousel Chép chính tả & Shadowing",
  videos: "Carousel Video học IELTS tương tác",
  featuredBlog: "Carousel Blog & Mẹo thi IELTS nổi bật",
};

function isoToVnLocalInput(iso: string): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const vn = new Date(ms + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 16);
}

function vnLocalInputToIso(val: string): string {
  if (!val) return "";
  const ms = Date.parse(`${val}:00+07:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : "";
}

function moveArr<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const copy = [...arr];
  const [picked] = copy.splice(from, 1);
  copy.splice(to, 0, picked);
  return copy;
}

export function AppearanceCmsClient({
  initialPublished,
  initialDraft,
  initialHistory,
  initialHasUnpublished,
}: AppearanceCmsClientProps) {
  const router = useRouter();
  const toast = useAdminToast();
  const [tab, setTab] = useState<MainTab>("homepage");
  const [config, setConfig] = useState<SiteAppearanceConfig>(initialDraft);
  const [published, setPublished] = useState<SiteAppearanceConfig>(initialPublished);
  const [history, setHistory] = useState<AppearanceVersionEntry[]>(initialHistory);
  const [hasUnpublished, setHasUnpublished] = useState(initialHasUnpublished);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState<
    null | { scope: "all" | "theme" | "menus" | "homepage" | "ui_texts"; label: string }
  >(null);

  // UI Text table filters
  const [textQuery, setTextQuery] = useState("");
  const [newTextKey, setNewTextKey] = useState("");
  const [newTextVi, setNewTextVi] = useState("");
  const [newTextEn, setNewTextEn] = useState("");

  const isDirtyLocal = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(published) || hasUnpublished,
    [config, published, hasUnpublished]
  );

  const themeCssPreview = useMemo(
    () => buildThemeCssVariables(config.theme),
    [config.theme]
  );

  const saveDraft = async (overrideNote?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          config,
          note: overrideNote || note || "Lưu bản nháp Giao diện & Trang chủ",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu nháp thất bại.");
        return false;
      }
      if (data.draft) setConfig(data.draft);
      if (Array.isArray(data.history)) setHistory(data.history);
      setHasUnpublished(true);
      setNote("");
      toast.success("Đã lưu bản Nháp! Bạn có thể bấm 'Xem trước Nháp' trước khi xuất bản.");
      return true;
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          config,
          note: note || "Xuất bản Giao diện & Trang chủ",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Xuất bản thất bại.");
        return;
      }
      if (data.published) setPublished(data.published);
      if (data.draft) setConfig(data.draft);
      if (Array.isArray(data.history)) setHistory(data.history);
      setHasUnpublished(false);
      setNote("");
      toast.success("Đã xuất bản Giao diện & Trang chủ ra toàn bộ website!");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDraftPreview = async () => {
    const saved = await saveDraft("Lưu nháp để xem trước");
    if (!saved) return;
    const res = await fetch("/api/admin/appearance/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    if (res.ok) {
      window.open("/", "_blank", "noopener,noreferrer");
    } else {
      toast.error("Không thể bật chế độ xem trước.");
    }
  };

  const handleRestoreVersion = async (versionId: string, publishNow: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore_version",
          versionId,
          publishNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Khôi phục phiên bản thất bại.");
        return;
      }
      if (data.draft) setConfig(data.draft);
      if (data.published) setPublished(data.published);
      if (Array.isArray(data.history)) setHistory(data.history);
      setHasUnpublished(!publishNow);
      toast.success(
        publishNow
          ? "Đã khôi phục và xuất bản phiên bản đã chọn!"
          : "Đã khôi phục phiên bản vào bản Nháp."
      );
      if (publishNow) router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!confirmReset) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/appearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_defaults",
          scope: confirmReset.scope,
          publishNow: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Khôi phục mặc định thất bại.");
        return;
      }
      if (data.draft) setConfig(data.draft);
      if (Array.isArray(data.history)) setHistory(data.history);
      setHasUnpublished(true);
      toast.success(`Đã khôi phục mặc định (${confirmReset.label}) vào Nháp. Bấm Xuất bản để áp dụng live.`);
      setConfirmReset(null);
    } finally {
      setBusy(false);
    }
  };

  const updateSection = (idx: number, patch: Partial<HomeSectionConfig>) => {
    const next = [...config.homepage.sections];
    next[idx] = { ...next[idx], ...patch };
    setConfig({ ...config, homepage: { sections: next } });
  };

  // Merged rows for UI Text table
  const uiTextRows = useMemo(() => {
    const map = new Map<
      string,
      { key: string; group: string; defaultVi: string; defaultEn: string; vi: string; en: string; isCustom: boolean }
    >();
    for (const def of DEFAULT_UI_TEXT_KEYS) {
      const ov = config.uiTexts[def.key];
      map.set(def.key, {
        key: def.key,
        group: def.group,
        defaultVi: def.defaultVi,
        defaultEn: def.defaultEn,
        vi: ov?.vi ?? def.defaultVi,
        en: ov?.en ?? def.defaultEn,
        isCustom: Boolean(ov && (ov.vi !== def.defaultVi || ov.en !== def.defaultEn)),
      });
    }
    for (const [k, pair] of Object.entries(config.uiTexts)) {
      if (!map.has(k)) {
        map.set(k, {
          key: k,
          group: "Tùy chỉnh",
          defaultVi: "",
          defaultEn: "",
          vi: pair.vi,
          en: pair.en,
          isCustom: true,
        });
      }
    }
    const q = textQuery.trim().toLowerCase();
    return Array.from(map.values()).filter((r) => {
      if (!q) return true;
      return `${r.key} ${r.group} ${r.vi} ${r.en}`.toLowerCase().includes(q);
    });
  }, [config.uiTexts, textQuery]);

  const ga4Valid =
    !config.analytics.googleAnalyticsId ||
    GA4_ID_REGEX.test(config.analytics.googleAnalyticsId.trim());

  return (
    <div className="space-y-5">
      {/* Sticky Top Command Bar */}
      <Card className="sticky top-[7.5rem] z-20 p-4 border-emerald-200/80 bg-white/95 backdrop-blur-md shadow-xs dark:border-emerald-900/60 dark:bg-slate-950/95">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Giao diện &amp; Trang chủ
              </h1>
              <Badge variant={isDirtyLocal ? "secondary" : "default"}>
                {isDirtyLocal ? "Có bản Nháp chưa xuất bản" : "Đang đồng bộ Live"}
              </Badge>
              {config.widgets.maintenance.enabled && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <ShieldAlert className="h-3 w-3" /> Đang bật Bảo trì
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Lưu Nháp, Xem trước an toàn rồi Xuất bản ra toàn bộ website (chỉ Admin).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú phiên bản (tùy chọn)..."
              className="hidden xl:block w-52 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void saveDraft()}
            >
              <Save className="h-3.5 w-3.5" />
              Lưu Nháp
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void handleOpenDraftPreview()}
            >
              <Eye className="h-3.5 w-3.5" />
              Xem trước Nháp
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handlePublish()}
            >
              <Rocket className="h-3.5 w-3.5" />
              {busy ? "Đang xử lý..." : "Xuất bản ngay"}
            </Button>
          </div>
        </div>
      </Card>

      {/* 9-Tab Navigation */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { id: "homepage" as const, label: "Trang chủ", icon: Layout },
          { id: "theme" as const, label: "Theme & Font", icon: Palette },
          { id: "branding" as const, label: "Thương hiệu", icon: Sparkles },
          { id: "menus" as const, label: "Menu (Admin/Header/Footer)", icon: MenuIcon },
          { id: "footer" as const, label: "Footer & MXH", icon: FileText },
          { id: "widgets" as const, label: "Banner · Popup · Chat · 404 · Bảo trì", icon: Bell },
          { id: "analytics" as const, label: "GA4 & Search Console", icon: BarChart3 },
          { id: "texts" as const, label: "Văn bản VI/EN", icon: Languages },
          { id: "history" as const, label: `Lịch sử (${history.length})`, icon: History },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition cursor-pointer ${
                active
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: HOMEPAGE SECTIONS (DRAG-AND-DROP + TOGGLE + LIMIT + COPY)      */}
      {/* ===================================================================== */}
      {tab === "homepage" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Kéo-thả hoặc dùng mũi tên để đổi thứ tự hiển thị các khối trên Trang chủ. Bật/tắt dễ dàng khối{" "}
              <strong>&quot;Ví dụ minh họa lộ trình&quot;</strong> và điều chỉnh số lượng mục hiển thị.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setConfirmReset({ scope: "homepage", label: "Bố cục Trang chủ" })
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Khôi phục mặc định Trang chủ
            </Button>
          </div>

          <div className="space-y-3">
            {config.homepage.sections.map((sec, idx) => (
              <Card
                key={sec.id}
                draggable
                onDragStart={() => setDragSectionIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragSectionIdx !== null && dragSectionIdx !== idx) {
                    setConfig({
                      ...config,
                      homepage: {
                        sections: moveArr(config.homepage.sections, dragSectionIdx, idx),
                      },
                    });
                  }
                  setDragSectionIdx(null);
                }}
                className={`p-4 space-y-3 transition ${
                  sec.enabled ? "" : "opacity-65 bg-slate-50/80 dark:bg-slate-900/40"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <GripVertical className="h-4 w-4 text-slate-400 cursor-grab shrink-0" />
                    <Badge variant="secondary">#{idx + 1}</Badge>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {sec.titleVi}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {SECTION_DESCRIPTIONS[sec.id]}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sec.enabled}
                        onChange={(e) => updateSection(idx, { enabled: e.target.checked })}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      {sec.enabled ? "Đang hiện" : "Đã ẩn"}
                    </label>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() =>
                        setConfig({
                          ...config,
                          homepage: {
                            sections: moveArr(config.homepage.sections, idx, idx - 1),
                          },
                        })
                      }
                      className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === config.homepage.sections.length - 1}
                      onClick={() =>
                        setConfig({
                          ...config,
                          homepage: {
                            sections: moveArr(config.homepage.sections, idx, idx + 1),
                          },
                        })
                      }
                      className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-30 dark:border-slate-700 cursor-pointer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Tiêu đề (VI) *
                    </label>
                    <input
                      type="text"
                      value={sec.titleVi}
                      onChange={(e) => updateSection(idx, { titleVi: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Tiêu đề (EN)
                    </label>
                    <input
                      type="text"
                      value={sec.titleEn}
                      onChange={(e) => updateSection(idx, { titleEn: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Mô tả ngắn (VI)
                    </label>
                    <textarea
                      rows={2}
                      value={sec.subtitleVi}
                      onChange={(e) => updateSection(idx, { subtitleVi: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      Mô tả ngắn (EN)
                    </label>
                    <textarea
                      rows={2}
                      value={sec.subtitleEn}
                      onChange={(e) => updateSection(idx, { subtitleEn: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                </div>

                {/* Section-specific controls */}
                <div className="grid gap-3 sm:grid-cols-4">
                  {sec.id !== "hero" && (
                    <div>
                      <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Số mục hiển thị
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={sec.limit}
                        onChange={(e) =>
                          updateSection(idx, {
                            limit: Math.max(1, Math.min(30, Number(e.target.value) || 4)),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-950"
                      />
                    </div>
                  )}

                  {sec.id === "testimonials" && (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Nhãn minh họa (VI)
                        </label>
                        <input
                          type="text"
                          value={sec.badgeVi ?? ""}
                          onChange={(e) => updateSection(idx, { badgeVi: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Badge (EN)
                        </label>
                        <input
                          type="text"
                          value={sec.badgeEn ?? ""}
                          onChange={(e) => updateSection(idx, { badgeEn: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                    </>
                  )}

                  {(sec.id === "hero" || sec.id === "dailyExam") && (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Nút chính (VI)
                        </label>
                        <input
                          type="text"
                          value={sec.ctaPrimaryVi ?? ""}
                          onChange={(e) => updateSection(idx, { ctaPrimaryVi: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Link nút chính
                        </label>
                        <input
                          type="text"
                          value={sec.ctaPrimaryHref ?? ""}
                          onChange={(e) => updateSection(idx, { ctaPrimaryHref: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Nút phụ (VI)
                        </label>
                        <input
                          type="text"
                          value={sec.ctaSecondaryVi ?? ""}
                          onChange={(e) => updateSection(idx, { ctaSecondaryVi: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Link nút phụ
                        </label>
                        <input
                          type="text"
                          value={sec.ctaSecondaryHref ?? ""}
                          onChange={(e) => updateSection(idx, { ctaSecondaryHref: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                    </>
                  )}

                  {sec.id !== "hero" && sec.id !== "testimonials" && sec.id !== "dailyExam" && (
                    <>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Nhãn nút &quot;Xem tất cả&quot; (VI)
                        </label>
                        <input
                          type="text"
                          value={sec.viewAllLabelVi ?? ""}
                          onChange={(e) => updateSection(idx, { viewAllLabelVi: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          &quot;View all&quot; (EN)
                        </label>
                        <input
                          type="text"
                          value={sec.viewAllLabelEn ?? ""}
                          onChange={(e) => updateSection(idx, { viewAllLabelEn: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: THEME, COLORS, GOOGLE FONTS, BORDER RADIUS, CSS VARIABLES      */}
      {/* ===================================================================== */}
      {tab === "theme" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="p-5 lg:col-span-3 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Màu sắc, Phông chữ &amp; Bo góc (CSS Variables)
              </h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setConfig({
                    ...config,
                    theme: structuredClone(DEFAULT_THEME_CONFIG),
                  })
                }
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Khôi phục mặc định
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { key: "primaryColor" as const, label: "Màu chủ đạo (Primary)" },
                { key: "secondaryColor" as const, label: "Màu phụ (Secondary)" },
                { key: "backgroundLight" as const, label: "Màu nền Sáng (Light BG)" },
                { key: "backgroundDark" as const, label: "Màu nền Tối (Dark BG)" },
              ].map((c) => (
                <div key={c.key}>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {c.label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.theme[c.key]}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          theme: { ...config.theme, [c.key]: e.target.value },
                        })
                      }
                      className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200 p-0.5 dark:border-slate-700"
                    />
                    <input
                      type="text"
                      value={config.theme[c.key]}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          theme: { ...config.theme, [c.key]: e.target.value },
                        })
                      }
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs uppercase dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phông chữ (Google Fonts)
                </label>
                <select
                  value={config.theme.fontFamily}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      theme: {
                        ...config.theme,
                        fontFamily: e.target.value as AppearanceFontId,
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  {APPEARANCE_FONTS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Độ bo góc (Border Radius)
                </label>
                <select
                  value={config.theme.borderRadius}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      theme: {
                        ...config.theme,
                        borderRadius: e.target.value as BorderRadiusPreset,
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  {BORDER_RADIUS_OPTIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chế độ sáng/tối mặc định
                </label>
                <select
                  value={config.theme.defaultColorMode}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      theme: {
                        ...config.theme,
                        defaultColorMode: e.target.value as "light" | "dark" | "system",
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="light">Sáng (Light)</option>
                  <option value="dark">Tối (Dark)</option>
                  <option value="system">Theo thiết bị (System)</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="p-5 lg:col-span-2 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Xem trước trực tiếp &amp; CSS Variables
            </p>
            <div
              className="border border-slate-200 p-5 space-y-3"
              style={{
                backgroundColor: config.theme.backgroundLight,
                borderRadius:
                  BORDER_RADIUS_OPTIONS.find((r) => r.id === config.theme.borderRadius)
                    ?.cssValue ?? "16px",
              }}
            >
              <span
                className="inline-block px-2.5 py-1 text-[11px] font-bold text-white"
                style={{
                  backgroundColor: config.theme.secondaryColor,
                  borderRadius: "999px",
                }}
              >
                {config.theme.fontFamily}
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {config.branding.siteName} — Giao diện xem trước
              </h3>
              <p className="text-xs text-slate-600">{config.branding.taglineVi}</p>
              <div className="flex gap-2">
                <span
                  className="px-3.5 py-1.5 text-xs font-bold text-white"
                  style={{
                    backgroundColor: config.theme.primaryColor,
                    borderRadius:
                      BORDER_RADIUS_OPTIONS.find((r) => r.id === config.theme.borderRadius)
                        ?.cssValue ?? "12px",
                  }}
                >
                  Nút chính
                </span>
                <span
                  className="border px-3.5 py-1.5 text-xs font-bold"
                  style={{
                    borderColor: config.theme.primaryColor,
                    color: config.theme.primaryColor,
                    borderRadius:
                      BORDER_RADIUS_OPTIONS.find((r) => r.id === config.theme.borderRadius)
                        ?.cssValue ?? "12px",
                  }}
                >
                  Nút viền
                </span>
              </div>
            </div>

            <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] text-emerald-300 font-mono leading-relaxed">
              {themeCssPreview}
            </pre>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: BRANDING (LOGO LIGHT / DARK, FAVICON, SITE NAME, SLOGAN)       */}
      {/* ===================================================================== */}
      {tab === "branding" && (
        <Card className="p-5 space-y-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Thương hiệu: Logo Sáng / Tối, Favicon, Tên Website &amp; Slogan
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold">Tên Website *</label>
              <input
                type="text"
                maxLength={60}
                value={config.branding.siteName}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    branding: { ...config.branding, siteName: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Slogan (Tiếng Việt)</label>
              <input
                type="text"
                value={config.branding.taglineVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    branding: { ...config.branding, taglineVi: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Slogan (English)</label>
              <input
                type="text"
                value={config.branding.taglineEn}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    branding: { ...config.branding, taglineEn: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                key: "logoLightUrl" as const,
                picker: "logoLight" as const,
                label: "Logo chế độ Sáng (Light Mode)",
                previewBg: "bg-white border-slate-200",
              },
              {
                key: "logoDarkUrl" as const,
                picker: "logoDark" as const,
                label: "Logo chế độ Tối (Dark Mode)",
                previewBg: "bg-slate-900 border-slate-700",
              },
              {
                key: "faviconUrl" as const,
                picker: "favicon" as const,
                label: "Favicon (biểu tượng tab trình duyệt)",
                previewBg: "bg-slate-50 border-slate-200",
              },
            ].map((item) => (
              <div key={item.key} className="space-y-2">
                <label className="block text-xs font-bold">{item.label}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.branding[item.key]}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        branding: { ...config.branding, [item.key]: e.target.value },
                      })
                    }
                    placeholder="Để trống để dùng mặc định"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPickerTarget(item.picker)}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div
                  className={`flex h-20 items-center justify-center rounded-xl border p-3 ${item.previewBg}`}
                >
                  {config.branding[item.key] ? (
                    <img
                      src={config.branding[item.key]}
                      alt={item.label}
                      className="max-h-12 w-auto object-contain"
                    />
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Đang dùng mặc định Ôn IELTS
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: MENUS (ADMIN SIDEBAR, HEADER PUBLIC, FOOTER PUBLIC)            */}
      {/* ===================================================================== */}
      {tab === "menus" && (
        <AppearanceMenusEditor
          menus={config.menus}
          onChange={(nextMenus) => setConfig({ ...config, menus: nextMenus })}
          onRestoreNames={() => {
            setConfig((prev) => restoreDefaultMenuNames(prev));
            toast.success("Đã khôi phục tên mặc định cho các nhóm và mục mặc định hiện có (giữ nguyên thứ tự).");
          }}
          onResetAllMenus={() =>
            setConfirmReset({
              scope: "menus",
              label: "Toàn bộ menu mặc định (Sidebar Admin, Header & Footer)",
            })
          }
        />
      )}

      {/* ===================================================================== */}
      {/* TAB 5: FOOTER CONTENT, CONTACT & SOCIALS                              */}
      {/* ===================================================================== */}
      {tab === "footer" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Mô tả Footer, Bản quyền &amp; Miễn trừ trách nhiệm
            </h2>
            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold">Mô tả ngắn (VI)</label>
                <textarea
                  rows={2}
                  value={config.footer.descriptionVi}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: { ...config.footer, descriptionVi: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Description (EN)</label>
                <textarea
                  rows={2}
                  value={config.footer.descriptionEn}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: { ...config.footer, descriptionEn: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Miễn trừ trách nhiệm (VI)</label>
                <textarea
                  rows={3}
                  value={config.footer.disclaimerVi}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: { ...config.footer, disclaimerVi: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Disclaimer (EN)</label>
                <textarea
                  rows={2}
                  value={config.footer.disclaimerEn}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: { ...config.footer, disclaimerEn: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Bản quyền (VI, hỗ trợ {"{year}"})</label>
                  <input
                    type="text"
                    value={config.footer.copyrightVi}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        footer: { ...config.footer, copyrightVi: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Copyright (EN)</label>
                  <input
                    type="text"
                    value={config.footer.copyrightEn}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        footer: { ...config.footer, copyrightEn: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Liên hệ &amp; Mạng xã hội (đồng bộ với Cài đặt chung)
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold">Email hỗ trợ</label>
                <input
                  type="email"
                  value={config.footer.email}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: { ...config.footer, email: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Điện thoại / Hotline</label>
                <input
                  type="text"
                  value={config.footer.phone}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: { ...config.footer, phone: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">Địa chỉ</label>
              <input
                type="text"
                value={config.footer.address}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    footer: { ...config.footer, address: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {[
                { key: "socialYoutube" as const, label: "YouTube Channel", ph: "https://youtube.com/@onielts" },
                { key: "socialFacebook" as const, label: "Facebook Page", ph: "https://facebook.com/onielts.vn" },
                { key: "socialTiktok" as const, label: "TikTok Profile", ph: "https://tiktok.com/@onielts" },
                { key: "socialZalo" as const, label: "Zalo OA / Nhóm", ph: "https://zalo.me/..." },
              ].map((s) => (
                <div key={s.key}>
                  <label className="mb-1 block text-xs font-bold">{s.label}</label>
                  <input
                    type="url"
                    value={config.footer[s.key]}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        footer: { ...config.footer, [s.key]: e.target.value },
                      })
                    }
                    placeholder={s.ph}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Để bật/tắt từng cột link ở Footer hoặc thêm/sửa link trong cột, chuyển sang tab{" "}
              <button
                type="button"
                onClick={() => setTab("menus")}
                className="font-bold text-emerald-700 underline cursor-pointer"
              >
                Menu → Cột Link Footer Public
              </button>
              .
            </p>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: BANNER, POPUP, FLOATING CHAT, COOKIE, 404 & MAINTENANCE        */}
      {/* ===================================================================== */}
      {tab === "widgets" && (
        <div className="space-y-5">
          {/* 6.1 Top Banner */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                1. Thanh Banner thông báo trên cùng (có hẹn giờ bắt đầu – kết thúc)
              </h2>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.widgets.topBanner.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        topBanner: { ...config.widgets.topBanner, enabled: e.target.checked },
                      },
                    })
                  }
                  className="h-4 w-4 accent-emerald-600"
                />
                Bật Banner
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={config.widgets.topBanner.textVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      topBanner: { ...config.widgets.topBanner, textVi: e.target.value },
                    },
                  })
                }
                placeholder="Nội dung thông báo (VI)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                value={config.widgets.topBanner.textEn}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      topBanner: { ...config.widgets.topBanner, textEn: e.target.value },
                    },
                  })
                }
                placeholder="Banner text (EN)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold">Đường dẫn khi bấm</label>
                <input
                  type="text"
                  value={config.widgets.topBanner.href}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        topBanner: { ...config.widgets.topBanner, href: e.target.value },
                      },
                    })
                  }
                  placeholder="/pricing"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold">Bắt đầu (Giờ VN · tùy chọn)</label>
                <input
                  type="datetime-local"
                  value={isoToVnLocalInput(config.widgets.topBanner.startsAt)}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        topBanner: {
                          ...config.widgets.topBanner,
                          startsAt: vnLocalInputToIso(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold">Kết thúc (Giờ VN · tùy chọn)</label>
                <input
                  type="datetime-local"
                  value={isoToVnLocalInput(config.widgets.topBanner.endsAt)}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        topBanner: {
                          ...config.widgets.topBanner,
                          endsAt: vnLocalInputToIso(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold">Màu nền Banner</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.widgets.topBanner.bgColor}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        widgets: {
                          ...config.widgets,
                          topBanner: { ...config.widgets.topBanner, bgColor: e.target.value },
                        },
                      })
                    }
                    className="h-8 w-10 rounded border"
                  />
                  <span className="font-mono text-xs">{config.widgets.topBanner.bgColor}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* 6.2 Popup Notice */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                2. Popup thông báo nổi (có lịch chạy &amp; giới hạn tần suất)
              </h2>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.widgets.popup.enabled}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        popup: { ...config.widgets.popup, enabled: e.target.checked },
                      },
                    })
                  }
                  className="h-4 w-4 accent-emerald-600"
                />
                Bật Popup
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                value={config.widgets.popup.titleVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      popup: { ...config.widgets.popup, titleVi: e.target.value },
                    },
                  })
                }
                placeholder="Tiêu đề Popup (VI)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                value={config.widgets.popup.titleEn}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      popup: { ...config.widgets.popup, titleEn: e.target.value },
                    },
                  })
                }
                placeholder="Popup title (EN)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <textarea
                rows={2}
                value={config.widgets.popup.bodyVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      popup: { ...config.widgets.popup, bodyVi: e.target.value },
                    },
                  })
                }
                placeholder="Nội dung Popup (VI)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <textarea
                rows={2}
                value={config.widgets.popup.bodyEn}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      popup: { ...config.widgets.popup, bodyEn: e.target.value },
                    },
                  })
                }
                placeholder="Popup body (EN)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={config.widgets.popup.imageUrl}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        popup: { ...config.widgets.popup, imageUrl: e.target.value },
                      },
                    })
                  }
                  placeholder="Ảnh Popup (tùy chọn)"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPickerTarget("popupImage")}
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <input
                type="text"
                value={config.widgets.popup.ctaLabelVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      popup: { ...config.widgets.popup, ctaLabelVi: e.target.value },
                    },
                  })
                }
                placeholder="Nhãn nút CTA (VI)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                value={config.widgets.popup.ctaHref}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      popup: { ...config.widgets.popup, ctaHref: e.target.value },
                    },
                  })
                }
                placeholder="/pricing"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <select
                value={config.widgets.popup.frequency}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      popup: {
                        ...config.widgets.popup,
                        frequency: e.target.value as "once_per_session" | "once_per_day",
                      },
                    },
                  })
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="once_per_day">1 lần / ngày</option>
                <option value="once_per_session">1 lần / phiên trình duyệt</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold">Bắt đầu hiện (Giờ VN)</label>
                <input
                  type="datetime-local"
                  value={isoToVnLocalInput(config.widgets.popup.startsAt)}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        popup: {
                          ...config.widgets.popup,
                          startsAt: vnLocalInputToIso(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold">Kết thúc hiện (Giờ VN)</label>
                <input
                  type="datetime-local"
                  value={isoToVnLocalInput(config.widgets.popup.endsAt)}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        popup: {
                          ...config.widgets.popup,
                          endsAt: vnLocalInputToIso(e.target.value),
                        },
                      },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
          </Card>

          {/* 6.3 Floating Chat & Cookie Banner */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  3. Nút Chat nổi (Messenger / Zalo)
                </h2>
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.widgets.floatingChat.enabled}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        widgets: {
                          ...config.widgets,
                          floatingChat: {
                            ...config.widgets.floatingChat,
                            enabled: e.target.checked,
                          },
                        },
                      })
                    }
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Bật nút Chat
                </label>
              </div>
              <input
                type="url"
                value={config.widgets.floatingChat.messengerUrl}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      floatingChat: {
                        ...config.widgets.floatingChat,
                        messengerUrl: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Messenger URL (VD: https://m.me/onielts.vn)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="url"
                value={config.widgets.floatingChat.zaloUrl}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      floatingChat: {
                        ...config.widgets.floatingChat,
                        zaloUrl: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Zalo URL (VD: https://zalo.me/0909123456)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  4. Cookie Banner
                </h2>
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.widgets.cookieBanner.enabled}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        widgets: {
                          ...config.widgets,
                          cookieBanner: {
                            ...config.widgets.cookieBanner,
                            enabled: e.target.checked,
                          },
                        },
                      })
                    }
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Bật Cookie Banner
                </label>
              </div>
              <textarea
                rows={2}
                value={config.widgets.cookieBanner.textVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      cookieBanner: {
                        ...config.widgets.cookieBanner,
                        textVi: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Thông báo cookie (VI)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={config.widgets.cookieBanner.acceptLabelVi}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        cookieBanner: {
                          ...config.widgets.cookieBanner,
                          acceptLabelVi: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="Nút đồng ý (VI)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={config.widgets.cookieBanner.policyHref}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        cookieBanner: {
                          ...config.widgets.cookieBanner,
                          policyHref: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="/legal/privacy"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </Card>
          </div>

          {/* 6.4 404 Page & Maintenance Mode */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                5. Nội dung Trang lỗi 404 (/not-found)
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={config.widgets.notFoundPage.titleVi}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        notFoundPage: {
                          ...config.widgets.notFoundPage,
                          titleVi: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="Tiêu đề 404 (VI)"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="text"
                  value={config.widgets.notFoundPage.buttonLabelVi}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      widgets: {
                        ...config.widgets,
                        notFoundPage: {
                          ...config.widgets.notFoundPage,
                          buttonLabelVi: e.target.value,
                        },
                      },
                    })
                  }
                  placeholder="Nhãn nút về trang chủ"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <textarea
                rows={2}
                value={config.widgets.notFoundPage.descriptionVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      notFoundPage: {
                        ...config.widgets.notFoundPage,
                        descriptionVi: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Mô tả 404 (VI)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </Card>

            <Card
              className={`p-5 space-y-3 border-2 ${
                config.widgets.maintenance.enabled
                  ? "border-amber-400 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/20"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  6. Chế độ Bảo trì (Admin vẫn truy cập bình thường)
                </h2>
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.widgets.maintenance.enabled}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        widgets: {
                          ...config.widgets,
                          maintenance: {
                            ...config.widgets.maintenance,
                            enabled: e.target.checked,
                          },
                        },
                      })
                    }
                    className="h-4 w-4 accent-amber-600"
                  />
                  {config.widgets.maintenance.enabled ? "ĐANG BẬT BẢO TRÌ" : "Tắt"}
                </label>
              </div>
              <input
                type="text"
                value={config.widgets.maintenance.titleVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      maintenance: {
                        ...config.widgets.maintenance,
                        titleVi: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Tiêu đề bảo trì (VI)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
              />
              <textarea
                rows={2}
                value={config.widgets.maintenance.messageVi}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      maintenance: {
                        ...config.widgets.maintenance,
                        messageVi: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Thông báo bảo trì gửi học viên (VI)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                value={config.widgets.maintenance.expectedReturnText}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    widgets: {
                      ...config.widgets,
                      maintenance: {
                        ...config.widgets.maintenance,
                        expectedReturnText: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Thời gian dự kiến mở lại (VD: 22:00 hôm nay)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </Card>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: ANALYTICS EMBED (STRICTLY GA4 & SEARCH CONSOLE ONLY)           */}
      {/* ===================================================================== */}
      {tab === "analytics" && (
        <Card className="p-5 space-y-4 max-w-3xl">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Mã nhúng đo lường an toàn (Chỉ Google Analytics 4 &amp; Google Search Console)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Để bảo mật tuyệt đối (chống XSS), hệ thống <strong>không cho phép dán mã &lt;script&gt; tùy ý</strong> — chỉ nhận đúng mã định danh GA4 và mã xác minh Search Console, tự đồng bộ với mục SEO toàn trang.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold">
                Google Analytics 4 Measurement ID
              </label>
              <input
                type="text"
                value={config.analytics.googleAnalyticsId}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    analytics: {
                      ...config.analytics,
                      googleAnalyticsId: e.target.value.toUpperCase(),
                    },
                  })
                }
                placeholder="G-XXXXXXXXXX"
                className={`w-full rounded-xl border bg-white px-3 py-2 font-mono text-xs dark:bg-slate-950 ${
                  ga4Valid ? "border-slate-200 dark:border-slate-700" : "border-red-400"
                }`}
              />
              {!ga4Valid && (
                <p className="mt-1 text-[11px] font-semibold text-red-600">
                  Mã GA4 phải có dạng G-XXXXXXXXXX (chỉ chữ hoa và số).
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold">
                Google Search Console Verification Token
              </label>
              <input
                type="text"
                value={config.analytics.googleSiteVerification}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    analytics: {
                      ...config.analytics,
                      googleSiteVerification: e.target.value,
                    },
                  })
                }
                placeholder="Chuỗi content=... (không dán cả thẻ <meta>)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 8: UI TEXTS TABLE (VI / EN KEY -> VALUE)                          */}
      {/* ===================================================================== */}
      {tab === "texts" && (
        <div className="space-y-4">
          <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                placeholder="Tìm theo key (VD: home.ctaPrimary) hoặc nội dung..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setConfirmReset({ scope: "ui_texts", label: "Toàn bộ văn bản giao diện" })
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Xóa toàn bộ ghi đè văn bản
            </Button>
          </Card>

          {/* Add custom key row */}
          <Card className="p-4 space-y-2.5">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Thêm key văn bản giao diện mới (VD: <code>footer.resources</code>)
            </p>
            <div className="grid gap-2 sm:grid-cols-12">
              <input
                type="text"
                value={newTextKey}
                onChange={(e) => setNewTextKey(e.target.value)}
                placeholder="key.duong.dan"
                className="sm:col-span-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                value={newTextVi}
                onChange={(e) => setNewTextVi(e.target.value)}
                placeholder="Nội dung tiếng Việt"
                className="sm:col-span-4 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                value={newTextEn}
                onChange={(e) => setNewTextEn(e.target.value)}
                placeholder="English text"
                className="sm:col-span-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <Button
                type="button"
                size="sm"
                className="sm:col-span-2"
                onClick={() => {
                  const k = newTextKey.trim();
                  if (!/^[a-zA-Z0-9._-]+$/.test(k)) {
                    toast.error("Key chỉ gồm chữ, số, dấu chấm và gạch ngang.");
                    return;
                  }
                  setConfig({
                    ...config,
                    uiTexts: {
                      ...config.uiTexts,
                      [k]: { vi: newTextVi.trim(), en: newTextEn.trim() || newTextVi.trim() },
                    },
                  });
                  setNewTextKey("");
                  setNewTextVi("");
                  setNewTextEn("");
                  toast.success(`Đã thêm key "${k}".`);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Thêm key
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-2.5">Key &amp; Nhóm</th>
                    <th className="px-4 py-2.5">Tiếng Việt (VI)</th>
                    <th className="px-4 py-2.5">Tiếng Anh (EN)</th>
                    <th className="px-4 py-2.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {uiTextRows.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-2.5 align-top whitespace-nowrap">
                        <p className="font-mono font-bold text-slate-900 dark:text-white">
                          {row.key}
                        </p>
                        <div className="mt-1 flex items-center gap-1">
                          <Badge variant="secondary">{row.group}</Badge>
                          {row.isCustom && <Badge variant="default">Đã sửa</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={row.vi}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              uiTexts: {
                                ...config.uiTexts,
                                [row.key]: { vi: e.target.value, en: row.en },
                              },
                            })
                          }
                          className="w-full min-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={row.en}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              uiTexts: {
                                ...config.uiTexts,
                                [row.key]: { vi: row.vi, en: e.target.value },
                              },
                            })
                          }
                          className="w-full min-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {config.uiTexts[row.key] && (
                          <button
                            type="button"
                            title="Khôi phục mặc định key này"
                            onClick={() => {
                              const nextTexts = { ...config.uiTexts };
                              delete nextTexts[row.key];
                              setConfig({ ...config, uiTexts: nextTexts });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" /> Mặc định
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 9: VERSION HISTORY & RESTORE                                      */}
      {/* ===================================================================== */}
      {tab === "history" && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Lịch sử phiên bản Giao diện &amp; Trang chủ (tối đa 20 bản gần nhất)
              </h2>
              <p className="text-xs text-slate-500">
                Mỗi lần Lưu Nháp hoặc Xuất bản đều tự động lưu bản sao lưu để bạn khôi phục bất cứ lúc nào.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setConfirmReset({ scope: "all", label: "TOÀN BỘ Giao diện & Trang chủ" })
              }
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Khôi phục toàn bộ mặc định gốc
            </Button>
          </div>

          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800">
              Chưa có lịch sử phiên bản nào. Bấm <strong>Lưu Nháp</strong> hoặc <strong>Xuất bản ngay</strong> để tạo phiên bản đầu tiên.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((entry) => (
                <div
                  key={entry.versionId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={entry.action === "publish" ? "default" : "secondary"}
                      >
                        {entry.action === "publish"
                          ? "Đã xuất bản"
                          : entry.action === "draft"
                          ? "Bản nháp"
                          : "Khôi phục"}
                      </Badge>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {entry.note}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500">
                      {entry.versionId} · {entry.actorEmail} ·{" "}
                      {new Date(entry.savedAt).toLocaleString("vi-VN", {
                        timeZone: "Asia/Ho_Chi_Minh",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleRestoreVersion(entry.versionId, false)}
                    >
                      Nạp về Nháp
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleRestoreVersion(entry.versionId, true)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Khôi phục &amp; Xuất bản
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        open={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        acceptKind="image"
        defaultFolder="branding"
        title="Chọn ảnh từ Thư viện Media"
        onSelect={(asset: MediaAsset) => {
          if (pickerTarget === "logoLight") {
            setConfig((prev) => ({
              ...prev,
              branding: { ...prev.branding, logoLightUrl: asset.public_url },
            }));
          } else if (pickerTarget === "logoDark") {
            setConfig((prev) => ({
              ...prev,
              branding: { ...prev.branding, logoDarkUrl: asset.public_url },
            }));
          } else if (pickerTarget === "favicon") {
            setConfig((prev) => ({
              ...prev,
              branding: { ...prev.branding, faviconUrl: asset.public_url },
            }));
          } else if (pickerTarget === "popupImage") {
            setConfig((prev) => ({
              ...prev,
              widgets: {
                ...prev.widgets,
                popup: { ...prev.widgets.popup, imageUrl: asset.public_url },
              },
            }));
          }
          setPickerTarget(null);
        }}
      />

      {/* Reset Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(confirmReset)}
        title="Khôi phục cấu hình mặc định?"
        description={`Khôi phục "${confirmReset?.label ?? ""}" về trạng thái mặc định ban đầu trong bản Nháp (bạn vẫn có thể xem trước trước khi Xuất bản).`}
        confirmLabel="Khôi phục về Nháp"
        destructive={false}
        loading={busy}
        onCancel={() => setConfirmReset(null)}
        onConfirm={handleConfirmReset}
      />
    </div>
  );
}
