"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  ExternalLink,
  Gift,
  Plus,
  Save,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import type {
  PricingPlan,
  PromoBanner,
  PromoCode,
  ReferralConfigSettings,
  ReferralRecord,
} from "@/lib/types";
import { formatVnd } from "@/lib/utils";
import { useAdminToast } from "./toast-provider";
import { ConfirmDialog } from "./confirm-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PricingCmsClientProps {
  initialPlans: PricingPlan[];
  initialBanner: PromoBanner;
  initialPromoCodes: PromoCode[];
  initialReferrals: ReferralRecord[];
  initialReferralConfig: ReferralConfigSettings;
}

export function PricingCmsClient({
  initialPlans,
  initialBanner,
  initialPromoCodes,
  initialReferrals,
  initialReferralConfig,
}: PricingCmsClientProps) {
  const toast = useAdminToast();
  const [tab, setTab] = useState<"plans" | "promo" | "referral">("plans");

  const [plans, setPlans] = useState<PricingPlan[]>(initialPlans);
  const [banner, setBanner] = useState<PromoBanner>(initialBanner);
  const [codes, setCodes] = useState<PromoCode[]>(initialPromoCodes);
  const [referrals, setReferrals] = useState<ReferralRecord[]>(initialReferrals);
  const [refConfig, setRefConfig] = useState<ReferralConfigSettings>(initialReferralConfig);

  // New promo code form
  const [newCode, setNewCode] = useState("");
  const [newPercent, setNewPercent] = useState(15);
  const [newMaxDiscount, setNewMaxDiscount] = useState(200000);
  const [newMaxUses, setNewMaxUses] = useState(300);

  const [saving, setSaving] = useState(false);
  const [deleteCodeTarget, setDeleteCodeTarget] = useState<PromoCode | null>(null);

  const reloadAll = async () => {
    const res = await fetch("/api/admin/pricing");
    if (res.ok) {
      const data = await res.json();
      setPlans(data.plans ?? []);
      if (data.banner) setBanner(data.banner);
      setCodes(data.promoCodes ?? []);
      setReferrals(data.referrals ?? []);
      if (data.referralConfig) setRefConfig(data.referralConfig);
    }
  };

  const savePlan = async (plan: PricingPlan) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert_plan", plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu gói giá thất bại.");
        return;
      }
      toast.success(`Đã lưu gói "${plan.name_vi}"!`);
      await reloadAll();
    } finally {
      setSaving(false);
    }
  };

  const saveBanner = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_banner",
          banner: {
            title_vi: banner.title_vi,
            title_en: banner.title_en,
            badge_vi: banner.badge_vi,
            badge_en: banner.badge_en,
            cta_vi: banner.cta_vi,
            cta_en: banner.cta_en,
            ends_at: banner.ends_at,
            is_active: banner.is_active,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Cập nhật banner thất bại.");
        return;
      }
      toast.success("Đã cập nhật Banner khuyến mãi trên trang /pricing!");
      await reloadAll();
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_promo_code",
          promoCode: {
            code: newCode.trim().toUpperCase(),
            discount_percent: Number(newPercent) || 10,
            max_discount_vnd: newMaxDiscount > 0 ? Number(newMaxDiscount) : null,
            max_uses: newMaxUses > 0 ? Number(newMaxUses) : null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Tạo mã giảm giá thất bại.");
        return;
      }
      toast.success(`Đã tạo mã giảm giá ${newCode.trim().toUpperCase()}!`);
      setNewCode("");
      await reloadAll();
    } finally {
      setSaving(false);
    }
  };

  const toggleCode = async (code: PromoCode) => {
    const res = await fetch("/api/admin/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_promo_code",
        id: code.id,
        is_active: !code.is_active,
      }),
    });
    if (res.ok) {
      toast.success(
        !code.is_active ? `Đã bật mã ${code.code}` : `Đã tắt mã ${code.code}`
      );
      await reloadAll();
    }
  };

  const saveRefConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_referral_config", config: refConfig }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Lưu cấu hình Referral thất bại.");
        return;
      }
      toast.success("Đã lưu cấu hình Chương trình giới thiệu!");
      await reloadAll();
    } finally {
      setSaving(false);
    }
  };

  const convertedCount = referrals.filter((r) => r.status === "converted_premium").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Gói giá Premium, Mã giảm giá &amp; Referral
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Cập nhật giá bán, tính năng từng gói, banner đếm ngược, mã khuyến mãi và chính sách tặng ngày khi mời bạn.
          </p>
        </div>
        <Link
          href="/pricing"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Xem trang /pricing
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        {[
          { id: "plans" as const, label: `1. Gói giá (${plans.length})`, icon: CreditCard },
          { id: "promo" as const, label: `2. Banner & Mã giảm giá (${codes.length})`, icon: Tag },
          { id: "referral" as const, label: `3. Chương trình Referral (${referrals.length})`, icon: Gift },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
                tab === t.id
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PLANS */}
      {tab === "plans" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan, idx) => (
            <Card key={plan.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge>{plan.duration_months} tháng</Badge>
                  <span className="font-mono text-xs text-slate-400">{plan.slug}</span>
                </div>
                <div className="flex items-center gap-2">
                  {plan.is_popular && <Badge variant="amber">Phổ biến</Badge>}
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Đang bán" : "Đang ẩn"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Tên gói (VI)
                  </label>
                  <input
                    type="text"
                    value={plan.name_vi}
                    onChange={(e) => {
                      const next = [...plans];
                      next[idx] = { ...plan, name_vi: e.target.value };
                      setPlans(next);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Tên gói (EN)
                  </label>
                  <input
                    type="text"
                    value={plan.name_en}
                    onChange={(e) => {
                      const next = [...plans];
                      next[idx] = { ...plan, name_en: e.target.value };
                      setPlans(next);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Giá bán thực tế (VND)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={plan.price_vnd}
                    onChange={(e) => {
                      const next = [...plans];
                      next[idx] = {
                        ...plan,
                        price_vnd: Number.parseInt(e.target.value, 10) || 0,
                      };
                      setPlans(next);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                  />
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    Hiển thị: {formatVnd(plan.price_vnd)}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Giá gốc gạch ngang (VND)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={plan.original_price_vnd}
                    onChange={(e) => {
                      const next = [...plans];
                      next[idx] = {
                        ...plan,
                        original_price_vnd: Number.parseInt(e.target.value, 10) || 0,
                      };
                      setPlans(next);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Quyền lợi gói (mỗi dòng 1 ý)
                </label>
                <textarea
                  rows={3}
                  value={plan.features_vi.join("\n")}
                  onChange={(e) => {
                    const next = [...plans];
                    next[idx] = {
                      ...plan,
                      features_vi: e.target.value.split("\n"),
                    };
                    setPlans(next);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.is_popular}
                      onChange={(e) => {
                        const next = [...plans];
                        next[idx] = { ...plan, is_popular: e.target.checked };
                        setPlans(next);
                      }}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Gắn nhãn Phổ biến
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={plan.is_active}
                      onChange={(e) => {
                        const next = [...plans];
                        next[idx] = { ...plan, is_active: e.target.checked };
                        setPlans(next);
                      }}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Hiển thị bán
                  </label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    savePlan({
                      ...plan,
                      features_vi: plan.features_vi.map((f) => f.trim()).filter(Boolean),
                    })
                  }
                >
                  <Save className="h-3.5 w-3.5" />
                  Lưu gói
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 2: BANNER & PROMO CODES */}
      {tab === "promo" && (
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Banner khuyến mãi đếm ngược (Trang /pricing)
                </h2>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={banner.is_active}
                  onChange={(e) => setBanner({ ...banner, is_active: e.target.checked })}
                  className="h-4 w-4 accent-emerald-600"
                />
                Đang bật Banner
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nội dung khuyến mãi (VI)
                </label>
                <input
                  type="text"
                  value={banner.title_vi}
                  onChange={(e) => setBanner({ ...banner, title_vi: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nội dung khuyến mãi (EN)
                </label>
                <input
                  type="text"
                  value={banner.title_en}
                  onChange={(e) => setBanner({ ...banner, title_en: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nhãn nổi bật (Badge)
                </label>
                <input
                  type="text"
                  value={banner.badge_vi}
                  onChange={(e) => setBanner({ ...banner, badge_vi: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Thời hạn kết thúc (ISO / UTC)
                </label>
                <input
                  type="text"
                  value={banner.ends_at}
                  onChange={(e) => setBanner({ ...banner, ends_at: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div className="flex items-end">
                <Button type="button" size="sm" disabled={saving} onClick={saveBanner}>
                  <Save className="h-3.5 w-3.5" />
                  Lưu Banner
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Tạo &amp; Quản lý Mã giảm giá (Promo Codes)
            </h2>
            <form onSubmit={handleCreatePromoCode} className="grid gap-3 sm:grid-cols-5">
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="VD: IELTS2026"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs uppercase dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                min={1}
                max={90}
                value={newPercent}
                onChange={(e) => setNewPercent(Number.parseInt(e.target.value, 10) || 10)}
                placeholder="% giảm"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                min={0}
                step={10000}
                value={newMaxDiscount}
                onChange={(e) =>
                  setNewMaxDiscount(Number.parseInt(e.target.value, 10) || 0)
                }
                placeholder="Giảm tối đa (đ)"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                min={1}
                value={newMaxUses}
                onChange={(e) =>
                  setNewMaxUses(Number.parseInt(e.target.value, 10) || 100)
                }
                placeholder="Lượt tối đa"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
              <Button type="submit" size="sm" disabled={saving}>
                <Plus className="h-3.5 w-3.5" />
                Tạo mã
              </Button>
            </form>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {codes.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-mono font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {c.code}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Giảm {c.discount_percent}%
                        {c.max_discount_vnd
                          ? ` (tối đa ${formatVnd(c.max_discount_vnd)})`
                          : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Đã dùng: {c.current_uses} / {c.max_uses ?? "∞"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={c.is_active ? "secondary" : "outline"}
                      onClick={() => toggleCode(c)}
                    >
                      {c.is_active ? "Đang bật" : "Đang tắt"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => setDeleteCodeTarget(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: REFERRAL */}
      {tab === "referral" && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="p-5 lg:col-span-5 space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Cấu hình Chương trình Giới thiệu
              </h2>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={refConfig.isEnabled}
                  onChange={(e) =>
                    setRefConfig({ ...refConfig, isEnabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-emerald-600"
                />
                Kích hoạt
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ngày thưởng người mời
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={refConfig.referrerBonusDays}
                  onChange={(e) =>
                    setRefConfig({
                      ...refConfig,
                      referrerBonusDays: Number.parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ngày thưởng bạn mới
                </label>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={refConfig.referredBonusDays}
                  onChange={(e) =>
                    setRefConfig({
                      ...refConfig,
                      referredBonusDays: Number.parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                Tiêu đề hiển thị (VI)
              </label>
              <input
                type="text"
                value={refConfig.headlineVi}
                onChange={(e) =>
                  setRefConfig({ ...refConfig, headlineVi: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
              />
            </div>

            <Button type="button" size="sm" disabled={saving} onClick={saveRefConfig}>
              <Save className="h-3.5 w-3.5" />
              Lưu cấu hình Referral
            </Button>
          </Card>

          <Card className="p-5 lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Lịch sử giới thiệu gần đây
              </h2>
              <div className="flex gap-2">
                <Badge variant="secondary">Tổng: {referrals.length}</Badge>
                <Badge>Đã lên VIP: {convertedCount}</Badge>
              </div>
            </div>

            {referrals.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                Chưa có lượt giới thiệu nào.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {referrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {r.referred_email}
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        Mã: {r.referral_code} ·{" "}
                        {new Date(r.created_at).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <Badge
                      variant={r.status === "converted_premium" ? "default" : "secondary"}
                    >
                      {r.status === "converted_premium" ? "Đã nâng VIP" : "Đã đăng ký"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteCodeTarget)}
        title="Xóa mã giảm giá?"
        description={`Mã "${deleteCodeTarget?.code ?? ""}" sẽ bị xóa vĩnh viễn và không thể áp dụng khi thanh toán nữa.`}
        confirmLabel="Xóa mã"
        onCancel={() => setDeleteCodeTarget(null)}
        onConfirm={async () => {
          if (!deleteCodeTarget) return;
          const res = await fetch(
            `/api/admin/pricing?type=promo_code&id=${encodeURIComponent(deleteCodeTarget.id)}`,
            { method: "DELETE" }
          );
          if (res.ok) {
            toast.success(`Đã xóa mã ${deleteCodeTarget.code}.`);
            setDeleteCodeTarget(null);
            await reloadAll();
          }
        }}
      />
    </div>
  );
}
