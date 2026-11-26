import { z } from "zod";
import { seoMetaSchema } from "./seo";
import type {
  FaqItem,
  ReferralConfigSettings,
  SiteGeneralSettings,
  StaticPageItem,
} from "./types";

// =============================================================================
// DEFAULTS (Preserves 100% of existing Ôn IELTS copy & URLs)
// =============================================================================
export const DEFAULT_SITE_GENERAL_SETTINGS: SiteGeneralSettings = {
  siteName: "Ôn IELTS",
  taglineVi:
    "Nền tảng tự học và luyện thi IELTS toàn diện tích hợp AI cho người học Việt Nam.",
  taglineEn:
    "All-in-one AI-powered IELTS self-study platform built for Vietnamese learners.",
  disclaimerVi:
    "Ôn IELTS là nền tảng ôn luyện độc lập, không liên kết hay đại diện cho British Council, IDP Education hay Cambridge Assessment English. Điểm AI là điểm tham khảo phục vụ tự học.",
  disclaimerEn:
    "Ôn IELTS is an independent preparation platform not affiliated with British Council, IDP Education, or Cambridge Assessment English. AI scores are reference estimates.",
  logoUrl: "",
  supportEmail: "hotro@onielts.vn",
  hotline: "",
  address: "TP. Hồ Chí Minh, Việt Nam",
  socialYoutube: "",
  socialFacebook: "",
  socialTiktok: "",
  socialZalo: "",
  announcementEnabled: false,
  announcementTextVi:
    "Mới: Thử sức Đề thi mỗi ngày 15 phút (UTC+7) & Kho đề chuẩn máy tính!",
  announcementTextEn:
    "New: Join today's 15-minute Daily IELTS Sprint & full mock tests!",
  announcementHref: "/daily-exam",
  footerCopyrightVi: "© {year} Ôn IELTS (onielts.vn). Bảo lưu mọi quyền.",
};

const GENERIC_SOCIAL_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.com",
  "www.fb.com",
  "tiktok.com",
  "www.tiktok.com",
  "zalo.me",
  "www.zalo.me",
]);

/**
 * Returns true only for valid http(s) social profile/channel URLs.
 * Rejects bare generic homepages such as `https://youtube.com` or `https://facebook.com/`.
 */
