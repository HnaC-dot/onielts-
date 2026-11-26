"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  ExternalLink,
  Lock,
  Menu,
  Search,
  Shield,
  X,
} from "lucide-react";
import type { SessionUser } from "@/lib/types";
import {
  DEFAULT_ADMIN_SIDEBAR_MENU,
  isSafeNavHref,
  resolveAdminRouteBreadcrumb,
  type AdminMenuGroup,
} from "@/lib/appearance-shared";
import { DynamicMenuIcon } from "@/components/admin/icon-registry";
import { Badge } from "@/components/ui/badge";

interface QuickSearchHit {
  type: "module" | "test" | "blog" | "course" | "user";
  title: string;
  subtitle: string;
  href: string;
}

export function AdminShell({
  user,
  adminMenu = DEFAULT_ADMIN_SIDEBAR_MENU,
  locale = "vi",
  siteName = "Ôn IELTS",
  children,
}: {
  user: SessionUser;
  adminMenu?: AdminMenuGroup[];
  locale?: string;
  siteName?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const isAdmin = user.role === "admin";
  const isEn = locale === "en";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuGroups =
    adminMenu && adminMenu.length > 0 ? adminMenu : DEFAULT_ADMIN_SIDEBAR_MENU;
  const visibleGroups = menuGroups.filter((g) => g.visible);

  // Shared VI/EN name resolution across Sidebar, Breadcrumb, and Page Title
  const breadcrumb = resolveAdminRouteBreadcrumb(pathname, menuGroups, locale);

  // Sync browser tab title with customized CMS menu label so renaming a module
  // reflects simultaneously in Sidebar, Breadcrumb, and Page Title (without changing URL)
  useEffect(() => {
    if (!breadcrumb.itemLabel) return;
    const prefix = breadcrumb.subLabel
      ? `${breadcrumb.subLabel} · ${breadcrumb.itemLabel}`
      : breadcrumb.itemLabel;
    document.title = `${prefix} | CMS ${siteName}`;
  }, [breadcrumb.itemLabel, breadcrumb.subLabel, siteName]);

  // Global quick search state
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [hits, setHits] = useState<QuickSearchHit[]>([]);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (
        searchBoxRef.current &&
        !searchBoxRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchFocused(true);
        const input = searchBoxRef.current?.querySelector("input");
        input?.focus();
      }
      if (e.key === "Escape") {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!searchFocused) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(query)}`
        );
        if (res.ok && active) {
          const data = await res.json();
          setHits(data.results ?? []);
        }
      } catch {
        // ignore transient search errors
      }
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, searchFocused]);

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Shield className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
              {siteName} CMS
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {isAdmin
                ? isEn
                  ? "Administrator (Full Access)"
                  : "Quản trị viên (Toàn quyền)"
                : isEn
                ? "Content Editor"
                : "Biên tập viên (Editor)"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label={isEn ? "Close navigation" : "Đóng thanh điều hướng"}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav
        aria-label="Admin CMS Navigation"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
      >
        {visibleGroups.map((group) => {
          const visibleItems = group.items.filter(
            (it) => it.visible && isSafeNavHref(it.href)
          );
          if (visibleItems.length === 0) return null;
          const groupLabel = isEn ? group.labelEn || group.labelVi : group.labelVi;

          return (
            <div key={group.id} className="space-y-1">
              <p className="px-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {groupLabel}
              </p>
              {visibleItems.map((item) => {
                const itemLabel = isEn ? item.labelEn || item.labelVi : item.labelVi;
                const lockedForEditor = Boolean(item.adminOnly && !isAdmin);
                const baseHref = item.href.split(/[?#]/)[0];
                const isActive =
                  !item.href.includes("#") &&
                  !item.href.includes("?") &&
                  (baseHref === "/admin"
                    ? pathname === "/admin"
                    : pathname === baseHref || pathname.startsWith(`${baseHref}/`));

                const visibleChildren = (item.children ?? []).filter(
                  (c) => c.visible && isSafeNavHref(c.href)
                );

                if (lockedForEditor) {
                  return (
                    <div
                      key={item.id}
                      title={
                        isEn
                          ? "Admin account required"
                          : "Chỉ dành cho tài khoản Admin"
                      }
                      className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-400 dark:text-slate-600 cursor-not-allowed select-none"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <DynamicMenuIcon
                          name={item.icon}
                          className="h-4 w-4 shrink-0 opacity-60"
                        />
                        <span className="truncate">{itemLabel}</span>
                      </span>
                      <Lock className="h-3 w-3 shrink-0" />
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="space-y-0.5">
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-700 hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-emerald-400"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <DynamicMenuIcon
                          name={item.icon}
                          className="h-4 w-4 shrink-0"
                        />
                        <span className="truncate">{itemLabel}</span>
                      </span>
                    </Link>

                    {visibleChildren.length > 0 && (
                      <div className="ml-4 space-y-0.5 border-l border-slate-200 pl-2.5 dark:border-slate-800">
                        {visibleChildren.map((child) => {
                          const cLabel = isEn
                            ? child.labelEn || child.labelVi
                            : child.labelVi;
                          const cActive = pathname === child.href;
                          return (
                            <Link
                              key={child.id}
                              href={child.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`block truncate rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
                                cActive
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "text-slate-600 hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-slate-800/70"
                              }`}
                            >
                              {cLabel}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
              {user.full_name}
            </p>
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? "Admin" : "Editor"}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            {user.email}
          </p>
          <Link
            href="/"
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {isEn ? "View public site" : "Xem trang public"}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-950">
        <div className="sticky top-16 h-[calc(100vh-4rem)]">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 flex bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="h-full w-72 max-w-[85vw] bg-white shadow-2xl dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main workspace */}
      <div className="flex min-w-0 flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/30">
        {/* Top Admin Sub-header with Global Quick Search + Shared Page Title */}
        <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label={isEn ? "Open admin menu" : "Mở menu quản trị"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden dark:border-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div ref={searchBoxRef} className="relative w-64 sm:w-80 md:w-96">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={query}
                onFocus={() => setSearchFocused(true)}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  isEn
                    ? "Quick search in Admin (⌘K)..."
                    : "Tìm nhanh trong Admin (⌘K)..."
                }
                aria-label={
                  isEn
                    ? "Quick search in admin panel"
                    : "Tìm kiếm nhanh trong trang quản trị"
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
              {searchFocused && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  {hits.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-slate-500">
                      {isEn
                        ? "No matching items found."
                        : "Không tìm thấy mục nào khớp từ khóa."}
                    </p>
                  ) : (
                    hits.map((hit) => (
                      <Link
                        key={`${hit.type}-${hit.href}-${hit.title}`}
                        href={hit.href}
                        onClick={() => {
                          setSearchFocused(false);
                          setQuery("");
                        }}
                        className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900 dark:text-white">
                            {hit.title}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {hit.subtitle}
                          </p>
                        </div>
                        <Badge variant="secondary">{hit.type}</Badge>
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs">
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? "Admin" : "Editor"}
            </Badge>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {breadcrumb.itemLabel || "CMS"}
            </span>
          </div>
        </div>

        {/* Synchronized Breadcrumb & Active Section Bar (shares VI/EN names with Sidebar & Page Title) */}
        {breadcrumb.itemLabel && (
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 bg-white/60 px-4 py-2 text-xs text-slate-500 sm:px-6 lg:px-8 dark:border-slate-800/80 dark:bg-slate-950/40 dark:text-slate-400"
          >
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link
                  href="/admin"
                  className="font-medium hover:text-emerald-700 dark:hover:text-emerald-400"
                >
                  Admin
                </Link>
              </li>
              {breadcrumb.groupLabel && (
                <>
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                  </li>
                  <li className="font-medium text-slate-600 dark:text-slate-300">
                    {breadcrumb.groupLabel}
                  </li>
                </>
              )}
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5 opacity-60" />
              </li>
              <li>
                {breadcrumb.subLabel && breadcrumb.itemHref ? (
                  <Link
                    href={breadcrumb.itemHref}
                    className="font-medium hover:text-emerald-700 dark:hover:text-emerald-400"
                  >
                    {breadcrumb.itemLabel}
                  </Link>
                ) : (
                  <span className="font-bold text-slate-900 dark:text-white">
                    {breadcrumb.itemLabel}
                  </span>
                )}
              </li>
              {breadcrumb.subLabel && (
                <>
                  <li aria-hidden="true">
                    <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                  </li>
                  <li className="font-bold text-slate-900 dark:text-white">
                    {breadcrumb.subLabel}
                  </li>
                </>
              )}
            </ol>

            <span className="hidden md:inline font-mono text-[11px] text-slate-400">
              {pathname}
            </span>
          </nav>
        )}

        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
