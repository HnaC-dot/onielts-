"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  Calculator,
  CalendarDays,
  CreditCard,
  ExternalLink,
  FileCode2,
  FileText,
  Globe,
  GraduationCap,
  Headphones,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Lock,
  Menu,
  MessageSquare,
  PenTool,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import type { SessionUser } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  phaseBadge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface QuickSearchHit {
  type: "module" | "test" | "blog" | "course" | "user";
  title: string;
  subtitle: string;
  href: string;
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Tổng quan",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Nhật ký hoạt động", href: "/admin/audit", icon: Activity },
      { label: "Quản trị nhanh (6 Tab)", href: "/admin/legacy", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Đề thi & Nội dung",
    items: [
      { label: "Đề thi IELTS", href: "/admin/legacy?tab=tests", icon: BookOpen, phaseBadge: "GĐ3" },
      { label: "Đề thi mỗi ngày", href: "/admin#daily-exam", icon: CalendarDays, phaseBadge: "GĐ3" },
      { label: "Bảng quy đổi Band", href: "/admin/legacy?tab=bands", icon: Calculator, adminOnly: true, phaseBadge: "GĐ3" },
      { label: "Thư viện Media", href: "/admin/media", icon: ImageIcon },
      { label: "Blog & Mẹo thi", href: "/admin/blog", icon: FileText },
    ],
  },
  {
    title: "Học tập & Luyện tập",
    items: [
      { label: "Khóa học & Bài học", href: "/admin#roadmap", icon: GraduationCap, phaseBadge: "GĐ4" },
      { label: "Hội thoại AI", href: "/admin#roadmap", icon: MessageSquare, phaseBadge: "GĐ4" },
      { label: "Nâng cấp câu viết", href: "/admin#roadmap", icon: PenTool, phaseBadge: "GĐ4" },
      { label: "Phát âm IPA", href: "/admin#roadmap", icon: Volume2, phaseBadge: "GĐ4" },
      { label: "Chép chính tả", href: "/admin#roadmap", icon: Headphones, phaseBadge: "GĐ4" },
      { label: "Video tương tác", href: "/admin#roadmap", icon: Video, phaseBadge: "GĐ4" },
    ],
  },
  {
    title: "Hệ thống & SEO",
    items: [
      { label: "Người dùng & Premium", href: "/admin/legacy?tab=users", icon: Users, adminOnly: true, phaseBadge: "GĐ5" },
      { label: "Gói giá & Referral", href: "/admin/legacy?tab=pricing", icon: CreditCard, adminOnly: true, phaseBadge: "GĐ5" },
      { label: "Hộp thư & Phản hồi", href: "/admin#roadmap", icon: Inbox, phaseBadge: "GĐ5" },
      { label: "Trang tĩnh & FAQs", href: "/admin#roadmap", icon: FileCode2, phaseBadge: "GĐ5" },
      { label: "Cài đặt chung", href: "/admin#roadmap", icon: Settings, adminOnly: true, phaseBadge: "GĐ5" },
      { label: "SEO & Redirect 301", href: "/admin#roadmap", icon: Globe, adminOnly: true, phaseBadge: "GĐ6" },
    ],
  },
];

export function AdminShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = user.role === "admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
              Ôn IELTS CMS
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {isAdmin ? "Quản trị viên (Toàn quyền)" : "Biên tập viên (Editor)"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Đóng thanh điều hướng"
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav
        aria-label="Admin CMS Navigation"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.title}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const lockedForEditor = Boolean(item.adminOnly && !isAdmin);
              const baseHref = item.href.split(/[?#]/)[0];
              const isActive =
                !item.href.includes("#") &&
                !item.href.includes("?") &&
                (baseHref === "/admin"
                  ? pathname === "/admin"
                  : pathname === baseHref || pathname.startsWith(`${baseHref}/`));

              if (lockedForEditor) {
                return (
                  <div
                    key={item.label}
                    title="Chỉ dành cho tài khoản Admin"
                    className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-400 dark:text-slate-600 cursor-not-allowed select-none"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 opacity-60" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <Lock className="h-3 w-3 shrink-0" />
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-700 hover:bg-slate-100 hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-emerald-400"
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.phaseBadge && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {item.phaseBadge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
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
            Xem trang public
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
        {/* Top Admin Sub-header with Global Quick Search */}
        <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6 dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Mở menu quản trị"
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
                placeholder="Tìm nhanh trong Admin (⌘K)..."
                aria-label="Tìm kiếm nhanh trong trang quản trị"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
              {searchFocused && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  {hits.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-slate-500">
                      Không tìm thấy mục nào khớp từ khóa.
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
            <span className="text-slate-500 dark:text-slate-400">
              GĐ2 · Media &amp; Blog SEO Active
            </span>
          </div>
        </div>

        <div className="flex-1 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
