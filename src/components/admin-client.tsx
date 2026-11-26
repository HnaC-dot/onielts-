"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BookOpen,
  Calculator,
  CheckCircle2,
  CreditCard,
  FileText,
  Lock,
  Plus,
  Save,
  Unlock,
  Users,
} from "lucide-react";
import type {
  AiUsageLog,
  BandConversionRow,
  BlogPost,
  IeltsTest,
  OrderRecord,
  PricingPlan,
  PromoBanner,
  PromoCode,
  UserProfile,
  UserRole,
} from "@/lib/types";
import { formatVnd } from "@/lib/utils";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useAdminToast } from "./admin/toast-provider";
import { ConfirmDialog } from "./admin/confirm-dialog";

export type AdminLegacyTab =
  | "ai"
  | "bands"
  | "pricing"
  | "tests"
  | "content"
  | "users";

interface AdminClientProps {
  profiles: UserProfile[];
  bandRows: BandConversionRow[];
  plans: PricingPlan[];
  banner: PromoBanner;
  promoCodes: PromoCode[];
  orders: OrderRecord[];
  aiLogs: AiUsageLog[];
  tests: IeltsTest[];
  blogPosts: BlogPost[];
  initialTab?: AdminLegacyTab;
  userRole?: "admin" | "editor";
  currentUserId?: string;
}

interface PendingConfirm {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  payload: Record<string, unknown>;
  successMsg: string;
}

const SAMPLE_TEST_JSON = JSON.stringify(
  {
    slug: "custom-reading-demo-04",
    skill: "reading",
    module: "academic",
    title_vi: "Reading Academic 04: Nông nghiệp thông minh (Admin Demo)",
    title_en: "Academic Reading 04: Smart Agriculture",
    duration_minutes: 60,
    difficulty: "band_6_7",
    is_daily_eligible: false,
    sections: [
      {
        id: "c4-s1",
        title: "Passage 1: Precision Irrigation Sensors",
        passage:
          "Modern soil-moisture probes allow Mekong Delta orchards to halve freshwater pumping while preserving fruit sweetness.",
        questions: [
          {
            id: "c4-q1",
            number: 1,
            type: "tfng",
            prompt: "Soil-moisture probes reduce freshwater pumping in orchards.",
            options: ["TRUE", "FALSE", "NOT GIVEN"],
            correctAnswers: ["TRUE"],
            explanation_vi: "Bài đọc ghi cảm biến giúp giảm một nửa lượng nước bơm.",
            explanation_en: "The passage states probes allow orchards to halve freshwater pumping.",
          },
        ],
      },
    ],
  },
  null,
  2
);

