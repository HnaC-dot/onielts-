import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  recordAuditLog,
  requireStaff,
  verifySameOrigin,
} from "@/lib/admin-auth";
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
    role: z.enum(["learner", "editor", "admin"]).optional(),
    isLocked: z.boolean().optional(),
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

const ADMIN_ONLY_ACTIONS = new Set([
  "update_band_row",
  "update_plan",
  "update_promo_banner",
  "create_promo_code",
  "toggle_promo_code",
  "update_user_admin",
]);

export async function GET() {
  const guard = await requireStaff("editor");
  if (!guard.ok) {
    return guard.response;
  }
  const isAdmin = guard.user.role === "admin";
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
    isAdmin ? listAllProfiles() : Promise.resolve([]),
    getBandConversionTables(),
    getPricingPlans(true),
    getPromoBanner(),
    isAdmin ? getPromoCodes() : Promise.resolve([]),
    isAdmin ? listOrders() : Promise.resolve([]),
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
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Yêu cầu bị từ chối do sai nguồn gốc (CSRF check)." },
      { status: 403 }
    );
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
    const minRole = ADMIN_ONLY_ACTIONS.has(d.action) ? "admin" : "editor";
    const guard = await requireStaff(minRole);
    if (!guard.ok) {
      return guard.response;
    }
    const actor = guard.user;

    if (d.action === "update_band_row") {
      await adminUpdateBandRow(d.id, {
        min_raw: d.min_raw,
        max_raw: d.max_raw,
        band_score: d.band_score,
      });
      await recordAuditLog({
        actor,
        action: "update_band_row",
        entityType: "band_conversion",
        entityId: d.id,
        entityLabel: `Band ${d.band_score} (${d.min_raw}-${d.max_raw})`,
        summary: `Cập nhật quy đổi ${d.min_raw}-${d.max_raw} câu → Band ${d.band_score}`,
      });
      revalidatePath("/band-calculator");
      return NextResponse.json({ ok: true });
    }

    if (d.action === "update_plan") {
      await adminUpdatePricingPlan(d.id, {
        price_vnd: d.price_vnd,
        original_price_vnd: d.original_price_vnd,
        is_popular: d.is_popular,
        is_active: d.is_active,
      });
      await recordAuditLog({
        actor,
        action: "update_plan",
        entityType: "pricing_plan",
        entityId: d.id,
        entityLabel: `Plan ${d.id}`,
        summary: `Cập nhật giá ${d.price_vnd.toLocaleString("vi-VN")}đ (active=${d.is_active})`,
      });
      revalidatePath("/pricing");
      return NextResponse.json({ ok: true });
    }

    if (d.action === "update_promo_banner") {
      const parsedEnd = Date.parse(d.ends_at);
      if (!Number.isFinite(parsedEnd)) {
        return NextResponse.json(
          { error: "Thời gian kết thúc banner không hợp lệ." },
          { status: 400 }
        );
      }
      await adminUpdatePromoBanner({
        title_vi: d.title_vi,
        title_en: d.title_en,
        ends_at: new Date(parsedEnd).toISOString(),
        is_active: d.is_active,
      });
      await recordAuditLog({
        actor,
        action: "update_promo_banner",
        entityType: "promo_banner",
        entityLabel: d.title_vi.slice(0, 80),
        summary: `Cập nhật banner khuyến mãi (active=${d.is_active})`,
      });
      revalidatePath("/pricing");
      revalidatePath("/admin/pricing");
      return NextResponse.json({ ok: true });
    }

    if (d.action === "create_promo_code") {
      await adminCreatePromoCode({
        code: d.code,
        discount_percent: d.discount_percent,
        max_discount_vnd: d.max_discount_vnd ?? null,
      });
      await recordAuditLog({
        actor,
        action: "create_promo_code",
        entityType: "promo_code",
        entityLabel: d.code.toUpperCase(),
        summary: `Tạo mã giảm giá ${d.code.toUpperCase()} (-${d.discount_percent}%)`,
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "toggle_promo_code") {
      await adminTogglePromoCode(d.id, d.is_active);
      await recordAuditLog({
        actor,
        action: "toggle_promo_code",
        entityType: "promo_code",
        entityId: d.id,
        entityLabel: d.id,
        summary: `${d.is_active ? "Kích hoạt" : "Tắt"} mã giảm giá`,
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "toggle_test_publish") {
      if (d.is_published) {
        const allTests = await getIeltsTests(true);
        const target = allTests.find((t) => t.id === d.id);
        if (
          target &&
          (target.skill === "reading" || target.skill === "listening")
        ) {
          const actualQ = target.sections.reduce(
            (sum, s) => sum + s.questions.length,
            0
          );
          if (actualQ < 40) {
            return NextResponse.json(
              {
                error: `Cảnh báo: Đề ${target.skill === "reading" ? "Reading" : "Listening"} "${target.title_vi}" mới có ${actualQ}/40 câu. Vui lòng bổ sung đủ 40 câu trong Trình tạo đề (/admin/tests/${target.id}) trước khi xuất bản.`,
              },
              { status: 400 }
            );
          }
        }
      }
      await adminToggleTestPublish(d.id, d.is_published);
      await recordAuditLog({
        actor,
        action: "toggle_test_publish",
        entityType: "ielts_test",
        entityId: d.id,
        entityLabel: d.id,
        summary: `${d.is_published ? "Công khai" : "Chuyển nháp"} đề thi`,
      });
      revalidatePath("/tests");
      revalidatePath("/");
      revalidatePath("/sitemap.xml");
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
      const created = await adminCreateTest(parsedTest, actor.id);
      const isIncompleteObjective =
        (parsedTest.skill === "reading" || parsedTest.skill === "listening") &&
        created.questionCount < 40;
      await recordAuditLog({
        actor,
        action: "create_test_json",
        entityType: "ielts_test",
        entityLabel: parsedTest.title_vi,
        summary: `Tạo đề thi mới (${parsedTest.skill}, ${created.questionCount} câu, ${created.is_published ? "đã đăng" : "nháp"}) /tests/${parsedTest.slug}`,
      });
      revalidatePath("/tests");
      revalidatePath("/");
      revalidatePath("/sitemap.xml");
      return NextResponse.json({
        ok: true,
        is_published: created.is_published,
        warning: isIncompleteObjective
          ? `Cảnh báo: Đề ${parsedTest.skill === "reading" ? "Reading" : "Listening"} mới có ${created.questionCount}/40 câu nên đã được lưu ở trạng thái NHÁP (chưa xuất bản).`
          : undefined,
      });
    }

    if (d.action === "update_user_admin") {
      if (d.userId === actor.id && (d.isLocked || (d.role && d.role !== "admin"))) {
        return NextResponse.json(
          { error: "Không thể tự khóa hoặc tự hạ quyền Admin của chính mình." },
          { status: 400 }
        );
      }
      await adminUpdateUser({
        userId: d.userId,
        role: d.role,
        isLocked: d.isLocked,
        grantMonths: d.grantMonths,
        revokePremium: d.revokePremium,
      });
      await recordAuditLog({
        actor,
        action: "update_user_admin",
        entityType: "profile",
        entityId: d.userId,
        entityLabel: d.userId,
        summary: `Cập nhật user (role=${d.role ?? "-"}, locked=${d.isLocked ?? "-"}, grantMonths=${d.grantMonths ?? 0}, revoke=${Boolean(d.revokePremium)})`,
      });
      return NextResponse.json({ ok: true });
    }

    if (d.action === "create_blog_post") {
      await adminCreateBlogPost({
        title_vi: d.title_vi,
        excerpt_vi: d.excerpt_vi,
        content_vi: d.content_vi,
        category: d.category,
        author_name: actor.full_name,
      });
      await recordAuditLog({
        actor,
        action: "create_blog_post",
        entityType: "blog_post",
        entityLabel: d.title_vi,
        summary: `Xuất bản bài blog danh mục ${d.category}`,
      });
      revalidatePath("/blog");
      revalidatePath("/");
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
