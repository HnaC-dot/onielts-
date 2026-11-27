import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import {
  getBlogPosts,
  getConversationTopics,
  getCourses,
  getDictationLessons,
  getIeltsTests,
  getLearnVideos,
  getPronunciationSounds,
  getWritingExercises,
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
  { title: "Thống kê học tập (Đề hot & Câu hay sai)", keywords: "analytics thong ke hoc tap ty le sai de lam nhieu nhat progress", href: "/admin/analytics" },
  { title: "Quản lý Đề thi IELTS (Trình tạo 40 câu)", keywords: "de thi reading listening writing speaking tests", href: "/admin/tests" },
  { title: "Tạo đề thi IELTS mới", keywords: "tao de thi moi them de new test", href: "/admin/tests/new" },
  { title: "Lịch Đề thi mỗi ngày (UTC+7) & BXH", keywords: "daily exam de moi ngay lich bxh leaderboard", href: "/admin/daily-exam" },
  { title: "Bảng quy đổi Band", keywords: "band score conversion calculator", href: "/admin/band-tables", adminOnly: true },
  { title: "Thư viện Media (Ảnh / MP3 / SVG / PDF)", keywords: "media thu vien anh upload mp3 svg pdf", href: "/admin/media" },
  { title: "Blog & Mẹo thi (SEO Editor)", keywords: "blog bai viet seo tin tuc meo thi", href: "/admin/blog" },
  { title: "Viết bài Blog mới", keywords: "viet bai blog moi tao bai viet new", href: "/admin/blog/new" },
  { title: "Khóa học & Bài học (Kéo-thả bài)", keywords: "khoa hoc courses bai hoc lesson quiz", href: "/admin/courses" },
  { title: "Hội thoại AI (Speaking Role-play)", keywords: "hoi thoai ai speaking conversations prompt", href: "/admin/conversations" },
  { title: "Bài tập nâng cấp câu viết (Band 5.5 → 8.0)", keywords: "nang cap cau viet writing exercises band 8", href: "/admin/writing-exercises" },
  { title: "Phát âm IPA (Khẩu hình & Audio)", keywords: "phat am ipa pronunciation vowel consonant", href: "/admin/pronunciation" },
  { title: "Chép chính tả & Shadowing (Dictation)", keywords: "chep chinh ta dictation shadowing mp3", href: "/admin/dictation" },
  { title: "Video tương tác (YouTube & .SRT/.VTT)", keywords: "video tuong tac youtube phu de srt vtt transcript", href: "/admin/videos" },
  { title: "Nhật ký hoạt động (Audit Logs)", keywords: "audit log nhat ky lich su", href: "/admin/audit" },
  { title: "Người dùng, Phân quyền & Premium", keywords: "users profile premium order don hang role khoa tai khoan", href: "/admin/users", adminOnly: true },
  { title: "Gói giá, Mã giảm giá & Referral", keywords: "pricing promo code banner goi gia referral gioi thieu", href: "/admin/pricing", adminOnly: true },
  { title: "Hộp thư Liên hệ & Đề xuất tính năng", keywords: "inbox hop thu contact lien he feature request de xuat", href: "/admin/inbox" },
  { title: "Trang tĩnh (/about, /legal/*) & FAQs", keywords: "pages trang tinh about legal privacy terms faq", href: "/admin/pages" },
  { title: "Cài đặt chung Website (Logo, Banner, MXH)", keywords: "settings cai dat chung logo hotline email thong bao", href: "/admin/settings", adminOnly: true },
  { title: "Giao diện & Trang chủ (Theme, Menu, Footer, Bảo trì)", keywords: "appearance giao dien trang chu theme font logo favicon menu sidebar header footer banner popup chat zalo messenger cookie 404 bao tri maintenance ui text", href: "/admin/appearance", adminOnly: true },
  { title: "SEO toàn trang, Sitemap, Robots & Redirect 301", keywords: "seo redirect 301 302 sitemap robots ga4 google analytics search console og meta", href: "/admin/seo", adminOnly: true },
  { title: "Quản trị nhanh (Legacy 6 Tab)", keywords: "legacy tab ai band pricing tests blog users", href: "/admin/legacy" },
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
    const [tests, posts, courses, conversations, exercises, sounds, dictations, videos, profiles] =
      await Promise.all([
        getIeltsTests(true),
        getBlogPosts(true),
        getCourses(true),
        getConversationTopics(true),
        getWritingExercises(true),
        getPronunciationSounds(true),
        getDictationLessons(true),
        getLearnVideos(true),
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
          subtitle: `${t.skill.toUpperCase()} · ${t.questionCount} câu · /tests/${t.slug}`,
          href: `/admin/tests/${t.id}`,
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
          subtitle: `Khóa học · Target ${c.target_band} · ${c.lessons.length} bài`,
          href: "/admin/courses",
        });
      }
    }

    for (const cv of conversations) {
      if (cv.title_vi.toLowerCase().includes(q) || cv.title_en.toLowerCase().includes(q) || cv.slug.toLowerCase().includes(q)) {
        results.push({
          type: "course",
          title: cv.title_vi,
          subtitle: `Hội thoại AI · ${cv.part}`,
          href: "/admin/conversations",
        });
      }
    }

    for (const we of exercises) {
      if (we.title_vi.toLowerCase().includes(q) || we.topic.toLowerCase().includes(q)) {
        results.push({
          type: "course",
          title: we.title_vi,
          subtitle: `Nâng cấp câu · ${we.topic}`,
          href: "/admin/writing-exercises",
        });
      }
    }

    for (const s of sounds) {
      if (s.symbol.toLowerCase().includes(q) || s.title_vi.toLowerCase().includes(q)) {
        results.push({
          type: "course",
          title: `${s.symbol} ${s.title_vi}`,
          subtitle: `Phát âm IPA · ${s.category}`,
          href: "/admin/pronunciation",
        });
      }
    }

    for (const d of dictations) {
      if (d.title_vi.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)) {
        results.push({
          type: "course",
          title: d.title_vi,
          subtitle: `Chép chính tả · ${d.accent}`,
          href: "/admin/dictation",
        });
      }
    }

    for (const v of videos) {
      if (v.title_vi.toLowerCase().includes(q) || v.youtube_id.toLowerCase().includes(q)) {
        results.push({
          type: "course",
          title: v.title_vi,
          subtitle: `Video · ${v.duration_label}`,
          href: "/admin/videos",
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
            href: "/admin/users",
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