export function isValidSocialProfileUrl(rawUrl?: string | null): boolean {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const cleanPath = parsed.pathname.replace(/\/+$/, "");
    if (GENERIC_SOCIAL_HOSTS.has(host) && !cleanPath && !parsed.search) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isPromoBannerActiveNow(
  banner: { is_active: boolean; ends_at: string },
  nowMs = Date.now()
): boolean {
  if (!banner.is_active) return false;
  const endMs = Date.parse(banner.ends_at);
  if (!Number.isFinite(endMs)) return false;
  return endMs > nowMs;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfigSettings = {
  isEnabled: true,
  referrerBonusDays: 14,
  referredBonusDays: 7,
  headlineVi: "Mời bạn học cùng — Nhận thêm 14 ngày Premium miễn phí",
  headlineEn: "Invite a friend — Earn 14 free Premium days",
};

export const FAQ_CATEGORIES = [
  { value: "general", label: "Chung về Ôn IELTS" },
  { value: "pricing", label: "Gói Premium & Thanh toán" },
  { value: "tests", label: "Đề thi & Đề mỗi ngày" },
  { value: "ai", label: "Chấm Writing & Speaking AI" },
  { value: "account", label: "Tài khoản & Bảo mật" },
] as const;

export const DEFAULT_FAQS: FaqItem[] = [
  {
    id: "faq-1",
    question_vi: "Gói Miễn phí (Free) dùng được những gì?",
    question_en: "What is included in the Free plan?",
    answer_vi:
      "Tài khoản Free được làm toàn bộ kho đề thi IELTS Reading/Listening, tham gia Đề thi mỗi ngày, dùng công cụ Tính điểm Band, học Flashcard và nhận 2 lượt chấm AI miễn phí mỗi kỹ năng mỗi tháng cùng giới hạn lượt dùng hàng ngày cho 8 công cụ AI cơ bản.",
    answer_en:
      "Free accounts get full access to practice tests, Daily Exams, Band Calculators, Flashcards, 2 AI evaluations per skill per month, and daily free allowances on general AI tools.",
    category: "pricing",
    sort_order: 1,
    is_published: true,
  },
  {
    id: "faq-2",
    question_vi: "Thanh toán Premium có tự động gia hạn không?",
    question_en: "Do Premium plans auto-renew?",
    answer_vi:
      "KHÔNG. Mọi gói 1, 3, 6 và 12 tháng trên Ôn IELTS đều là thanh toán 1 lần qua mã VietQR (PayOS). Khi hết hạn, tài khoản tự chuyển về Free mà không tự động trừ tiền.",
    answer_en:
      "No. All 1, 3, 6, and 12-month plans are one-time VND payments via VietQR (PayOS) with zero automatic recurring charges.",
    category: "pricing",
    sort_order: 2,
    is_published: true,
  },
  {
    id: "faq-3",
    question_vi: "Điểm Phát âm & Chấm bài AI có chính xác tuyệt đối không?",
    question_en: "Are AI Writing, Speaking, and Pronunciation scores official?",
    answer_vi:
      "Điểm AI trên Ôn IELTS được gắn nhãn rõ là 'điểm tham khảo' dựa trên tiêu chí chấm IELTS chính thức. Kết hợp phân tích lỗi từng câu, bài viết lại Band 8+ và luyện IPA/Shadowing giúp bạn cải thiện nhanh trước kỳ thi thật.",
    answer_en:
      "AI scores are clearly labeled as reference estimates based on IELTS band descriptors to help you spot weaknesses and improve faster before exam day.",
    category: "ai",
    sort_order: 3,
    is_published: true,
  },
  {
    id: "faq-4",
    question_vi: "Đề thi mỗi ngày tính theo múi giờ nào?",
    question_en: "Which timezone do Daily Exams follow?",
    answer_vi:
      "Đề thi mỗi ngày làm mới lúc 00:00 theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7), mỗi tài khoản có 1 lượt thi chính thức mỗi ngày và được bấm giờ trên máy chủ.",
    answer_en:
      "Daily Exams reset at midnight Vietnam time (Asia/Ho_Chi_Minh, UTC+7) with one server-timed attempt per user per day.",
    category: "tests",
    sort_order: 4,
    is_published: true,
  },
  {
    id: "faq-5",
    question_vi: "Bài viết Writing và bản ghi âm Speaking của tôi có bị người khác thấy không?",
    question_en: "Are my Writing essays and Speaking recordings private?",
    answer_vi:
      "Mọi bài luận và bản ghi âm của bạn đều ở chế độ RIÊNG TƯ theo mặc định (is_public = false) và được bảo vệ bởi Row Level Security. Chỉ khi bạn chủ động bật chia sẻ thì người khác mới xem được.",
    answer_en:
      "All essays and recordings are private by default and isolated with PostgreSQL Row Level Security unless you explicitly opt in to share them.",
    category: "account",
    sort_order: 5,
    is_published: true,
  },
];

export const DEFAULT_STATIC_PAGES: StaticPageItem[] = [
  {
    id: "page-about",
    slug: "about",
    title_vi: "Giới thiệu về Ôn IELTS",
    title_en: "About Ôn IELTS",
    body_vi:
      "<p>Ôn IELTS ra đời với sứ mệnh giúp mọi học sinh, sinh viên và người đi làm Việt Nam tiếp cận lộ trình ôn thi IELTS bài bản, chi phí hợp lý và nhận phản hồi AI chi tiết ngay lập tức.</p><p>Toàn bộ đề thi, kịch bản nghe, bài tập viết và khóa học được biên soạn nguyên bản, phù hợp đặc thù lỗi sai của người học Việt Nam.</p>",
    body_en:
      "<p>Ôn IELTS was created to make high-quality, structured IELTS preparation accessible to every Vietnamese learner — combining 100% original exam-style practice with instant, practical AI coaching.</p>",
    sections_vi: [],
    sections_en: [],
    status: "published",
    seo_meta: {
      metaTitle: "Giới thiệu về Ôn IELTS — Nền tảng tự học IELTS thông minh cùng AI",
      metaDescription:
        "Tìm hiểu sứ mệnh, đội ngũ biên soạn nội dung gốc 100% và cam kết minh bạch, riêng tư của Ôn IELTS.",
    },
    updated_at: "2026-11-25T08:00:00.000Z",
  },
  {
    id: "page-legal-privacy",
    slug: "legal/privacy",
    title_vi: "Chính sách bảo mật",
    title_en: "Privacy Policy",
    body_vi:
      "<h2>1. Dữ liệu chúng tôi thu thập</h2><p>Ôn IELTS chỉ thu thập thông tin cần thiết để phục vụ quá trình học tập của bạn: địa chỉ email đăng nhập, tên hiển thị, kết quả làm đề, bài viết/bài nói bạn chủ động gửi chấm AI và các bộ Flashcard bạn lưu.</p><h2>2. Quyền riêng tư mặc định đối với bài viết &amp; ghi âm</h2><p>Mọi bài luận Writing và bản ghi âm Speaking do bạn nộp đều ở chế độ RIÊNG TƯ theo mặc định (is_public = false). Không ai khác có thể xem bài của bạn trừ khi bạn chủ động bật công tắc chia sẻ công khai.</p><h2>3. Bảo mật cơ sở dữ liệu (Row Level Security)</h2><p>Mọi bảng dữ liệu trên hệ thống đều áp dụng chính sách bảo mật cấp dòng (Row Level Security), bảo đảm tài khoản của bạn chỉ truy cập được dữ liệu thuộc quyền sở hữu của chính bạn.</p>",
    body_en:
      "<h2>1. Data We Collect</h2><p>Ôn IELTS collects only what is necessary to support your study journey: account email, display name, practice test attempts, essays/audio you submit for AI feedback, and saved flashcards.</p><h2>2. Private by Default</h2><p>All user Writing essays and Speaking recordings are PRIVATE by default. Other users cannot view your submissions unless you explicitly opt in to publish them.</p><h2>3. Row Level Security</h2><p>Every table in our PostgreSQL database enforces strict Row Level Security (RLS) policies to isolate personal data across accounts.</p>",
    status: "published",
    seo_meta: {
      metaTitle: "Chính sách bảo mật · Ôn IELTS",
      metaDescription:
        "Cam kết bảo mật dữ liệu học viên, quyền riêng tư mặc định cho bài Writing/Speaking và bảo vệ Row Level Security tại Ôn IELTS.",
    },
    updated_at: "2026-11-25T08:00:00.000Z",
  },
  {
    id: "page-legal-terms",
    slug: "legal/terms",
    title_vi: "Điều khoản sử dụng",
    title_en: "Terms of Service",
    body_vi:
      "<h2>1. Mục đích sử dụng</h2><p>Ôn IELTS cung cấp đề thi luyện tập gốc, khóa học và công cụ AI hỗ trợ tự học IELTS. Bạn đồng ý không lạm dụng API, không tự động thu thập dữ liệu hoặc chia sẻ tài khoản cho mục đích thương mại.</p><h2>2. Bản quyền nội dung gốc</h2><p>Toàn bộ bài đọc, kịch bản nghe, câu hỏi, bài mẫu và bài học trên Ôn IELTS đều được biên soạn nguyên bản. Người học được sử dụng cho mục đích ôn luyện cá nhân.</p><h2>3. Tài khoản Free và Premium</h2><p>Tài khoản Free được làm đầy đủ đề thi và nhận hạn mức chấm AI hàng tháng. Gói Premium mở khóa không giới hạn lượt chấm AI, trình tạo bài mẫu và hội thoại AI trong suốt thời hạn đã thanh toán một lần (không tự động trừ tiền gia hạn).</p>",
    body_en:
      "<h2>1. Acceptable Use</h2><p>Ôn IELTS provides original IELTS practice tests, courses, and AI study utilities for individual learners. Automated scraping, rate-limit abuse, or commercial redistribution is prohibited.</p><h2>2. Original Content Ownership</h2><p>All passages, listening scripts, questions, and sample essays on Ôn IELTS are 100% original educational content.</p><h2>3. One-Time Premium Access</h2><p>Premium plans are billed one-time in VND for 1, 3, 6, or 12 months with no surprise auto-renewals.</p>",
    status: "published",
    seo_meta: {
      metaTitle: "Điều khoản sử dụng · Ôn IELTS",
      metaDescription:
        "Điều khoản sử dụng tài khoản Free/Premium, bản quyền nội dung gốc và quy định sử dụng hợp lệ tại Ôn IELTS.",
    },
    updated_at: "2026-11-25T08:00:00.000Z",
  },
  {
    id: "page-legal-disclaimers",
    slug: "legal/disclaimers",
    title_vi: "Tuyên bố miễn trừ trách nhiệm",
    title_en: "Disclaimers",
    body_vi:
      "<h2>1. Không liên kết với các tổ chức IELTS chính thức</h2><p>Ôn IELTS (onielts.vn) là nền tảng giáo dục độc lập. Chúng tôi KHÔNG liên kết, không đại diện và không được chứng thực bởi British Council, IDP Education hay Cambridge Assessment English. IELTS® là nhãn hiệu đã đăng ký của các tổ chức sở hữu tương ứng.</p><h2>2. Điểm chấm AI mang tính tham khảo</h2><p>Điểm Band Writing, Speaking và đặc biệt là điểm Phát âm (Pronunciation) do AI ước lượng là 'điểm tham khảo' nhằm giúp bạn phát hiện điểm yếu và cải thiện nhanh hơn, không thay thế kết quả chấm chính thức của giám khảo trong kỳ thi thật.</p>",
    body_en:
      "<h2>1. Non-Affiliation Notice</h2><p>Ôn IELTS (onielts.vn) is an independent preparation platform and is NOT affiliated with, endorsed by, or sponsored by the British Council, IDP Education, or Cambridge Assessment English.</p><h2>2. AI Scores Are Estimates</h2><p>AI Writing, Speaking, and Pronunciation scores are reference estimates designed to guide self-study and do not guarantee an identical official exam score.</p>",
    status: "published",
    seo_meta: {
      metaTitle: "Tuyên bố miễn trừ trách nhiệm · Ôn IELTS",
      metaDescription:
        "Thông báo độc lập thương hiệu IELTS và phạm vi tham khảo của điểm chấm AI tại Ôn IELTS.",
    },
    updated_at: "2026-11-25T08:00:00.000Z",
  },
  {
    id: "page-legal-refund",
    slug: "legal/refund-policy",
    title_vi: "Chính sách hoàn tiền",
    title_en: "Refund Policy",
    body_vi:
      "<h2>1. Đảm bảo trải nghiệm trong 7 ngày</h2><p>Bạn có thể yêu cầu hoàn tiền 100% trong vòng 7 ngày kể từ khi thanh toán gói Premium nếu gặp sự cố kỹ thuật không thể khắc phục hoặc sử dụng dưới 5 lượt chấm AI chuyên sâu.</p><h2>2. Quy trình xử lý</h2><p>Gửi mã đơn hàng PayOS (VietQR) và email tài khoản qua trang Liên hệ. Chúng tôi xác minh và chuyển khoản hoàn lại trong vòng 3–5 ngày làm việc.</p>",
    body_en:
      "<h2>1. 7-Day Satisfaction Guarantee</h2><p>You may request a full refund within 7 days of purchasing a one-time Premium plan if you experienced unresolved technical issues or used fewer than 5 AI evaluations.</p><h2>2. How to Request</h2><p>Submit your PayOS order code and account email via our Contact page; approved refunds are processed within 3–5 business days.</p>",
    status: "published",
    seo_meta: {
      metaTitle: "Chính sách hoàn tiền 7 ngày · Ôn IELTS",
      metaDescription:
        "Chính sách hoàn tiền minh bạch trong 7 ngày đối với các gói Premium thanh toán 1 lần tại Ôn IELTS.",
    },
    updated_at: "2026-11-25T08:00:00.000Z",
  },
  {
    id: "page-legal-faqs",
    slug: "legal/faqs",
    title_vi: "Câu hỏi thường gặp (FAQs)",
    title_en: "Frequently Asked Questions",
    body_vi:
      "<p>Tổng hợp các câu hỏi phổ biến nhất về tài khoản miễn phí, gói Premium thanh toán một lần qua VietQR, Đề thi mỗi ngày và chấm bài AI.</p>",
    body_en:
      "<p>Answers to the most common questions about Free access, one-time Premium plans, Daily Exams, and AI feedback.</p>",
    status: "published",
    seo_meta: {
      metaTitle: "Câu hỏi thường gặp (FAQs) · Ôn IELTS",
      metaDescription:
        "Giải đáp mọi thắc mắc về gói học, thanh toán VietQR, Đề thi mỗi ngày UTC+7 và điểm chấm AI tại Ôn IELTS.",
    },
    updated_at: "2026-11-25T08:00:00.000Z",
  },
];

// =============================================================================
// ZOD SCHEMAS
// =============================================================================
export const adminUserPatchSchema = z.object({
  role: z.enum(["learner", "editor", "admin"]).optional(),
  is_locked: z.boolean().optional(),
  grant_months: z.number().int().min(0).max(36).optional(),
  revoke_premium: z.boolean().optional(),
});

export const pricingPlanUpsertSchema = z.object({
  id: z.string().optional(),
  slug: z.string().trim().min(2).max(80),
  name_vi: z.string().trim().min(2, "Tên gói quá ngắn").max(120),
  name_en: z.string().trim().max(120).optional().default(""),
  duration_months: z.number().int().min(1).max(36),
  price_vnd: z.number().int().min(1000, "Giá tối thiểu 1.000đ").max(100_000_000),
  original_price_vnd: z.number().int().min(1000).max(100_000_000),
  is_popular: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(999).default(0),
  features_vi: z.array(z.string().trim().min(1).max(200)).max(15).default([]),
  features_en: z.array(z.string().trim().min(1).max(200)).max(15).default([]),
});

export const promoBannerUpdateSchema = z.object({
  title_vi: z.string().trim().min(5, "Tiêu đề banner quá ngắn").max(300),
  title_en: z.string().trim().max(300).optional().default(""),
  badge_vi: z.string().trim().max(80).optional().default("Ưu đãi"),
  badge_en: z.string().trim().max(80).optional().default("Offer"),
  cta_vi: z.string().trim().max(80).optional().default("Xem ưu đãi"),
  cta_en: z.string().trim().max(80).optional().default("Claim Offer"),
  ends_at: z
    .string()
    .trim()
    .min(10, "Chọn thời gian kết thúc")
    .refine(
      (v) => Number.isFinite(Date.parse(v)),
      "Thời gian kết thúc không hợp lệ (hãy chọn đúng ngày giờ)"
    ),
  is_active: z.boolean(),
});

export const promoCodeCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, "Mã giảm giá tối thiểu 3 ký tự")
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, "Mã giảm giá chỉ gồm chữ, số, gạch ngang hoặc gạch dưới"),
  discount_percent: z.number().int().min(1).max(90),
  max_discount_vnd: z.number().int().min(1000).max(50_000_000).nullable().optional(),
  max_uses: z.number().int().min(1).max(100_000).nullable().optional(),
  expires_at: z.string().trim().nullable().optional(),
});

