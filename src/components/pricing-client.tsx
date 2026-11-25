"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import type { PricingPlan, PromoBanner, SessionUser } from "@/lib/types";
import { formatVnd } from "@/lib/utils";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface PricingClientProps {
  plans: PricingPlan[];
  banner: PromoBanner;
  user: SessionUser | null;
}

interface ActiveCheckout {
  orderCode: number;
  planName: string;
  amountVnd: number;
  discountVnd: number;
  promoCode?: string | null;
  checkoutUrl: string;
  qrCode: string;
  sandboxMocked: boolean;
}

function getCountdownParts(targetIso: string) {
  const diff = Math.max(0, new Date(targetIso).getTime() - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return { days, hours, mins, secs, expired: diff <= 0 };
}

export function PricingClient({ plans, banner, user }: PricingClientProps) {
  const locale = useLocale();
  const isEn = locale === "en";
  const router = useRouter();

  const [countdown, setCountdown] = useState(() => getCountdownParts(banner.ends_at));
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount_percent: number;
    max_discount_vnd: number | null;
  } | null>(null);
  const [promoMsg, setPromoMsg] = useState("");
  const [promoErr, setPromoErr] = useState("");

  const [creatingSlug, setCreatingSlug] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<ActiveCheckout | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [activatedExpiry, setActivatedExpiry] = useState<string | null>(null);
  const [checkoutErr, setCheckoutErr] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(getCountdownParts(banner.ends_at));
    }, 1000);
    return () => clearInterval(id);
  }, [banner.ends_at]);

  const computeFinalPrice = (priceVnd: number) => {
    if (!appliedPromo) return priceVnd;
    const raw = Math.round((priceVnd * appliedPromo.discount_percent) / 100);
    const discount = appliedPromo.max_discount_vnd
      ? Math.min(raw, appliedPromo.max_discount_vnd)
      : raw;
    return Math.max(1000, priceVnd - discount);
  };

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoErr("");
    setPromoMsg("");
    if (!promoInput.trim()) return;
    const res = await fetch("/api/promo/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: promoInput.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAppliedPromo(null);
      setPromoErr(data.error || "Mã không hợp lệ");
      return;
    }
    setAppliedPromo(data.promo);
    setPromoMsg(
      isEn
        ? `Code ${data.promo.code} applied (-${data.promo.discount_percent}%)!`
        : `Đã áp dụng mã ${data.promo.code} — giảm thêm ${data.promo.discount_percent}%!`
    );
  };

  const handleStartCheckout = async (plan: PricingPlan) => {
    setCheckoutErr("");
    if (!user) {
      router.push("/auth");
      return;
    }
    setCreatingSlug(plan.slug);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: plan.slug,
          promoCode: appliedPromo?.code,
          provider: "payos",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutErr(data.error || "Không thể khởi tạo thanh toán.");
        return;
      }
      setActivatedExpiry(null);
      setCheckout({
        orderCode: data.order.order_code,
        planName: isEn ? plan.name_en : plan.name_vi,
        amountVnd: data.order.amount_vnd,
        discountVnd: data.order.discount_vnd,
        promoCode: data.order.promo_code,
        checkoutUrl: data.checkout.checkoutUrl,
        qrCode: data.checkout.qrCode,
        sandboxMocked: data.checkout.sandboxMocked,
      });
    } finally {
      setCreatingSlug(null);
    }
  };

  const handleSimulatePayos = async () => {
    if (!checkout) return;
    setSimulating(true);
    setCheckoutErr("");
    try {
      const res = await fetch("/api/checkout/simulate-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: checkout.orderCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutErr(data.message || data.error || "Xác nhận thất bại.");
        return;
      }
      setActivatedExpiry(data.premiumExpiresAt || "activated");
      router.refresh();
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Configurable Countdown Promo Banner */}
      {banner.is_active && !countdown.expired && (
        <div className="rounded-3xl bg-emerald-900 p-5 text-white shadow-sm sm:px-8 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <span className="inline-block rounded-full bg-amber-300/20 px-3 py-0.5 text-[11px] font-bold text-amber-200">
                {isEn ? banner.badge_en : banner.badge_vi}
              </span>
              <p className="text-base font-bold sm:text-lg">
                {isEn ? banner.title_en : banner.title_vi}
              </p>
            </div>
            <div className="flex items-center gap-2 text-center">
              {[
                { val: countdown.days, lbl: isEn ? "Days" : "Ngày" },
                { val: countdown.hours, lbl: isEn ? "Hrs" : "Giờ" },
                { val: countdown.mins, lbl: isEn ? "Min" : "Phút" },
                { val: countdown.secs, lbl: isEn ? "Sec" : "Giây" },
              ].map((u) => (
                <div key={u.lbl} className="min-w-[54px] rounded-xl bg-white/10 px-2.5 py-2">
                  <p className="font-mono text-lg font-bold leading-none">
                    {String(u.val).padStart(2, "0")}
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-100">{u.lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Premium Status Banner */}
      {user?.isPremium && (
        <Card className="border-emerald-300 bg-emerald-50/50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {isEn ? "Your account has active Premium access!" : "Tài khoản của bạn đang sử dụng gói Premium!"}
                </p>
                {user.premium_expires_at && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {isEn ? "Valid until: " : "Hạn sử dụng đến: "}
                    <strong>
                      {new Date(user.premium_expires_at).toLocaleDateString("vi-VN")}
                    </strong>
                    {" — "}
                    {isEn ? "New purchases stack automatically." : "Mua thêm sẽ tự động cộng dồn thời hạn."}
                  </p>
                )}
              </div>
            </div>
            <Link href="/writing">
              <Button size="sm">{isEn ? "Use Unlimited AI" : "Dùng AI không giới hạn"}</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Promo Code Input */}
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>
            {isEn
              ? "One-time VND payment via VietQR (PayOS) · Zero auto-renewal · 7-day refund policy"
              : "Thanh toán 1 lần qua VietQR (PayOS) · Không tự động gia hạn · Hoàn tiền trong 7 ngày"}
          </span>
        </div>

        <form onSubmit={handleApplyPromo} className="flex items-center gap-2">
          <div className="relative">
            <Tag className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              id="promo-code-input"
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="ONIELTS15"
              className="w-40 rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs font-bold uppercase dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <Button type="submit" id="apply-promo-btn" variant="outline" size="sm">
            {isEn ? "Apply Code" : "Áp mã"}
          </Button>
        </form>
      </div>

      {promoMsg && (
        <p className="text-right text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          ✓ {promoMsg}
        </p>
      )}
      {promoErr && <p className="text-right text-xs font-semibold text-red-600">{promoErr}</p>}
      {checkoutErr && (
        <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{checkoutErr}</p>
      )}

      {/* 4 Plan Cards (1 / 3 / 6 / 12 months) */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const finalPrice = computeFinalPrice(plan.price_vnd);
          const perMonth = Math.round(finalPrice / plan.duration_months);
          const savePct = Math.round(
            ((plan.original_price_vnd - finalPrice) / plan.original_price_vnd) * 100
          );
          const features = isEn ? plan.features_en : plan.features_vi;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col justify-between p-6 transition ${
                plan.is_popular
                  ? "border-2 border-emerald-600 shadow-lg"
                  : "hover:border-emerald-300 hover:shadow-md"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {isEn ? plan.name_en : plan.name_vi}
                  </h2>
                  {plan.is_popular && (
                    <Badge className="bg-emerald-600 text-white border-emerald-600">
                      {isEn ? "Most Popular" : "Phổ biến nhất"}
                    </Badge>
                  )}
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="line-through">{formatVnd(plan.original_price_vnd)}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">
                      -{savePct}%
                    </span>
                  </div>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {formatVnd(finalPrice)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    ≈ {formatVnd(perMonth)} / {isEn ? "month · One-time" : "tháng · Trả 1 lần"}
                  </p>
                </div>

                <ul className="mt-5 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                  {features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                type="button"
                id={`buy-plan-${plan.slug}`}
                size="lg"
                variant={plan.is_popular ? "default" : "outline"}
                disabled={creatingSlug === plan.slug}
                onClick={() => handleStartCheckout(plan)}
                className="mt-6 w-full"
              >
                {creatingSlug === plan.slug ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                {isEn ? "Pay via VietQR" : "Thanh toán VietQR"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Free vs Premium Comparison */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isEn ? "Compare Free vs Premium" : "So sánh chi tiết Free và Premium"}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-slate-500 dark:border-slate-800">
              <tr>
                <th className="px-6 py-3">{isEn ? "Feature" : "Tính năng"}</th>
                <th className="px-6 py-3">Free</th>
                <th className="px-6 py-3 text-emerald-700 dark:text-emerald-400">Premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                [isEn ? "All IELTS Reading & Listening Tests" : "Kho đề Reading & Listening chuẩn máy tính", "Đầy đủ", "Đầy đủ"],
                [isEn ? "AI Writing Evaluations" : "Chấm điểm Writing AI (4 tiêu chí + viết lại Band 8+)", "2 lượt / tháng", "Không giới hạn"],
                [isEn ? "AI Speaking Evaluations" : "Chấm điểm Speaking AI (ghi âm Parts 1–3)", "2 lượt / tháng", "Không giới hạn"],
                [isEn ? "General AI Tools & Generators" : "8 Công cụ AI & Tạo bài mẫu Band 9", "Giới hạn theo ngày", "Không giới hạn"],
                [isEn ? "AI Role-play Conversations" : "Hội thoại AI đa chủ đề", "5 lượt / ngày", "Không giới hạn"],
                [isEn ? "Private Essays & Mistake Analytics" : "Bài nộp riêng tư & Phân tích lỗi chuyên sâu", "Cơ bản", "Toàn diện"],
              ].map(([feat, freeVal, premVal]) => (
                <tr key={feat}>
                  <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-200">{feat}</td>
                  <td className="px-6 py-3.5 text-slate-500">{freeVal}</td>
                  <td className="px-6 py-3.5 font-bold text-emerald-700 dark:text-emerald-400">{premVal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PayOS VietQR Checkout Modal */}
      {checkout && (
        <div
          id="checkout-qr-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <Badge>{checkout.sandboxMocked ? "PayOS Sandbox (VietQR)" : "PayOS VietQR"}</Badge>
                <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                  {checkout.planName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckout(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activatedExpiry ? (
              <div className="mt-6 rounded-2xl bg-emerald-50 p-6 text-center dark:bg-emerald-950/40">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <p className="mt-3 text-lg font-bold text-emerald-900 dark:text-emerald-200">
                  {isEn ? "Premium Activated!" : "Kích hoạt Premium thành công!"}
                </p>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  {isEn ? "Valid until: " : "Hạn sử dụng mới: "}
                  {new Date(activatedExpiry).toLocaleDateString("vi-VN")}
                </p>
                <Button className="mt-5 w-full" onClick={() => setCheckout(null)}>
                  {isEn ? "Start Learning" : "Bắt đầu ôn luyện ngay"}
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-950">
                  {/* Visual VietQR representation */}
                  <svg
                    viewBox="0 0 140 140"
                    className="mx-auto h-40 w-40 rounded-xl bg-white p-2 shadow-xs"
                    aria-label="VietQR code"
                  >
                    <rect x="8" y="8" width="32" height="32" rx="4" fill="#0f172a" />
                    <rect x="14" y="14" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="19" y="19" width="10" height="10" fill="#059669" />
                    <rect x="100" y="8" width="32" height="32" rx="4" fill="#0f172a" />
                    <rect x="106" y="14" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="111" y="19" width="10" height="10" fill="#059669" />
                    <rect x="8" y="100" width="32" height="32" rx="4" fill="#0f172a" />
                    <rect x="14" y="106" width="20" height="20" rx="2" fill="#ffffff" />
                    <rect x="19" y="111" width="10" height="10" fill="#059669" />
                    <rect x="52" y="16" width="10" height="10" fill="#0f172a" />
                    <rect x="70" y="16" width="18" height="10" fill="#0f172a" />
                    <rect x="52" y="34" width="36" height="8" fill="#059669" />
                    <rect x="16" y="54" width="108" height="10" fill="#0f172a" />
                    <rect x="52" y="72" width="16" height="16" fill="#059669" />
                    <rect x="76" y="72" width="48" height="10" fill="#0f172a" />
                    <rect x="52" y="98" width="32" height="12" fill="#0f172a" />
                    <rect x="94" y="98" width="30" height="30" fill="#0f172a" />
                    <rect x="102" y="106" width="14" height="14" fill="#ffffff" />
                    <rect x="52" y="118" width="28" height="12" fill="#059669" />
                  </svg>
                  <p className="mt-3 text-xs text-slate-500">
                    {isEn ? "Order Code" : "Mã đơn hàng"}: <strong>#{checkout.orderCode}</strong>
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatVnd(checkout.amountVnd)}
                  </p>
                  {checkout.discountVnd > 0 && (
                    <p className="text-xs text-emerald-600">
                      Đã giảm {formatVnd(checkout.discountVnd)} ({checkout.promoCode})
                    </p>
                  )}
                </div>

                {!checkout.sandboxMocked ? (
                  <a href={checkout.checkoutUrl} target="_blank" rel="noreferrer" className="block">
                    <Button size="lg" className="w-full">
                      <ExternalLink className="h-4 w-4" />
                      {isEn ? "Open PayOS Payment Page" : "Mở trang thanh toán PayOS"}
                    </Button>
                  </a>
                ) : (
                  <div className="space-y-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {isEn
                        ? "PayOS keys not set — click below to send a signed HMAC-SHA256 sandbox webhook:"
                        : "Chưa cấu hình khóa PayOS — nhấn nút bên dưới để chạy thử luồng webhook ký HMAC-SHA256:"}
                    </p>
                    <Button
                      type="button"
                      size="lg"
                      id="simulate-payos-webhook-btn"
                      disabled={simulating}
                      onClick={handleSimulatePayos}
                      className="w-full"
                    >
                      {simulating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {isEn
                        ? "Confirm PayOS Sandbox Payment"
                        : "Xác nhận thanh toán PayOS (Sandbox)"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
