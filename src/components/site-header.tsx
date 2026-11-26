"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  ChevronDown,
  Crown,
  Flame,
  Gift,
  Globe,
  Headphones,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  PenTool,
  Search,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  User,
  Video,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { Button } from "./ui/button";
import { openAddFlashcardModal } from "./flashcard-quick-add";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuthResolutionStatus, SessionUser } from "@/lib/types";

interface SiteHeaderProps {
  user: SessionUser | null;
  authStatus?: AuthResolutionStatus;
}

interface SearchResult {
  title: string;
  href: string;
  category: string;
}

export function SiteHeader({ user, authStatus }: SiteHeaderProps) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [openMenu, setOpenMenu] = useState<"ielts" | "writing" | "tools" | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setAvatarOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpenMenu(null);
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
          const data = await res.json();
          setSearchResults(data.results ?? []);
        }
      } catch {
        // ignore
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  const toggleLocale = async () => {
    const nextLocale = locale === "vi" ? "en" : "vi";
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: nextLocale }),
    });
    window.location.reload();
  };

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setAvatarOpen(false);
    router.refresh();
  };

  const navLinkCls =
    "inline-flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-slate-700 transition hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-emerald-400 whitespace-nowrap";

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90"
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/" className="shrink-0" aria-label="Ôn IELTS">
            <BrandLogo />
          </Link>

          {/* Desktop 9-item Mega Navigation */}
          <nav className="hidden xl:flex items-center gap-0" aria-label="Main navigation">
            {/* 1. IELTS mega-menu */}
            <div className="relative">
              <button
                type="button"
                id="nav-ielts-trigger"
                onClick={() => setOpenMenu(openMenu === "ielts" ? null : "ielts")}
                className={navLinkCls + " cursor-pointer"}
              >
                {t("ielts")}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
              {openMenu === "ielts" && (
                <div className="absolute left-0 top-full mt-2 w-[540px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/tests?skill=reading"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <BookOpen className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t("menu.readingTests")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("menu.readingDesc")}
                        </p>
                      </div>
                    </Link>
                    <Link
                      href="/tests?skill=listening"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <Headphones className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t("menu.listeningTests")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("menu.listeningDesc")}
                        </p>
                      </div>
                    </Link>
                    <Link
                      href="/writing"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <PenTool className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t("menu.writingTests")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("menu.writingDesc")}
                        </p>
                      </div>
                    </Link>
                    <Link
                      href="/speaking"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <Mic className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t("menu.speakingTests")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("menu.speakingDesc")}
                        </p>
                      </div>
                    </Link>
                    <Link
                      href="/daily-exam"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <Flame className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t("menu.dailyExams")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("menu.dailyExamsDesc")}
                        </p>
                      </div>
                    </Link>
                    <Link
                      href="/leaderboard"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <Trophy className="mt-0.5 h-5 w-5 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t("menu.leaderboard")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("menu.leaderboardDesc")}
                        </p>
                      </div>
                    </Link>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <Link
                      href="/band-calculator"
                      onClick={() => setOpenMenu(null)}
                      className="flex items-center justify-between rounded-xl bg-emerald-50/70 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100/80 dark:bg-emerald-950/50 dark:text-emerald-300"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        {t("menu.bandCalculator")}
                      </span>
                      <span className="text-xs font-normal opacity-80">6.25 → 6.5</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Courses */}
            <Link href="/courses" className={navLinkCls}>
              {t("courses")}
            </Link>

            {/* 3. AI Conversations */}
            <Link href="/conversations" className={navLinkCls}>
              {t("conversations")}
            </Link>

            {/* 4. Writing mega-menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === "writing" ? null : "writing")}
                className={navLinkCls + " cursor-pointer"}
              >
                {t("writing")}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
              {openMenu === "writing" && (
                <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <Link
                    href="/writing"
                    onClick={() => setOpenMenu(null)}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t("menu.writingChecker")}
                  </Link>
                  <Link
                    href="/writing/generator"
                    onClick={() => setOpenMenu(null)}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t("menu.writingGenerator")}
                  </Link>
                  <Link
                    href="/writing/exercises"
                    onClick={() => setOpenMenu(null)}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t("menu.writingExercises")}
                  </Link>
                </div>
              )}
            </div>

            {/* 5. Pronunciation */}
            <Link href="/pronunciation" className={navLinkCls}>
              {t("pronunciation")}
            </Link>

            {/* 6. Dictation/Shadowing */}
            <Link href="/dictation" className={navLinkCls}>
              {t("dictation")}
            </Link>

            {/* 7. Flashcards */}
            <Link href="/flashcards" className={navLinkCls}>
              {t("flashcards")}
            </Link>

            {/* 8. Videos */}
            <Link href="/videos" className={navLinkCls}>
              {t("videos")}
            </Link>

            {/* 9. Tools mega-menu */}
            <div className="relative">
              <button
                type="button"
                id="nav-tools-trigger"
                onClick={() => setOpenMenu(openMenu === "tools" ? null : "tools")}
                className={navLinkCls + " cursor-pointer"}
              >
                {t("tools")}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
              {openMenu === "tools" && (
                <div className="absolute right-0 top-full mt-2 w-[420px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid grid-cols-2 gap-1.5 text-sm">
                    <Link href="/tools/paraphraser" onClick={() => setOpenMenu(null)} className="rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Paraphraser
                    </Link>
                    <Link href="/tools/summarizer" onClick={() => setOpenMenu(null)} className="rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Summarizer
                    </Link>
                    <Link href="/tools/translator" onClick={() => setOpenMenu(null)} className="rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Translator (EN⇄VI)
                    </Link>
                    <Link href="/tools/grammar-checker" onClick={() => setOpenMenu(null)} className="rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Grammar Checker
                    </Link>
                    <Link href="/tools/grammar-corrector" onClick={() => setOpenMenu(null)} className="rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Grammar Corrector
                    </Link>
                    <Link href="/tools/text-improver" onClick={() => setOpenMenu(null)} className="rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Text Improver
                    </Link>
                    <Link href="/tools/complex-sentence-explainer" onClick={() => setOpenMenu(null)} className="rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Complex Sentence
                    </Link>
                    <Link href="/tools/text-to-speech" onClick={() => setOpenMenu(null)} className="rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                      Text-to-Speech
                    </Link>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
                    <Link
                      href="/mentor"
                      onClick={() => setOpenMenu(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {t("menu.mentorAi")}
                    </Link>
                    <Link
                      href="/tools"
                      onClick={() => setOpenMenu(null)}
                      className="text-xs font-medium text-slate-600 hover:text-emerald-700 dark:text-slate-400"
                    >
                      {t("menu.allTools")} →
                    </Link>
                  </div>
                </div>
              )}
            </div>
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
                    {user.role === "admin" && (
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

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 xl:hidden dark:border-slate-800 dark:bg-slate-950">
          <div className="grid grid-cols-2 gap-2 text-sm font-medium">
            <Link href="/tests" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <BookOpen className="h-4 w-4 text-emerald-600" /> {t("ielts")}
            </Link>
            <Link href="/courses" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <Layers className="h-4 w-4 text-emerald-600" /> {t("courses")}
            </Link>
            <Link href="/conversations" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <MessageSquare className="h-4 w-4 text-emerald-600" /> {t("conversations")}
            </Link>
            <Link href="/writing" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <PenTool className="h-4 w-4 text-emerald-600" /> {t("writing")}
            </Link>
            <Link href="/pronunciation" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <Volume2 className="h-4 w-4 text-emerald-600" /> {t("pronunciation")}
            </Link>
            <Link href="/dictation" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <Headphones className="h-4 w-4 text-emerald-600" /> {t("dictation")}
            </Link>
            <Link href="/flashcards" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <Layers className="h-4 w-4 text-emerald-600" /> {t("flashcards")}
            </Link>
            <Link href="/videos" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <Video className="h-4 w-4 text-emerald-600" /> {t("videos")}
            </Link>
            <Link href="/tools" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <Wrench className="h-4 w-4 text-emerald-600" /> {t("tools")}
            </Link>
            <Link href="/band-calculator" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
              <Calculator className="h-4 w-4 text-emerald-600" /> Band Calc
            </Link>
          </div>
          {!user && authStatus === "profile_error" ? (
            <div className="mt-3">
              <Link href="/profile" onClick={() => setMobileOpen(false)} className="block">
                <Button variant="outline" className="w-full border-amber-300 text-amber-800 dark:border-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  {locale === "en" ? "Profile error — Retry" : "Lỗi tải hồ sơ — Thử lại"}
                </Button>
              </Link>
            </div>
          ) : !user && (
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
                  {locale === "vi" ? "Không tìm thấy kết quả phù hợp." : "No matching results found."}
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
