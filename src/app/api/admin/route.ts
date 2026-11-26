import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthState } from "@/lib/auth";
import {
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  adminCreateBlogPost,
  adminCreatePromoCode,
  adminCreateTest,
  adminTogglePromoCode,
  adminToggleTestPublish,
  adminUpdateBandRow,
  adminUpdatePricingPlan,
  adminUpdatePromoBanner,
  adminUpdateUser,
  getBandConversionTables,
  getBlogPosts,
  getIeltsTests,
  getPricingPlans,
  getPromoBanner,
  getPromoCodes,
  getSampleTestimonials,
  listAiUsageLogs,
  listAllProfiles,
  listOrders,
} from "@/lib/db";
import type { IeltsTest, SessionUser } from "@/lib/types";

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
    testJson: z.string().min(20).max(200000),
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

async function requireAdmin(): Promise<
  { ok: true; admin: SessionUser } | { ok: false; response: NextResponse }
> {
  const authState = await getAuthState();
  if (authState.status === "profile_error") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Đã xác thực nhưng không thể tải hồ sơ quản trị từ cơ sở dữ liệu." },
        { status: 503 }
      ),
    };
  }
  if (!authState.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Vui lòng đăng nhập bằng tài khoản quản trị." },
        { status: 401 }
      ),
    };
  }
  if (authState.user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Chỉ quản trị viên mới có quyền truy cập." },
        { status: 403 }
      ),
    };
  }
  if (isSupabaseConfigured() && !isServiceRoleConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Máy chủ thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY cho thao tác quản trị." },
        { status: 503 }
      ),
    };
  }
  return { ok: true, admin: authState.user };
}

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }
  const [
    profiles,
    band_conversion_tables,
    pricing_plans,
    promo_banner,
    promo_codes,
    orders,
    ai_usage_logs,
    ielts_tests,
    blog_posts,
    testimonials,
  ] = await Promise.all([
    listAllProfiles(),
    getBandConversionTables(),
    getPricingPlans(true),
    getPromoBanner(),
    getPromoCodes(),
    listOrders(),
    listAiUsageLogs(100),
    getIeltsTests(true),
    getBlogPosts(true),
    getSampleTestimonials(),
  ]);
  return NextResponse.json({
    profiles,
    band_conversion_tables,
    pricing_plans,
    promo_banner,
    promo_codes,
    orders,
    ai_usage_logs,
    ielts_tests,
    blog_posts,
    testimonials,
  });
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return guard.response;
  }
  const admin = guard.admin;

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
      await adminUpdateBandRow(d.id, {
        min_raw: d.min_raw,
        max_raw: d.max_raw,
        band_score: d.band_score,
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "update_plan") {
      await adminUpdatePricingPlan(d.id, {
        price_vnd: d.price_vnd,
        original_price_vnd: d.original_price_vnd,
        is_popular: d.is_popular,
        is_active: d.is_active,
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "update_promo_banner") {
      await adminUpdatePromoBanner({
        title_vi: d.title_vi,
        title_en: d.title_en,
        ends_at: d.ends_at,
        is_active: d.is_active,
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "create_promo_code") {
      await adminCreatePromoCode({
        code: d.code,
        discount_percent: d.discount_percent,
        max_discount_vnd: d.max_discount_vnd ?? null,
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "toggle_promo_code") {
      await adminTogglePromoCode(d.id, d.is_active);
      return NextResponse.json({ ok: true });
    }

    if (d.action === "toggle_test_publish") {
      await adminToggleTestPublish(d.id, d.is_published);
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
      await adminCreateTest(parsedTest, admin.id);
      return NextResponse.json({ ok: true });
    }

    if (d.action === "update_user_admin") {
      await adminUpdateUser({
        userId: d.userId,
        role: d.role,
        grantMonths: d.grantMonths,
        revokePremium: d.revokePremium,
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "create_blog_post") {
      await adminCreateBlogPost({
        title_vi: d.title_vi,
        excerpt_vi: d.excerpt_vi,
        content_vi: d.content_vi,
        category: d.category,
        author_name: admin.full_name,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: "Không thể thực hiện thao tác quản trị." },
      { status: 500 }
    );
  }
}
