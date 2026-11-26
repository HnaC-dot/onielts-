import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_FAQS,
  DEFAULT_REFERRAL_CONFIG,
  DEFAULT_SITE_GENERAL_SETTINGS,
  DEFAULT_STATIC_PAGES,
  adminUserPatchSchema,
  contactMessageUpdateSchema,
  faqUpsertSchema,
  featureRequestUpdateSchema,
  pricingPlanUpsertSchema,
  promoBannerUpdateSchema,
  promoCodeCreateSchema,
  referralConfigSchema,
  siteGeneralSettingsSchema,
  staticPageUpsertSchema,
} from "@/lib/system-cms-shared";
import { buildFaqPageJsonLd } from "@/lib/seo";

describe("GĐ5 System CMS Zod Validation Schemas", () => {
  it("validates user admin patch, pricing plan, promo banner, promo code, and referral config", () => {
    expect(
      adminUserPatchSchema.safeParse({
        role: "editor",
        is_locked: false,
        grant_months: 3,
      }).success
    ).toBe(true);

    expect(
      adminUserPatchSchema.safeParse({
        role: "superadmin",
      }).success
    ).toBe(false);

    expect(
      pricingPlanUpsertSchema.safeParse({
        slug: "premium-3m",
        name_vi: "Gói 3 Tháng",
        duration_months: 3,
        price_vnd: 299000,
        original_price_vnd: 450000,
        features_vi: ["Chấm AI không giới hạn"],
      }).success
    ).toBe(true);

    expect(
      promoBannerUpdateSchema.safeParse({
        title_vi: "Ưu đãi mùa thi IELTS giảm 30%",
        ends_at: "2027-01-01T16:59:59.000Z",
        is_active: true,
      }).success
    ).toBe(true);

    expect(
      promoCodeCreateSchema.safeParse({
        code: "IELTS2026",
        discount_percent: 25,
        max_discount_vnd: 200000,
      }).success
    ).toBe(true);

    expect(
      promoCodeCreateSchema.safeParse({
        code: "BAD CODE!",
        discount_percent: 25,
      }).success
    ).toBe(false);

    expect(
      referralConfigSchema.safeParse(DEFAULT_REFERRAL_CONFIG).success
    ).toBe(true);
  });

  it("validates inbox updates, static pages, FAQs, and site general settings", () => {
    expect(
      contactMessageUpdateSchema.safeParse({
        id: "msg-1",
        status: "replied",
        is_read: true,
        admin_note: "Đã phản hồi qua email.",
      }).success
    ).toBe(true);

    expect(
      featureRequestUpdateSchema.safeParse({
        id: "fr-1",
        status: "planned",
        admin_note: "Lên lịch quý tới.",
      }).success
    ).toBe(true);

    expect(
      staticPageUpsertSchema.safeParse({
        slug: "legal/privacy",
        title_vi: "Chính sách bảo mật",
        body_vi: "<p>Nội dung chính sách bảo mật.</p>",
      }).success
    ).toBe(true);

    expect(
      staticPageUpsertSchema.safeParse({
        slug: "../escape",
        title_vi: "Bad",
        body_vi: "<p>Bad</p>",
      }).success
    ).toBe(false);

    expect(
      faqUpsertSchema.safeParse({
        question_vi: "Thanh toán VietQR mất bao lâu để kích hoạt?",
        answer_vi: "Kích hoạt tự động tức thì trong vòng 5–15 giây sau khi chuyển khoản.",
        category: "pricing",
      }).success
    ).toBe(true);

    expect(
      siteGeneralSettingsSchema.safeParse(DEFAULT_SITE_GENERAL_SETTINGS).success
    ).toBe(true);
  });
});

describe("GĐ5 Defaults & FAQPage JSON-LD", () => {
  it("seeds all required public static pages including /about and all 5 /legal/* routes", () => {
    const slugs = DEFAULT_STATIC_PAGES.map((p) => p.slug);
    expect(slugs).toContain("about");
    expect(slugs).toContain("legal/privacy");
    expect(slugs).toContain("legal/terms");
    expect(slugs).toContain("legal/disclaimers");
    expect(slugs).toContain("legal/refund-policy");
    expect(slugs).toContain("legal/faqs");
  });

  it("builds valid Schema.org FAQPage JSON-LD", () => {
    const ld = buildFaqPageJsonLd(
      DEFAULT_FAQS.map((f) => ({ question: f.question_vi, answer: f.answer_vi }))
    );
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.length).toBe(DEFAULT_FAQS.length);
    expect(ld.mainEntity[0]["@type"]).toBe("Question");
    expect(ld.mainEntity[0].acceptedAnswer["@type"]).toBe("Answer");
  });
});

describe("GĐ5 RBAC, CSRF & Self-Lockout Security Checks", () => {
  it("enforces admin-only requireStaff('admin') + CSRF on users, pricing, and settings routes", () => {
    const adminOnlyRoutes = [
      "src/app/api/admin/users/route.ts",
      "src/app/api/admin/users/[id]/route.ts",
      "src/app/api/admin/pricing/route.ts",
      "src/app/api/admin/settings/route.ts",
    ];
    for (const rel of adminOnlyRoutes) {
      const content = fs.readFileSync(path.join(process.cwd(), rel), "utf-8");
      expect(content).toContain('requireStaff("admin")');
      if (!rel.endsWith("users/route.ts")) {
        expect(content).toContain("verifySameOrigin(req)");
      }
    }
  });

  it("enforces editor+ requireStaff('editor') + CSRF on inbox and pages routes", () => {
    for (const rel of [
      "src/app/api/admin/inbox/route.ts",
      "src/app/api/admin/pages/route.ts",
    ]) {
      const content = fs.readFileSync(path.join(process.cwd(), rel), "utf-8");
      expect(content).toContain('requireStaff("editor")');
      expect(content).toContain("verifySameOrigin(req)");
    }
  });

  it("prevents admin self-lockout and self-demotion in cms-system.ts", () => {
    const sys = fs.readFileSync(
      path.join(process.cwd(), "src/lib/cms-system.ts"),
      "utf-8"
    );
    expect(sys).toContain("if (userId === actor.id)");
    expect(sys).toContain("Không thể tự khóa tài khoản Admin đang đăng nhập.");
    expect(sys).toContain("Không thể tự hạ quyền Admin của chính mình.");
  });
});
