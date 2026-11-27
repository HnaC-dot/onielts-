"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  AlertTriangle,
  ChevronDown,
  Crown,
  Gift,
  Globe,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Sun,
  User,
  X,
} from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { DynamicMenuIcon } from "./admin/icon-registry";
import { Button } from "./ui/button";
import { openAddFlashcardModal } from "./flashcard-quick-add";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DEFAULT_BRANDING_CONFIG,
  DEFAULT_PUBLIC_HEADER_MENU,
  isSafeNavHref,
  type BrandingConfig,
  type PublicHeaderMenuItem,
} from "@/lib/appearance-shared";
import type { AuthResolutionStatus, SessionUser } from "@/lib/types";

interface SiteHeaderProps {
  user: SessionUser | null;
  authStatus?: AuthResolutionStatus;
  branding?: BrandingConfig;
  headerMenu?: PublicHeaderMenuItem[];
}

interface SearchResult {
  title: string;
  href: string;
  category: string;
}

function isExternalUrl(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

export function SiteHeader({
  user,
  authStatus,
  branding = DEFAULT_BRANDING_CONFIG,
  headerMenu = DEFAULT_PUBLIC_HEADER_MENU,
}: SiteHeaderProps) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const isEn = locale === "en";
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const headerRef = useRef<HTMLDivElement>(null);

  const visibleNavItems = headerMenu.filter(
    (item) => item.visible && isSafeNavHref(item.href)
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setAvatarOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpenMenuId(null);
        setAvatarOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok && active) {
          const data = await res.json().catch(() => ({}));
          setSearchResults(data.results ?? []);
        }
      } catch {
        // ignore transient search network errors
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  const toggleLocale = async () => {
    const nextLocale = locale === "vi" ? "en" : "vi";
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
    } catch {
      // still reload to reflect any cookie state
    }
    window.location.reload();
  };

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    try {
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } catch {
      // session cookie clear is best-effort if network drops
    }
    setAvatarOpen(false);
    router.refresh();
  };

  const navLinkCls =
    "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-emerald-400 whitespace-nowrap";

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90"
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/"
            className="shrink-0"
            aria-label={branding.siteName || "Ôn IELTS"}
          >
            <BrandLogo branding={branding} />
          </Link>

          {/* Dynamic Desktop Navigation (CMS-driven) */}
          <nav className="hidden xl:flex items-center gap-0" aria-label="Main navigation">
            {visibleNavItems.map((item, idx) => {
              const label = isEn ? item.labelEn || item.labelVi : item.labelVi;
              const visibleChildren = (item.children ?? []).filter(
                (c) => c.visible && isSafeNavHref(c.href)
              );

              if (visibleChildren.length === 0) {
                if (isExternalUrl(item.href)) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={navLinkCls}
                    >
                      {label}
                    </a>
                  );
                }
                return (
                  <Link key={item.id} href={item.href} className={navLinkCls}>
                    {label}
                  </Link>
                );
              }

              const isOpen = openMenuId === item.id;
              const isWide = visibleChildren.length >= 5;
              const alignRight = idx >= visibleNavItems.length - 2;
              const triggerId =
                item.id === "hdr-ielts"
                  ? "nav-ielts-trigger"
                  : item.id === "hdr-tools"
                  ? "nav-tools-trigger"
                  : undefined;

              return (
                <div key={item.id} className="relative">
                  <button
                    type="button"
                    id={triggerId}
                    onClick={() => setOpenMenuId(isOpen ? null : item.id)}
                    className={navLinkCls + " cursor-pointer"}
                  >
                    {label}
                    <ChevronDown
                      className={`h-3.5 w-3.5 opacity-70 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div
                      className={`absolute top-full mt-2 rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 ${
                        alignRight ? "right-0" : "left-0"
                      } ${isWide ? "w-[480px] p-4" : "w-64 p-2"}`}
                    >
                      <div className={isWide ? "grid grid-cols-2 gap-1.5" : "space-y-0.5"}>
                        {visibleChildren.map((child) => {
                          const cLabel = isEn
                            ? child.labelEn || child.labelVi
                            : child.labelVi;
                          const cDesc = isEn
                            ? child.descEn || child.descVi
                            : child.descVi;
                          const childInner = (
                            <>
                              {child.icon && (
                                <DynamicMenuIcon
                                  name={child.icon}
                                  className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {cLabel}
                                </p>
                                {cDesc && (
                                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                    {cDesc}
                                  </p>
                                )}
                              </div>
                            </>
                          );

                          if (isExternalUrl(child.href)) {
                            return (
                              <a
                                key={child.id}
                                href={child.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => setOpenMenuId(null)}
                                className="flex items-start gap-2.5 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                              >
                                {childInner}
                              </a>
                            );
                          }
                          return (
                            <Link
                              key={child.id}
                              href={child.href}
                              onClick={() => setOpenMenuId(null)}
                              className="flex items-start gap-2.5 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                            >
                              {childInner}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Right utilities */}
        <div className="flex items-center gap-1.5">
          {/* Search button */}
          <button
            type="button"
            id="header-search-btn"
            onClick={() => setSearchOpen(true)}
            aria-label={t("searchPlaceholder")}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-500 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 cursor-pointer shrink-0"
          >
            <Search className="h-4 w-4" />
            <span className="hidden 2xl:inline max-w-[96px] truncate">
              {locale === "vi" ? "Tìm kiếm..." : "Search..."}
            </span>
          </button>

          {/* Language Switcher */}
          <button
            type="button"
            id="header-locale-btn"
            onClick={toggleLocale}
            title="Switch Vietnamese / English"
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Globe className="h-3.5 w-3.5 text-emerald-600" />
            {locale.toUpperCase()}
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            id="header-theme-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Auth / Avatar menu */}
          {user ? (
            <div className="relative">
              <button
                type="button"
                id="header-avatar-btn"
                onClick={() => setAvatarOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-1.5 pr-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 cursor-pointer"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                  {user.full_name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline max-w-[90px] truncate">
                  {user.full_name}
                </span>
                {user.isPremium && <Crown className="h-3.5 w-3.5 text-amber-500" />}
              </button>

              {avatarOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {user.full_name}
                    </p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {user.role === "admin"
                        ? "Admin"
                        : user.role === "editor"
                        ? "Editor"
                        : user.isPremium
                        ? "Premium"
                        : "Free"}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5 text-sm">
                    <Link
                      href="/profile"
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <User className="h-4 w-4" />
                      {t("profile")}
                    </Link>
                    <Link
                      href="/progress"
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      {t("progress")}
                    </Link>
                    <Link
                      href="/referral"
                      onClick={() => setAvatarOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Gift className="h-4 w-4" />
                      {t("referral")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarOpen(false);
                        openAddFlashcardModal("");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Layers className="h-4 w-4" />
                      + Flashcard
                    </button>
                    {(user.role === "admin" || user.role === "editor") && (
                      <Link
                        href="/admin"
                        onClick={() => setAvatarOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                      >
                        <Shield className="h-4 w-4" />
                        {t("admin")}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : authStatus === "profile_error" ? (
            <Link
              href="/profile"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {locale === "en" ? "Profile error" : "Lỗi tải hồ sơ"}
              </span>
            </Link>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5">
              <Link href="/auth">
                <Button variant="outline" size="sm">
                  {t("login")}
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="sm">{t("tryPremium")}</Button>
              </Link>
            </div>
          )}

          {/* Mobile Drawer toggle */}
          <button
            type="button"
            id="header-mobile-menu-btn"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 xl:hidden dark:border-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Dynamic Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-200 bg-white px-4 py-4 xl:hidden dark:border-slate-800 dark:bg-slate-950">
          <div className="grid grid-cols-2 gap-2 text-sm font-medium">
            {visibleNavItems.map((item) => {
              const label = isEn ? item.labelEn || item.labelVi : item.labelVi;
              const visibleChildren = (item.children ?? []).filter(
                (c) => c.visible && isSafeNavHref(c.href)
              );
              const isExpanded = expandedMobileId === item.id;

              if (visibleChildren.length > 0) {
                return (
                  <div
                    key={item.id}
                    className="col-span-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100"
                      >
                        <DynamicMenuIcon
                          name={item.icon}
                          className="h-4 w-4 text-emerald-600 shrink-0"
                        />
                        <span>{label}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMobileId(isExpanded ? null : item.id)
                        }
                        aria-label={label}
                        className="rounded-lg p-1 text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-slate-200/70 pt-2 dark:border-slate-800">
                        {visibleChildren.map((child) => (
                          <Link
                            key={child.id}
                            href={child.href}
                            onClick={() => setMobileOpen(false)}
                            className="rounded-lg bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:text-emerald-700 dark:bg-slate-950 dark:text-slate-300"
                          >
                            {isEn ? child.labelEn || child.labelVi : child.labelVi}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              if (isExternalUrl(item.href)) {
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900"
                  >
                    <DynamicMenuIcon
                      name={item.icon}
                      className="h-4 w-4 text-emerald-600 shrink-0"
                    />
                    <span className="truncate">{label}</span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900"
                >
                  <DynamicMenuIcon
                    name={item.icon}
                    className="h-4 w-4 text-emerald-600 shrink-0"
                  />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>

          {!user && authStatus === "profile_error" ? (
            <div className="mt-3">
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="block">
                <Button
                  variant="outline"
                  className="w-full border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {locale === "en" ? "Profile error — Retry" : "Lỗi tải hồ sơ — Thử lại"}
                </Button>
              </Link>
            </div>
          ) : (
            !user && (
              <div className="mt-3 flex gap-2">
                <Link href="/auth" onClick={() => setMobileOpen(false)} className="flex-1">
                  <Button variant="outline" className="w-full">
                    {t("login")}
                  </Button>
                </Link>
                <Link href="/pricing" onClick={() => setMobileOpen(false)} className="flex-1">
                  <Button className="w-full">{t("tryPremium")}</Button>
                </Link>
              </div>
            )
          )}
        </div>
      )}

      {/* Search Modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/50 p-4 pt-20 backdrop-blur-xs"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="flex-1 bg-transparent text-sm text-slate-900 focus:outline-none dark:text-white"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 max-h-80 overflow-y-auto space-y-1">
              {searchResults.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  {locale === "vi"
                    ? "Không tìm thấy kết quả phù hợp."
                    : "No matching results found."}
                </p>
              ) : (
                searchResults.map((item) => (
                  <Link
                    key={item.href + item.title}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {item.title}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {item.category}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
