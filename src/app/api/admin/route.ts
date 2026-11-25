import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readStore, updateStore } from "@/lib/store";
import { computeExtendedPremiumExpiry } from "@/lib/payments/payos";
import type { IeltsTest } from "@/lib/types";

const adminActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_band_row"),
    id: z.string().min(1),
    min_raw: z.number().int().min(0).max(40),
    max_raw: z.number().int().min(0).max(40),
    band_score: z.number().min(0).max(9),
  }),
  z.object({
    action: z.literal("update_plan"),
    id: z.string().min(1),
    price_vnd: z.number().int().min(1000),
    original_price_vnd: z.number().int().min(1000),
    is_popular: z.boolean(),
    is_active: z.boolean(),
  }),
  z.object({
    action: z.literal("update_promo_banner"),
    title_vi: z.string().min(5).max(300),
    title_en: z.string().min(5).max(300),
    ends_at: z.string().min(10),
    is_active: z.boolean(),
  }),
  z.object({
    action: z.literal("create_promo_code"),
    code: z.string().trim().min(3).max(30),
    discount_percent: z.number().int().min(1).max(90),
    max_discount_vnd: z.number().int().min(1000).nullable().optional(),
  }),
  z.object({
    action: z.literal("toggle_promo_code"),
    id: z.string().min(1),
    is_active: z.boolean(),
  }),
  z.object({
    action: z.literal("create_test_json"),
    testJson: z.string().min(20).max(50000),
  }),
  z.object({
    action: z.literal("toggle_test_publish"),
    id: z.string().min(1),
    is_published: z.boolean(),
  }),
  z.object({
    action: z.literal("update_user_admin"),
    userId: z.string().min(1),
    role: z.enum(["learner", "admin"]).optional(),
    grantMonths: z.number().int().min(0).max(36).optional(),
    revokePremium: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("create_blog_post"),
    title_vi: z.string().min(5).max(200),
    excerpt_vi: z.string().min(10).max(400),
    content_vi: z.string().min(20).max(10000),
    category: z.string().min(2).max(60),
  }),
]);

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền truy cập." }, { status: 403 });
  }
  const store = readStore();
  return NextResponse.json({
    profiles: store.profiles,
    band_conversion_tables: store.band_conversion_tables,
    pricing_plans: store.pricing_plans,
    promo_banner: store.promo_banner,
    promo_codes: store.promo_codes,
    orders: store.orders,
    ai_usage_logs: store.ai_usage_logs.slice(0, 100),
    ielts_tests: store.ielts_tests,
    blog_posts: store.blog_posts,
    testimonials: store.testimonials,
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Chỉ quản trị viên mới có quyền thực hiện." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = adminActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu quản trị không hợp lệ." },
        { status: 400 }
      );
    }

    const d = parsed.data;

    if (d.action === "update_band_row") {
      updateStore((store) => {
        const row = store.band_conversion_tables.find((r) => r.id === d.id);
        if (row) {
          row.min_raw = d.min_raw;
          row.max_raw = Math.max(d.min_raw, d.max_raw);
          row.band_score = d.band_score;
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "update_plan") {
      updateStore((store) => {
        const plan = store.pricing_plans.find((p) => p.id === d.id);
        if (plan) {
          plan.price_vnd = d.price_vnd;
          plan.original_price_vnd = Math.max(d.price_vnd, d.original_price_vnd);
          plan.is_popular = d.is_popular;
          plan.is_active = d.is_active;
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "update_promo_banner") {
      updateStore((store) => {
        store.promo_banner.title_vi = d.title_vi;
        store.promo_banner.title_en = d.title_en;
        store.promo_banner.ends_at = d.ends_at;
        store.promo_banner.is_active = d.is_active;
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "create_promo_code") {
      updateStore((store) => {
        store.promo_codes.unshift({
          id: `code-${Date.now()}`,
          code: d.code.toUpperCase(),
          discount_percent: d.discount_percent,
          max_discount_vnd: d.max_discount_vnd ?? null,
          max_uses: 500,
          current_uses: 0,
          expires_at: "2027-12-31T16:59:59.000Z",
          is_active: true,
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "toggle_promo_code") {
      updateStore((store) => {
        const c = store.promo_codes.find((item) => item.id === d.id);
        if (c) c.is_active = d.is_active;
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "toggle_test_publish") {
      updateStore((store) => {
        const t = store.ielts_tests.find((item) => item.id === d.id);
        if (t) t.is_published = d.is_published;
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "create_test_json") {
      const parsedTest = JSON.parse(d.testJson) as Partial<IeltsTest>;
      if (!parsedTest.slug || !parsedTest.skill || !parsedTest.title_vi) {
        return NextResponse.json(
          { error: "JSON đề thi cần tối thiểu: slug, skill, title_vi." },
          { status: 400 }
        );
      }
      updateStore((store) => {
        const created: IeltsTest = {
          id: `test-custom-${Date.now()}`,
          slug: parsedTest.slug!,
          skill: parsedTest.skill!,
          module: parsedTest.module ?? "academic",
          title_vi: parsedTest.title_vi!,
          title_en: parsedTest.title_en ?? parsedTest.title_vi!,
          description_vi: parsedTest.description_vi ?? "Đề luyện tập tạo từ bảng quản trị.",
          description_en: parsedTest.description_en ?? "Custom practice test created in admin.",
          duration_minutes: parsedTest.duration_minutes ?? 60,
          difficulty: parsedTest.difficulty ?? "band_6_7",
          questionCount:
            parsedTest.sections?.flatMap((s) => s.questions).length ??
            parsedTest.questionCount ??
            1,
          is_published: true,
          is_daily_eligible: Boolean(parsedTest.is_daily_eligible),
          sections: parsedTest.sections ?? [],
          created_at: new Date().toISOString(),
        };
        store.ielts_tests.unshift(created);
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "update_user_admin") {
      updateStore((store) => {
        const u = store.profiles.find((p) => p.id === d.userId);
        if (!u) return;
        if (d.role) u.role = d.role;
        if (d.revokePremium) {
          u.premium_expires_at = null;
        } else if (d.grantMonths && d.grantMonths > 0) {
          u.premium_expires_at = computeExtendedPremiumExpiry(
            u.premium_expires_at,
            d.grantMonths
          );
        }
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "create_blog_post") {
      const slug = d.title_vi
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      updateStore((store) => {
        store.blog_posts.unshift({
          id: `blog-${Date.now()}`,
          slug: `${slug || "bai-viet"}-${Date.now().toString().slice(-4)}`,
          title_vi: d.title_vi,
          title_en: d.title_vi,
          excerpt_vi: d.excerpt_vi,
          excerpt_en: d.excerpt_vi,
          content_vi: d.content_vi,
          content_en: d.content_vi,
          category: d.category,
          author_name: admin.full_name,
          read_minutes: Math.max(2, Math.round(d.content_vi.split(/\s+/).length / 180)),
          published_at: new Date().toISOString(),
          is_published: true,
        });
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Không thể thực hiện thao tác quản trị." }, { status: 500 });
  }
}