export function AdminClient(props: AdminClientProps) {
  const router = useRouter();
  const toast = useAdminToast();
  const isAdmin = (props.userRole ?? "admin") === "admin";
  const defaultTab: AdminLegacyTab = props.initialTab ?? (isAdmin ? "ai" : "tests");
  const [tab, setTab] = useState<AdminLegacyTab>(defaultTab);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Band table filter
  const [bandSkill, setBandSkill] = useState<"listening" | "reading_academic" | "reading_general">(
    "reading_academic"
  );
  const [bandDrafts, setBandDrafts] = useState<Record<string, { min: number; max: number; band: number }>>(
    () =>
      Object.fromEntries(
        props.bandRows.map((r) => [r.id, { min: r.min_raw, max: r.max_raw, band: r.band_score }])
      )
  );

  // Pricing & Banner state
  const [bannerTitleVi, setBannerTitleVi] = useState(props.banner.title_vi);
  const [bannerTitleEn, setBannerTitleEn] = useState(props.banner.title_en);
  const [bannerEndsAt, setBannerEndsAt] = useState(props.banner.ends_at.slice(0, 16));
  const [bannerActive, setBannerActive] = useState(props.banner.is_active);
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newPromoPct, setNewPromoPct] = useState(15);

  // Plan price drafts
  const [planDrafts, setPlanDrafts] = useState<
    Record<string, { price: number; original: number; popular: boolean; active: boolean }>
  >(() =>
    Object.fromEntries(
      props.plans.map((p) => [
        p.id,
        {
          price: p.price_vnd,
          original: p.original_price_vnd,
          popular: p.is_popular,
          active: p.is_active,
        },
      ])
    )
  );

  // Test JSON creator
  const [testJson, setTestJson] = useState(SAMPLE_TEST_JSON);

  // New blog post
  const [blogTitle, setBlogTitle] = useState("");
  const [blogCategory, setBlogCategory] = useState("Chiến thuật IELTS");
  const [blogExcerpt, setBlogExcerpt] = useState("");
  const [blogContent, setBlogContent] = useState("");

  const callAdmin = async (payload: Record<string, unknown>, successMsg: string) => {
    setNotice("");
    setError("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error || "Thao tác thất bại.";
      setError(msg);
      toast.error(msg);
      return false;
    }
    setNotice(successMsg);
    toast.success(successMsg);
    router.refresh();
    return true;
  };

  // AI cost aggregations
  const aiStats = useMemo(() => {
    const totalCalls = props.aiLogs.length;
    const cachedCalls = props.aiLogs.filter((l) => l.cached).length;
    const totalTokens = props.aiLogs.reduce((acc, l) => acc + l.total_tokens, 0);
    const totalCostUsd = props.aiLogs.reduce((acc, l) => acc + l.estimated_cost_usd, 0);
    const byFeature: Record<string, { calls: number; tokens: number; usd: number }> = {};
    for (const log of props.aiLogs) {
      if (!byFeature[log.feature]) byFeature[log.feature] = { calls: 0, tokens: 0, usd: 0 };
      byFeature[log.feature].calls += 1;
      byFeature[log.feature].tokens += log.total_tokens;
      byFeature[log.feature].usd += log.estimated_cost_usd;
    }
    return { totalCalls, cachedCalls, totalTokens, totalCostUsd, byFeature };
  }, [props.aiLogs]);

  const allTabs: ReadonlyArray<{
    id: AdminLegacyTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }> = [
    { id: "ai", label: "Chi phí & Token AI", icon: Activity },
    { id: "bands", label: "Bảng quy đổi Band", icon: Calculator, adminOnly: true },
    { id: "pricing", label: "Bảng giá & Khuyến mãi", icon: CreditCard, adminOnly: true },
    { id: "tests", label: "Quản lý Đề thi", icon: BookOpen },
    { id: "content", label: "Nội dung / Blog", icon: FileText },
    { id: "users", label: "Người dùng & Đơn hàng", icon: Users, adminOnly: true },
  ];

  const tabs = allTabs.filter((item) => isAdmin || !item.adminOnly);

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                tab === item.id
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {/* TAB 1: AI COST TRACKING */}
      {tab === "ai" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-xs text-slate-500">Tổng lượt gọi AI</p>
              <p className="mt-1 text-3xl font-bold">{aiStats.totalCalls}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-slate-500">Tỉ lệ trúng Cache</p>
              <p className="mt-1 text-3xl font-bold text-emerald-600">
                {aiStats.totalCalls > 0
                  ? `${Math.round((aiStats.cachedCalls / aiStats.totalCalls) * 100)}%`
                  : "0%"}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-slate-500">Tổng Token tiêu thụ</p>
              <p className="mt-1 text-3xl font-bold">
                {aiStats.totalTokens.toLocaleString("vi-VN")}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs text-slate-500">Ước tính chi phí Gemini</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                ${aiStats.totalCostUsd.toFixed(4)}
              </p>
              <p className="text-[11px] text-slate-500">
                ≈ {formatVnd(Math.round(aiStats.totalCostUsd * 25500))}
              </p>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-base font-bold">Thống kê theo tính năng AI</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="py-2">Tính năng</th>
                    <th className="py-2">Số lượt</th>
                    <th className="py-2">Token</th>
                    <th className="py-2">Chi phí ước tính (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(aiStats.byFeature).map(([feat, s]) => (
                    <tr key={feat}>
                      <td className="py-2.5 font-mono font-semibold">{feat}</td>
                      <td className="py-2.5">{s.calls}</td>
                      <td className="py-2.5">{s.tokens.toLocaleString("vi-VN")}</td>
                      <td className="py-2.5 text-emerald-700 dark:text-emerald-400">
                        ${s.usd.toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: BAND CONVERSION TABLES EDITOR */}
      {tab === "bands" && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">Chỉnh sửa bảng quy đổi câu đúng → Band điểm</h2>
              <p className="text-xs text-slate-500">
                Mọi thay đổi được áp dụng trực tiếp cho Công cụ Tính Band và Phòng thi IELTS.
              </p>
            </div>
            <div className="flex gap-2">
              {(["reading_academic", "reading_general", "listening"] as const).map((sk) => (
                <button
                  key={sk}
                  type="button"
                  onClick={() => setBandSkill(sk)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${
                    bandSkill === sk
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {sk}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2">Min Raw</th>
                  <th className="py-2">Max Raw</th>
                  <th className="py-2">Band Score</th>
                  <th className="py-2">Lưu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {props.bandRows
                  .filter((r) => r.skill === bandSkill)
                  .sort((a, b) => b.band_score - a.band_score)
                  .map((row) => {
                    const draft = bandDrafts[row.id] ?? {
                      min: row.min_raw,
                      max: row.max_raw,
                      band: row.band_score,
                    };
                    return (
                      <tr key={row.id}>
                        <td className="py-2">
                          <input
                            type="number"
                            min={0}
                            max={40}
                            value={draft.min}
                            onChange={(e) =>
                              setBandDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, min: Number(e.target.value) },
                              }))
                            }
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </td>
                        <td className="py-2">
                          <input
                            type="number"
                            min={0}
                            max={40}
                            value={draft.max}
                            onChange={(e) =>
                              setBandDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, max: Number(e.target.value) },
                              }))
                            }
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </td>
                        <td className="py-2">
                          <input
                            type="number"
                            step={0.5}
                            min={0}
                            max={9}
                            value={draft.band}
                            onChange={(e) =>
                              setBandDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, band: Number(e.target.value) },
                              }))
                            }
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-bold text-emerald-700 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void callAdmin(
                                {
                                  action: "update_band_row",
                                  id: row.id,
                                  min_raw: draft.min,
                                  max_raw: draft.max,
                                  band_score: draft.band,
                                },
                                `Đã cập nhật mức Band ${draft.band} (${draft.min}–${draft.max} câu).`
                              )
                            }
                          >
                            <Save className="h-3.5 w-3.5" />
                            Lưu
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: PRICING, COUNTDOWN BANNER & PROMO CODES */}
      {tab === "pricing" && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold">Chỉnh sửa Gói Premium (1 / 3 / 6 / 12 tháng)</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {props.plans.map((p) => {
                const d = planDrafts[p.id];
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 p-4 space-y-3 text-xs dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{p.name_vi}</span>
                      <Badge>{p.duration_months} tháng</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-500">Giá bán (VND)</label>
                        <input
                          type="number"
                          value={d.price}
                          onChange={(e) =>
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [p.id]: { ...d, price: Number(e.target.value) },
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="text-slate-500">Giá gốc gạch ngang</label>
                        <input
                          type="number"
                          value={d.original}
                          onChange={(e) =>
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [p.id]: { ...d, original: Number(e.target.value) },
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={d.popular}
                          onChange={(e) =>
                            setPlanDrafts((prev) => ({
                              ...prev,
                              [p.id]: { ...d, popular: e.target.checked },
                            }))
                          }
                        />
                        Nhãn &ldquo;Phổ biến nhất&rdquo;
                      </label>
                      <Button
                        size="sm"
                        onClick={() =>
                          void callAdmin(
                            {
                              action: "update_plan",
                              id: p.id,
                              price_vnd: d.price,
                              original_price_vnd: d.original,
                              is_popular: d.popular,
                              is_active: d.active,
                            },
                            `Đã lưu giá ${p.name_vi}!`
                          )
                        }
                      >
                        <Save className="h-3.5 w-3.5" /> Lưu gói
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6 space-y-3 text-xs">
              <h3 className="text-base font-bold">Banner đếm ngược khuyến mãi</h3>
              <input
                type="text"
                placeholder="Tiêu đề tiếng Việt"
                value={bannerTitleVi}
                onChange={(e) => setBannerTitleVi(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="English banner title"
                value={bannerTitleEn}
                onChange={(e) => setBannerTitleEn(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="datetime-local"
                value={bannerEndsAt}
                onChange={(e) => setBannerEndsAt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerActive}
                  onChange={(e) => setBannerActive(e.target.checked)}
                />
                Hiển thị banner đếm ngược trên trang Bảng giá
              </label>
              <Button
                size="sm"
                onClick={() =>
                  void callAdmin(
                    {
                      action: "update_promo_banner",
                      title_vi: bannerTitleVi,
                      title_en: bannerTitleEn,
                      ends_at: new Date(bannerEndsAt).toISOString(),
                      is_active: bannerActive,
                    },
                    "Đã cập nhật Banner đếm ngược!"
                  )
                }
              >
                Lưu Banner
              </Button>
            </Card>

            <Card className="p-6 space-y-3 text-xs">
              <h3 className="text-base font-bold">Quản lý Mã giảm giá</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Mã mới (vd: TET2027)"
                  value={newPromoCode}
                  onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 uppercase dark:border-slate-700 dark:bg-slate-950"
                />
                <input
                  type="number"
                  min={5}
                  max={80}
                  value={newPromoPct}
                  onChange={(e) => setNewPromoPct(Number(e.target.value))}
                  className="w-20 rounded-xl border border-slate-200 px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!newPromoCode.trim()) return;
                    void callAdmin(
                      {
                        action: "create_promo_code",
                        code: newPromoCode.trim(),
                        discount_percent: newPromoPct,
                        max_discount_vnd: 300000,
                      },
                      `Đã tạo mã ${newPromoCode}!`
                    );
                    setNewPromoCode("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Thêm
                </Button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {props.promoCodes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <div>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {c.code}
                      </span>{" "}
                      (-{c.discount_percent}% · đã dùng {c.current_uses})
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void callAdmin(
                          { action: "toggle_promo_code", id: c.id, is_active: !c.is_active },
                          `Đã cập nhật trạng thái mã ${c.code}`
                        )
                      }
                    >
                      {c.is_active ? "Đang bật" : "Đã tắt"}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: TESTS MANAGER + JSON SCHEMA CREATOR */}
      {tab === "tests" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="p-6 lg:col-span-6 space-y-3">
            <h2 className="text-base font-bold">Danh sách đề thi ({props.tests.length})</h2>
            <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {props.tests.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                  <div className="min-w-0">
                    <Badge variant="secondary">{t.skill}</Badge>
                    <p className="mt-1 truncate font-bold text-slate-900 dark:text-white">
                      {t.title_vi}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void callAdmin(
                        { action: "toggle_test_publish", id: t.id, is_published: !t.is_published },
                        `Đã cập nhật hiển thị đề ${t.slug}`
                      )
                    }
                  >
                    {t.is_published ? "Công khai" : "Đang ẩn"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 lg:col-span-6 space-y-3">
            <h2 className="text-base font-bold">Tạo đề thi mới bằng JSON Schema</h2>
            <textarea
              rows={15}
              value={testJson}
              onChange={(e) => setTestJson(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-950"
            />
            <Button
              onClick={() =>
                void callAdmin(
                  { action: "create_test_json", testJson },
                  "Đã tạo đề thi mới từ JSON Schema!"
                )
              }
            >
              <Plus className="h-4 w-4" /> Xuất bản đề từ JSON
            </Button>
          </Card>
        </div>
      )}

      {/* TAB 5: CONTENT / BLOG CMS */}
      {tab === "content" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6 space-y-3 text-xs">
            <h2 className="text-base font-bold">Đăng bài Blog IELTS mới</h2>
            <input
              type="text"
              placeholder="Tiêu đề bài viết..."
              value={blogTitle}
              onChange={(e) => setBlogTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <input
              type="text"
              placeholder="Chuyên mục"
              value={blogCategory}
              onChange={(e) => setBlogCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <input
              type="text"
              placeholder="Mô tả ngắn..."
              value={blogExcerpt}
              onChange={(e) => setBlogExcerpt(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
            <textarea
              rows={6}
              placeholder="Nội dung bài viết (hỗ trợ tiêu đề ### ...)"
              value={blogContent}
              onChange={(e) => setBlogContent(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-950"
            />
            <Button
              onClick={async () => {
                const ok = await callAdmin(
                  {
                    action: "create_blog_post",
                    title_vi: blogTitle,
                    category: blogCategory,
                    excerpt_vi: blogExcerpt,
                    content_vi: blogContent,
                  },
                  "Đã đăng bài viết Blog mới!"
                );
                if (ok) {
                  setBlogTitle("");
                  setBlogExcerpt("");
                  setBlogContent("");
                }
              }}
            >
              <Plus className="h-4 w-4" /> Xuất bản bài viết
            </Button>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="text-base font-bold">Bài viết hiện có ({props.blogPosts.length})</h2>
            <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {props.blogPosts.map((p) => (
                <div key={p.id} className="py-3">
                  <Badge variant="secondary">{p.category}</Badge>
                  <p className="mt-1 font-bold text-slate-900 dark:text-white">{p.title_vi}</p>
                  <p className="text-slate-500">/{p.slug}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 6: USERS & ORDERS */}
      {tab === "users" && isAdmin && (
        <div className="space-y-6">
          <Card className="p-6 space-y-3">
            <h2 className="text-base font-bold">Quản lý Người dùng ({props.profiles.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 text-slate-500 dark:border-slate-800">
                  <tr>
                    <th className="py-2 pr-3">Học viên</th>
                    <th className="py-2 pr-3">Vai trò</th>
                    <th className="py-2 pr-3">Hạn Premium</th>
                    <th className="py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {props.profiles.map((u) => {
                    const isSelf = Boolean(props.currentUserId && props.currentUserId === u.id);
                    const locked = Boolean(u.is_locked);
                    return (
                      <tr key={u.id}>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900 dark:text-white">{u.full_name}</p>
                            {isSelf && <Badge variant="secondary">Bạn</Badge>}
                            {locked && (
                              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                Đang khóa
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500">{u.email}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <select
                            aria-label={`Vai trò của ${u.email}`}
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => {
                              const nextRole = e.target.value as UserRole;
                              if (nextRole === u.role) return;
                              setPendingConfirm({
                                title: "Xác nhận đổi vai trò tài khoản",
                                description: `Đổi vai trò của ${u.email} từ '${u.role}' sang '${nextRole}'? Thao tác sẽ được ghi vào Nhật ký hoạt động.`,
                                confirmLabel: "Đổi vai trò",
                                destructive: nextRole === "admin",
                                payload: {
                                  action: "update_user_admin",
                                  userId: u.id,
                                  role: nextRole,
                                },
                                successMsg: `Đã đổi vai trò ${u.email} thành ${nextRole}`,
                              });
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="learner">learner (Học viên)</option>
                            <option value="editor">editor (Biên tập)</option>
                            <option value="admin">admin (Toàn quyền)</option>
                          </select>
                        </td>
                        <td className="py-3 pr-3">
                          {u.premium_expires_at
                            ? new Date(u.premium_expires_at).toLocaleDateString("vi-VN")
                            : "Free"}
                        </td>
                        <td className="py-3 flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void callAdmin(
                                { action: "update_user_admin", userId: u.id, grantMonths: 1 },
                                `Đã cộng thêm 1 tháng Premium cho ${u.email}`
                              )
                            }
                          >
                            +1 Tháng Premium
                          </Button>
                          {u.role !== "admin" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setPendingConfirm({
                                  title: "Thu hồi gói Premium",
                                  description: `Đưa tài khoản ${u.email} về gói Free ngay lập tức?`,
                                  confirmLabel: "Thu hồi Premium",
                                  destructive: true,
                                  payload: {
                                    action: "update_user_admin",
                                    userId: u.id,
                                    revokePremium: true,
                                  },
                                  successMsg: `Đã đưa ${u.email} về gói Free`,
                                })
                              }
                            >
                              Về Free
                            </Button>
                          )}
                          {!isSelf && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPendingConfirm({
                                  title: locked ? "Mở khóa tài khoản" : "Khóa tài khoản",
                                  description: locked
                                    ? `Mở khóa lại tài khoản ${u.email}?`
                                    : `Khóa tài khoản ${u.email}? Người dùng này sẽ bị chặn truy cập CMS ngay lập tức.`,
                                  confirmLabel: locked ? "Mở khóa" : "Khóa tài khoản",
                                  destructive: !locked,
                                  payload: {
                                    action: "update_user_admin",
                                    userId: u.id,
                                    isLocked: !locked,
                                  },
                                  successMsg: locked
                                    ? `Đã mở khóa tài khoản ${u.email}`
                                    : `Đã khóa tài khoản ${u.email}`,
                                })
                              }
                            >
                              {locked ? (
                                <>
                                  <Unlock className="h-3.5 w-3.5" /> Mở khóa
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3.5 w-3.5" /> Khóa
                                </>
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="text-base font-bold">Đơn hàng PayOS VietQR ({props.orders.length})</h2>
            {props.orders.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có giao dịch nào.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
                {props.orders.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <span className="font-mono font-bold">#{o.order_code}</span> · {o.plan_slug} (
                      {o.provider})
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700">{formatVnd(o.amount_vnd)}</span>
                      <Badge variant={o.status === "paid" ? "default" : "secondary"}>
                        {o.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description ?? ""}
        confirmLabel={pendingConfirm?.confirmLabel}
        destructive={pendingConfirm?.destructive ?? true}
        loading={confirmLoading}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setConfirmLoading(true);
          try {
            await callAdmin(pendingConfirm.payload, pendingConfirm.successMsg);
          } finally {
            setConfirmLoading(false);
            setPendingConfirm(null);
          }
        }}
      />
    </div>
  );
}