export const referralConfigSchema = z.object({
  isEnabled: z.boolean(),
  referrerBonusDays: z.number().int().min(0).max(365),
  referredBonusDays: z.number().int().min(0).max(365),
  headlineVi: z.string().trim().min(5).max(200),
  headlineEn: z.string().trim().max(200).optional().default(""),
});

export const contactMessageUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["new", "replied"]).optional(),
  is_read: z.boolean().optional(),
  admin_note: z.string().max(2000).optional(),
});

export const featureRequestUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["open", "planned", "shipped"]).optional(),
  admin_note: z.string().max(2000).optional(),
});

export const staticPageUpsertSchema = z.object({
  id: z.string().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9/-]+$/, "Slug chỉ gồm chữ thường, số, dấu / và -"),
  title_vi: z.string().trim().min(2, "Tiêu đề quá ngắn").max(200),
  title_en: z.string().trim().max(200).optional().default(""),
  body_vi: z.string().min(5, "Nội dung quá ngắn").max(80_000),
  body_en: z.string().max(80_000).optional().default(""),
  status: z.enum(["draft", "published", "scheduled"]).default("published"),
  seo_meta: seoMetaSchema,
});

export const faqUpsertSchema = z.object({
  id: z.string().optional(),
  question_vi: z.string().trim().min(5, "Câu hỏi quá ngắn").max(300),
  question_en: z.string().trim().max(300).optional().default(""),
  answer_vi: z.string().trim().min(5, "Câu trả lời quá ngắn").max(4000),
  answer_en: z.string().trim().max(4000).optional().default(""),
  category: z.string().trim().min(2).max(60).default("general"),
  sort_order: z.number().int().min(0).max(9999).default(0),
  is_published: z.boolean().default(true),
});

export const siteGeneralSettingsSchema = z.object({
  siteName: z.string().trim().min(2, "Tên website quá ngắn").max(80),
  taglineVi: z.string().trim().max(300).default(""),
  taglineEn: z.string().trim().max(300).default(""),
  disclaimerVi: z.string().trim().max(600).default(""),
  disclaimerEn: z.string().trim().max(600).default(""),
  logoUrl: z.string().trim().max(1000).default(""),
  supportEmail: z.string().trim().max(160).default(""),
  hotline: z.string().trim().max(40).default(""),
  address: z.string().trim().max(240).default(""),
  socialYoutube: z.string().trim().max(300).default(""),
  socialFacebook: z.string().trim().max(300).default(""),
  socialTiktok: z.string().trim().max(300).default(""),
  socialZalo: z.string().trim().max(300).default(""),
  announcementEnabled: z.boolean().default(false),
  announcementTextVi: z.string().trim().max(260).default(""),
  announcementTextEn: z.string().trim().max(260).default(""),
  announcementHref: z.string().trim().max(300).default("/daily-exam"),
  footerCopyrightVi: z.string().trim().max(240).default(""),
});
