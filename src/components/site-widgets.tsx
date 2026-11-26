/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Cookie,
  Eye,
  ExternalLink,
  MessageCircle,
  Shield,
  Wrench,
  X,
} from "lucide-react";
import {
  isSafeNavHref,
  isWithinScheduleWindow,
  type SiteAppearanceConfig,
} from "@/lib/appearance-shared";

interface SiteWidgetsProps {
  widgets: SiteAppearanceConfig["widgets"];
  isAdmin: boolean;
  isPreviewingDraft: boolean;
  locale: string;
  serverNowMs: number;
  children: React.ReactNode;
}

const COOKIE_STORAGE_KEY = "onielts_cookie_accepted_v1";
const POPUP_SESSION_KEY = "onielts_popup_seen_session_v1";
const POPUP_DAY_KEY = "onielts_popup_seen_day_v1";

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

export function SiteWidgets({
  widgets,
  isAdmin,
  isPreviewingDraft,
  locale,
  serverNowMs,
  children,
}: SiteWidgetsProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const isEn = locale === "en";

  const isAdminOrAuthRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/");

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [cookieOpen, setCookieOpen] = useState(false);
  const [exitingPreview, setExitingPreview] = useState(false);

  const todayKey = new Date(serverNowMs).toISOString().slice(0, 10);

  const bannerActive =
    !isAdminOrAuthRoute &&
    !bannerDismissed &&
    widgets.topBanner.enabled &&
    isWithinScheduleWindow(
      widgets.topBanner.startsAt,
      widgets.topBanner.endsAt,
      serverNowMs
    );

  const popupScheduled =
    !isAdminOrAuthRoute &&
    widgets.popup.enabled &&
    isWithinScheduleWindow(
      widgets.popup.startsAt,
      widgets.popup.endsAt,
      serverNowMs
    );

  const popupSignature = `${widgets.popup.titleVi}|${widgets.popup.bodyVi}|${widgets.popup.ctaHref}`;

  useEffect(() => {
    if (!popupScheduled) return;
    const timer = setTimeout(() => {
      try {
        if (widgets.popup.frequency === "once_per_session") {
          if (sessionStorage.getItem(POPUP_SESSION_KEY) === popupSignature) return;
        } else {
          if (localStorage.getItem(POPUP_DAY_KEY) === `${todayKey}:${popupSignature}`) return;
        }
        setPopupOpen(true);
      } catch {
        setPopupOpen(true);
      }
    }, 650);
    return () => clearTimeout(timer);
  }, [popupScheduled, widgets.popup.frequency, popupSignature, todayKey]);

  useEffect(() => {
    if (isAdminOrAuthRoute || !widgets.cookieBanner.enabled) return;
    const id = requestAnimationFrame(() => {
      try {
        if (localStorage.getItem(COOKIE_STORAGE_KEY) !== "1") {
          setCookieOpen(true);
        }
      } catch {
        setCookieOpen(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [isAdminOrAuthRoute, widgets.cookieBanner.enabled]);

  const dismissPopup = () => {
    setPopupOpen(false);
    try {
      if (widgets.popup.frequency === "once_per_session") {
        sessionStorage.setItem(POPUP_SESSION_KEY, popupSignature);
      } else {
        localStorage.setItem(POPUP_DAY_KEY, `${todayKey}:${popupSignature}`);
      }
    } catch {
      // ignore storage failure
    }
  };

  const acceptCookies = () => {
    setCookieOpen(false);
    try {
      localStorage.setItem(COOKIE_STORAGE_KEY, "1");
    } catch {
      // ignore storage failure
    }
  };

  const exitDraftPreview = async () => {
    setExitingPreview(true);
    try {
      await fetch("/api/admin/appearance/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      router.refresh();
    } finally {
      setExitingPreview(false);
    }
  };

  // =========================================================================
  // MAINTENANCE MODE GATE (Public blocked; Admin & /admin & /auth ALWAYS allowed)
  // =========================================================================
  if (widgets.maintenance.enabled && !isAdmin && !isAdminOrAuthRoute) {
    const mTitle = isEn
      ? widgets.maintenance.titleEn || widgets.maintenance.titleVi
      : widgets.maintenance.titleVi;
    const mMessage = isEn
      ? widgets.maintenance.messageEn || widgets.maintenance.messageVi
      : widgets.maintenance.messageVi;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-16 text-center dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <Wrench className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {mTitle}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {mMessage}
            </p>
          </div>
          {widgets.maintenance.expectedReturnText && (
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span>
                {isEn ? "Expected return:" : "Dự kiến hoạt động lại:"}{" "}
                {widgets.maintenance.expectedReturnText}
              </span>
            </div>
          )}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/auth?next=/admin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
            >
              <Shield className="h-3.5 w-3.5" />
              {isEn ? "Administrator Sign In" : "Đăng nhập Quản trị viên"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const bannerText = isEn
    ? widgets.topBanner.textEn || widgets.topBanner.textVi
    : widgets.topBanner.textVi;
  const bannerCtaLabel = isEn
    ? widgets.topBanner.ctaLabelEn || widgets.topBanner.ctaLabelVi
    : widgets.topBanner.ctaLabelVi;
  const bannerHref =
    widgets.topBanner.href && isSafeNavHref(widgets.topBanner.href)
      ? widgets.topBanner.href.trim()
      : "";
  const bannerBg = /^#[0-9A-Fa-f]{6}$/.test(widgets.topBanner.bgColor)
    ? widgets.topBanner.bgColor
    : "#047857";

  const messengerUrl =
    widgets.floatingChat.messengerUrl &&
    isExternalHref(widgets.floatingChat.messengerUrl)
      ? widgets.floatingChat.messengerUrl.trim()
      : "";
  const zaloUrl =
    widgets.floatingChat.zaloUrl && isExternalHref(widgets.floatingChat.zaloUrl)
      ? widgets.floatingChat.zaloUrl.trim()
      : "";
  const showFloatingChat =
    !isAdminOrAuthRoute &&
    widgets.floatingChat.enabled &&
    Boolean(messengerUrl || zaloUrl);

  const popupTitle = isEn
    ? widgets.popup.titleEn || widgets.popup.titleVi
    : widgets.popup.titleVi;
  const popupBody = isEn
    ? widgets.popup.bodyEn || widgets.popup.bodyVi
    : widgets.popup.bodyVi;
  const popupCtaLabel = isEn
    ? widgets.popup.ctaLabelEn || widgets.popup.ctaLabelVi
    : widgets.popup.ctaLabelVi;
  const popupCtaHref =
    widgets.popup.ctaHref && isSafeNavHref(widgets.popup.ctaHref)
      ? widgets.popup.ctaHref.trim()
      : "";

  const cookieText = isEn
    ? widgets.cookieBanner.textEn || widgets.cookieBanner.textVi
    : widgets.cookieBanner.textVi;
  const cookieAcceptLabel = isEn
    ? widgets.cookieBanner.acceptLabelEn || widgets.cookieBanner.acceptLabelVi
    : widgets.cookieBanner.acceptLabelVi;
  const cookiePolicyHref =
    widgets.cookieBanner.policyHref && isSafeNavHref(widgets.cookieBanner.policyHref)
      ? widgets.cookieBanner.policyHref.trim()
      : "/legal/privacy";

  return (
    <>
      {/* Admin Draft Preview Bar */}
      {isPreviewingDraft && isAdmin && (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            {isEn
              ? "Draft Preview Mode active — Visitors still see the published version."
              : "Đang xem trước bản Nháp (Giao diện & Trang chủ) — Khách vẫn thấy bản đã xuất bản."}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/appearance"
              className="rounded-lg bg-white/15 px-2.5 py-1 hover:bg-white/25"
            >
              {isEn ? "Back to Editor" : "Quay lại chỉnh sửa"}
            </Link>
            <button
              type="button"
              disabled={exitingPreview}
              onClick={exitDraftPreview}
              className="rounded-lg bg-white px-2.5 py-1 text-indigo-700 hover:bg-indigo-50 cursor-pointer disabled:opacity-60"
            >
              {exitingPreview
                ? "..."
                : isEn
                ? "Exit Preview"
                : "Thoát xem trước"}
            </button>
          </div>
        </div>
      )}

      {/* Admin Maintenance Reminder Bar */}
      {widgets.maintenance.enabled && isAdmin && !isAdminOrAuthRoute && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            {isEn
              ? "Maintenance Mode is ON — Public visitors see the maintenance screen; Admin has full access."
              : "Chế độ Bảo trì đang BẬT — Khách ngoài đang thấy màn hình bảo trì, Admin vẫn vào bình thường."}
          </span>
          <Link
            href="/admin/appearance"
            className="rounded-md bg-slate-950/15 px-2 py-0.5 underline hover:bg-slate-950/25"
          >
            {isEn ? "Manage in Admin" : "Tắt trong Admin"}
          </Link>
        </div>
      )}

      {/* Scheduled Top Announcement Banner */}
      {bannerActive && bannerText && (
        <div
          style={{ backgroundColor: bannerBg }}
          className="relative px-10 py-2 text-center text-xs font-semibold text-white"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2">
            <span>{bannerText}</span>
            {bannerHref && bannerCtaLabel &&
              (isExternalHref(bannerHref) ? (
                <a
                  href={bannerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold hover:bg-white/30"
                >
                  {bannerCtaLabel}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <Link
                  href={bannerHref}
                  className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold hover:bg-white/30"
                >
                  {bannerCtaLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
          </div>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label={isEn ? "Dismiss banner" : "Đóng thông báo"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/80 hover:bg-white/15 hover:text-white cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {children}

      {/* Scheduled Popup Notice */}
      {popupOpen && (popupTitle || popupBody) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          onClick={dismissPopup}
          role="dialog"
          aria-modal="true"
          aria-label={popupTitle || "Notice"}
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={dismissPopup}
              aria-label={isEn ? "Close" : "Đóng"}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:bg-slate-100 dark:bg-slate-800/90 dark:text-slate-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            {widgets.popup.imageUrl && isSafeNavHref(widgets.popup.imageUrl) && (
              <div className="h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={widgets.popup.imageUrl}
                  alt={popupTitle}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="p-6 space-y-3">
              {popupTitle && (
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {popupTitle}
                </h2>
              )}
              {popupBody && (
                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {popupBody}
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={dismissPopup}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {isEn ? "Later" : "Để sau"}
                </button>
                {popupCtaHref && popupCtaLabel &&
                  (isExternalHref(popupCtaHref) ? (
                    <a
                      href={popupCtaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={dismissPopup}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      {popupCtaLabel}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <Link
                      href={popupCtaHref}
                      onClick={dismissPopup}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      {popupCtaLabel}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Messenger & Zalo Buttons (bottom-left to avoid overlapping Mentor button on bottom-right) */}
      {showFloatingChat && (
        <div
          className="fixed bottom-5 left-5 z-40 flex flex-col gap-2.5"
          aria-label={
            isEn
              ? widgets.floatingChat.tooltipEn || "Support Chat"
              : widgets.floatingChat.tooltipVi || "Nhắn tin hỗ trợ"
          }
        >
          {messengerUrl && (
            <a
              href={messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={
                isEn
                  ? `Messenger — ${widgets.floatingChat.tooltipEn || "Chat with Support"}`
                  : `Messenger — ${widgets.floatingChat.tooltipVi || "Nhắn tin hỗ trợ"}`
              }
              className="group inline-flex items-center gap-2 rounded-full bg-blue-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:scale-105 hover:bg-blue-700"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Messenger</span>
            </a>
          )}
          {zaloUrl && (
            <a
              href={zaloUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={
                isEn
                  ? `Zalo — ${widgets.floatingChat.tooltipEn || "Chat with Support"}`
                  : `Zalo — ${widgets.floatingChat.tooltipVi || "Nhắn tin hỗ trợ"}`
              }
              className="group inline-flex items-center gap-2 rounded-full bg-sky-500 px-3.5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:scale-105 hover:bg-sky-600"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-sky-600">
                Z
              </span>
              <span className="hidden sm:inline">Zalo</span>
            </a>
          )}
        </div>
      )}

      {/* Cookie Consent Banner */}
      {cookieOpen && cookieText && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p>
                {cookieText}{" "}
                <Link
                  href={cookiePolicyHref}
                  className="font-semibold text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
                >
                  {isEn ? "Privacy Policy" : "Chính sách bảo mật"}
                </Link>
              </p>
            </div>
            <button
              type="button"
              onClick={acceptCookies}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
            >
              {cookieAcceptLabel || (isEn ? "Accept" : "Đồng ý")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
