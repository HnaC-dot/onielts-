import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import {
  getBlogPosts,
  getCourses,
  getIeltsTests,
  listAllProfiles,
} from "@/lib/db";

export const dynamic = "force-dynamic";

interface AdminSearchHit {
  type: "module" | "test" | "blog" | "course" | "user";
  title: string;
  subtitle: string;
  href: string;
}

const ADMIN_QUICK_LINKS: Array<{
  title: string;
  keywords: string;
  href: string;
  adminOnly?: boolean;
}> = [
  { title: "Dashboard Tổng quan", keywords: "dashboard tong quan home", href: "/admin" },
  { title: "Thư viện Media (Ảnh / MP3 / SVG / PDF)", keywords: "media thu vien anh upload mp3 svg pdf", href: "/admin/media" },
  { title: "Blog & Mẹo thi (SEO Editor)", keywords: "blog bai viet seo tin tuc meo thi", href: "/admin/blog" },
  { title: "Viết bài Blog mới", keywords: "viet bai blog moi tao bai viet new", href: "/admin/blog/new" },
  { title: "Nhật ký hoạt động (Audit Logs)", keywords: "audit log nhat ky lich su", href: "/admin/audit" },
  { title: "Quản trị nhanh (Legacy 6 Tab)", keywords: "legacy tab ai band pricing tests blog users", href: "/admin/legacy" },
  { title: "Quản lý Đề thi IELTS", keywords: "de thi reading listening writing speaking tests", href: "/admin/legacy?tab=tests" },
  { title: "Bảng quy đổi Band", keywords: "band score conversion calculator", href: "/admin/legacy?tab=bands", adminOnly: true },
  { title: "Bảng giá & Khuyến mãi", keywords: "pricing promo code banner goi gia", href: "/admin/legacy?tab=pricing", adminOnly: true },
  { title: "Người dùng & Đơn hàng", keywords: "users profile premium order don hang", href: "/admin/legacy?tab=users", adminOnly: true },
];

export async function GET(req: Request) {
  const guard = await requireStaff("editor");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const isAdmin = guard.user.role === "admin";

  const results: AdminSearchHit[] = [];

  for (const item of ADMIN_QUICK_LINKS) {
    if (item.adminOnly && !isAdmin) continue;
    if (
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.keywords.includes(q)
    ) {
      results.push({
        type: "module",
        title: item.title,
        subtitle: item.href,
        href: item.href,
      });
    }
  }

  if (q.length >= 2) {
    const [tests, posts, courses, profiles] = await Promise.all([
      getIeltsTests(true),
      getBlogPosts(true),
      getCourses(),
      isAdmin ? listAllProfiles() : Promise.resolve([]),
    ]);

    for (const t of tests) {
      if (
        t.title_vi.toLowerCase().includes(q) ||
        t.title_en.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q)
      ) {
        results.push({
          type: "test",
          title: t.title_vi,
          subtitle: `${t.skill.toUpperCase()} · /tests/${t.slug}`,
          href: `/tests/${t.slug}`,
        });
      }
      if (results.length >= 25) break;
    }

    for (const p of posts) {
      if (
        p.title_vi.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      ) {
        results.push({
          type: "blog",
          title: p.title_vi,
          subtitle: `Blog · ${p.category} · /blog/${p.slug}`,
          href: `/admin/blog/${p.id}`,
        });
      }
      if (results.length >= 30) break;
    }

    for (const c of courses) {
      if (
        c.title_vi.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
      ) {
        results.push({
          type: "course",
          title: c.title_vi,
          subtitle: `Course · Target ${c.target_band}`,
          href: `/courses/${c.slug}`,
        });
      }
    }

    if (isAdmin) {
      for (const u of profiles) {
        if (
          u.email.toLowerCase().includes(q) ||
          u.full_name.toLowerCase().includes(q)
        ) {
          results.push({
            type: "user",
            title: u.full_name || u.email,
            subtitle: `${u.email} · ${u.role}`,
            href: "/admin/legacy?tab=users",
          });
        }
        if (results.length >= 35) break;
      }
    }
  }

  return NextResponse.json(
    { results: results.slice(0, 20) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
