import { z } from "zod";
import { GA4_ID_REGEX, GSC_TOKEN_REGEX } from "./seo-cms-shared";
import { DEFAULT_SITE_GENERAL_SETTINGS } from "./system-cms-shared";

// =============================================================================
// ALLOWLISTS & CONSTANTS
// =============================================================================
export const APPEARANCE_FONTS = [
  {
    id: "Be Vietnam Pro",
    label: "Be Vietnam Pro (Mặc định · Tối ưu tiếng Việt)",
    googleQuery: "",
    cssFamily: "var(--font-be-vietnam-pro), ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "Inter",
    label: "Inter (Hiện đại · Gọn mắt)",
    googleQuery: "Inter:wght@400;500;600;700",
    cssFamily: "'Inter', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Plus Jakarta Sans",
    label: "Plus Jakarta Sans (Trẻ trung · EdTech)",
    googleQuery: "Plus+Jakarta+Sans:wght@400;500;600;700",
    cssFamily:
      "'Plus Jakarta Sans', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Lexend",
    label: "Lexend (Dễ đọc dài · Luyện Reading)",
    googleQuery: "Lexend:wght@400;500;600;700",
    cssFamily: "'Lexend', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Nunito",
    label: "Nunito (Thân thiện · Bo tròn)",
    googleQuery: "Nunito:wght@400;500;600;700",
    cssFamily: "'Nunito', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Manrope",
    label: "Manrope (Sắc nét · Chuyên nghiệp)",
    googleQuery: "Manrope:wght@400;500;600;700",
    cssFamily: "'Manrope', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Roboto",
    label: "Roboto (Phổ thông · Rõ ràng)",
    googleQuery: "Roboto:wght@400;500;700",
    cssFamily: "'Roboto', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Merriweather",
    label: "Merriweather (Serif học thuật)",
    googleQuery: "Merriweather:wght@400;700",
    cssFamily: "'Merriweather', Georgia, serif",
  },
] as const;

export type AppearanceFontId = (typeof APPEARANCE_FONTS)[number]["id"];

export const BORDER_RADIUS_OPTIONS = [
  { id: "none", label: "Vuông (0px)", cssValue: "0px" },
  { id: "sm", label: "Nhẹ (6px)", cssValue: "6px" },
  { id: "md", label: "Vừa (12px)", cssValue: "12px" },
  { id: "lg", label: "Mặc định (16px)", cssValue: "16px" },
  { id: "xl", label: "Bo mạnh (24px)", cssValue: "24px" },
] as const;

export type BorderRadiusPreset = (typeof BORDER_RADIUS_OPTIONS)[number]["id"];

export const AVAILABLE_MENU_ICONS = [
  "LayoutDashboard",
  "Activity",
  "SlidersHorizontal",
  "BookOpen",
  "CalendarDays",
  "Calculator",
  "Image",
  "FileText",
  "GraduationCap",
  "MessageSquare",
  "PenTool",
  "Volume2",
  "Headphones",
  "Video",
  "Users",
  "CreditCard",
  "Inbox",
  "FileCode2",
  "Settings",
  "Globe",
  "Palette",
  "Layers",
  "Wrench",
  "Sparkles",
  "Flame",
  "Trophy",
  "Mic",
  "Star",
  "Shield",
  "Home",
  "Compass",
  "Gift",
  "Mail",
  "Bell",
  "HelpCircle",
  "Link2",
] as const;

export type MenuIconName = (typeof AVAILABLE_MENU_ICONS)[number];

export type HomeSectionId =
  | "hero"
  | "testimonials"
  | "latestTests"
  | "dailyExam"
  | "tools"
  | "courses"
  | "conversations"
  | "writingExercises"
  | "pronunciation"
  | "dictation"
  | "videos"
  | "featuredBlog";

// =============================================================================
// DATA INTERFACES
// =============================================================================
export interface HomeSectionConfig {
  id: HomeSectionId;
  enabled: boolean;
  titleVi: string;
  titleEn: string;
  subtitleVi: string;
  subtitleEn: string;
  badgeVi?: string;
  badgeEn?: string;
  ctaPrimaryVi?: string;
  ctaPrimaryEn?: string;
  ctaPrimaryHref?: string;
  ctaSecondaryVi?: string;
  ctaSecondaryEn?: string;
  ctaSecondaryHref?: string;
  viewAllLabelVi?: string;
  viewAllLabelEn?: string;
  limit: number;
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  backgroundLight: string;
  backgroundDark: string;
  fontFamily: AppearanceFontId;
  borderRadius: BorderRadiusPreset;
  defaultColorMode: "light" | "dark" | "system";
}

export interface BrandingConfig {
  siteName: string;
  taglineVi: string;
  taglineEn: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
}

export interface MenuSubItem {
  id: string;
  labelVi: string;
  labelEn: string;
  descVi?: string;
  descEn?: string;
  href: string;
  icon?: string;
  visible: boolean;
  isSystem?: boolean;
}

export interface AdminMenuItem {
  id: string;
  labelVi: string;
  labelEn: string;
  href: string;
  icon: string;
  visible: boolean;
  adminOnly?: boolean;
  isSystem?: boolean;
  children?: MenuSubItem[];
}

export interface AdminMenuGroup {
  id: string;
  labelVi: string;
  labelEn: string;
  visible: boolean;
  isSystem?: boolean;
  items: AdminMenuItem[];
}

export interface PublicHeaderMenuItem {
  id: string;
  labelVi: string;
  labelEn: string;
  href: string;
  icon: string;
  visible: boolean;
  isSystem?: boolean;
  children?: MenuSubItem[];
}

export interface FooterLinkItem {
  id: string;
  labelVi: string;
  labelEn: string;
  href: string;
  visible: boolean;
  isSystem?: boolean;
}

export interface FooterColumnConfig {
  id: string;
  labelVi: string;
  labelEn: string;
  visible: boolean;
  isSystem?: boolean;
  links: FooterLinkItem[];
}

export interface FooterConfig {
  descriptionVi: string;
  descriptionEn: string;
  email: string;
  phone: string;
  address: string;
  socialYoutube: string;
  socialFacebook: string;
  socialTiktok: string;
  socialZalo: string;
  copyrightVi: string;
  copyrightEn: string;
  disclaimerVi: string;
  disclaimerEn: string;
}

export interface TopBannerConfig {
  enabled: boolean;
  textVi: string;
  textEn: string;
  ctaLabelVi: string;
  ctaLabelEn: string;
  href: string;
  startsAt: string;
  endsAt: string;
  bgColor: string;
}

export interface PopupNoticeConfig {
  enabled: boolean;
  titleVi: string;
  titleEn: string;
  bodyVi: string;
  bodyEn: string;
  imageUrl: string;
  ctaLabelVi: string;
  ctaLabelEn: string;
  ctaHref: string;
  startsAt: string;
  endsAt: string;
  frequency: "once_per_session" | "once_per_day";
}

export interface FloatingChatConfig {
  enabled: boolean;
  messengerUrl: string;
  zaloUrl: string;
  tooltipVi: string;
  tooltipEn: string;
}

export interface CookieBannerConfig {
  enabled: boolean;
  textVi: string;
  textEn: string;
  acceptLabelVi: string;
  acceptLabelEn: string;
  policyHref: string;
}

export interface NotFoundPageConfig {
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  buttonLabelVi: string;
  buttonLabelEn: string;
  quickLinks: Array<{ labelVi: string; labelEn: string; href: string }>;
}

export interface MaintenanceConfig {
  enabled: boolean;
  titleVi: string;
  titleEn: string;
  messageVi: string;
  messageEn: string;
  expectedReturnText: string;
}

export interface AnalyticsEmbedConfig {
  googleAnalyticsId: string;
  googleSiteVerification: string;
}

export interface UiTextOverride {
  vi: string;
  en: string;
}

export interface SiteAppearanceConfig {
  homepage: {
    sections: HomeSectionConfig[];
  };
  theme: ThemeConfig;
  branding: BrandingConfig;
  menus: {
    adminSidebar: AdminMenuGroup[];
    publicHeader: PublicHeaderMenuItem[];
    publicFooter: FooterColumnConfig[];
  };
  footer: FooterConfig;
  widgets: {
    topBanner: TopBannerConfig;
    popup: PopupNoticeConfig;
    floatingChat: FloatingChatConfig;
    cookieBanner: CookieBannerConfig;
    notFoundPage: NotFoundPageConfig;
    maintenance: MaintenanceConfig;
  };
  analytics: AnalyticsEmbedConfig;
  uiTexts: Record<string, UiTextOverride>;
}

export interface AppearanceVersionEntry {
  versionId: string;
  savedAt: string;
  actorEmail: string;
  action: "draft" | "publish" | "restore" | "reset";
  note: string;
  config: SiteAppearanceConfig;
}

// =============================================================================
// CURATED UI TEXT KEYS CATALOG (for the VI/EN Text Management Table)
// =============================================================================
export const DEFAULT_UI_TEXT_KEYS: ReadonlyArray<{
  key: string;
  group: string;
  defaultVi: string;
  defaultEn: string;
}> = [
  { key: "brand.name", group: "Thương hiệu", defaultVi: "Ôn IELTS", defaultEn: "Ôn IELTS" },
  { key: "brand.tagline", group: "Thương hiệu", defaultVi: "Ôn luyện IELTS thông minh cùng AI", defaultEn: "Smarter IELTS prep with AI" },
  { key: "nav.searchPlaceholder", group: "Thanh điều hướng", defaultVi: "Tìm đề thi, công cụ, âm IPA, khóa học...", defaultEn: "Search tests, AI tools, IPA sounds, courses..." },
  { key: "nav.login", group: "Thanh điều hướng", defaultVi: "Đăng nhập", defaultEn: "Sign in" },
  { key: "nav.tryPremium", group: "Thanh điều hướng", defaultVi: "Dùng thử Premium", defaultEn: "Try Premium" },
  { key: "nav.profile", group: "Thanh điều hướng", defaultVi: "Hồ sơ", defaultEn: "Profile" },
  { key: "nav.progress", group: "Thanh điều hướng", defaultVi: "Tiến độ", defaultEn: "Progress" },
  { key: "nav.referral", group: "Thanh điều hướng", defaultVi: "Mời bạn bè", defaultEn: "Refer Friends" },
  { key: "nav.admin", group: "Thanh điều hướng", defaultVi: "Quản trị", defaultEn: "Admin" },
  { key: "nav.logout", group: "Thanh điều hướng", defaultVi: "Đăng xuất", defaultEn: "Sign out" },
  { key: "home.heroTitle", group: "Trang chủ", defaultVi: "Ôn luyện IELTS thông minh cùng AI", defaultEn: "Smarter IELTS prep with AI" },
  { key: "home.heroSubtitle", group: "Trang chủ", defaultVi: "Làm đề thi thử chuẩn máy tính, chấm điểm Writing & Speaking tức thì bằng AI, luyện phát âm IPA, chép chính tả và học Flashcard thông minh — tất cả trong một nền tảng dành riêng cho người Việt.", defaultEn: "Take computer-delivered mock tests, get instant AI feedback on Writing & Speaking, master IPA pronunciation, practice dictation, and retain vocabulary with spaced-repetition flashcards." },
  { key: "home.ctaPrimary", group: "Trang chủ", defaultVi: "Dùng thử Premium", defaultEn: "Try Premium" },
  { key: "home.ctaSecondary", group: "Trang chủ", defaultVi: "Làm đề miễn phí ngay", defaultEn: "Start a Free Test" },
  { key: "home.stats.tests", group: "Trang chủ", defaultVi: "Bộ đề thi nguyên bản (4 kỹ năng)", defaultEn: "Original practice tests (4 skills)" },
  { key: "home.stats.questions", group: "Trang chủ", defaultVi: "Câu hỏi Reading & Listening tự chấm", defaultEn: "Auto-graded Reading & Listening questions" },
  { key: "home.stats.tools", group: "Trang chủ", defaultVi: "Công cụ AI & tiện ích học tập", defaultEn: "AI tools & study utilities" },
  { key: "home.stats.fullFormat", group: "Trang chủ", defaultVi: "Chuẩn đề Reading & Listening có MP3 thật", defaultEn: "Full IELTS test format with real MP3 audio" },
  { key: "home.viewAll", group: "Trang chủ", defaultVi: "Xem tất cả", defaultEn: "View all" },
  { key: "home.startTest", group: "Trang chủ", defaultVi: "Làm đề ngay", defaultEn: "Start test" },
  { key: "home.dailyCtaButton", group: "Trang chủ", defaultVi: "Tham gia đề hôm nay", defaultEn: "Take Today's Exam" },
  { key: "home.leaderboardButton", group: "Trang chủ", defaultVi: "Xem bảng xếp hạng", defaultEn: "View Leaderboards" },
  { key: "auth.title", group: "Đăng nhập", defaultVi: "Đăng nhập Ôn IELTS", defaultEn: "Sign in to Ôn IELTS" },
  { key: "auth.subtitle", group: "Đăng nhập", defaultVi: "Lưu tiến độ học, đồng bộ Flashcard và sử dụng AI chấm bài miễn phí mỗi tháng", defaultEn: "Save test history, sync flashcards, and get free monthly AI evaluations" },
  { key: "auth.googleButton", group: "Đăng nhập", defaultVi: "Tiếp tục với Google", defaultEn: "Continue with Google" },
  { key: "common.free", group: "Chung", defaultVi: "Miễn phí", defaultEn: "Free" },
  { key: "common.premium", group: "Chung", defaultVi: "Premium", defaultEn: "Premium" },
  { key: "common.referenceScore", group: "Chung", defaultVi: "điểm tham khảo", defaultEn: "reference score" },
  { key: "common.backHome", group: "Chung", defaultVi: "Về trang chủ", defaultEn: "Back to Home" },
];

// =============================================================================
// DEFAULTS (100% PRESERVES EXISTING ÔN IELTS DESIGN & ROUTES)
// =============================================================================
export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  {
    id: "hero",
    enabled: true,
    titleVi: "Ôn luyện IELTS thông minh cùng AI",
    titleEn: "Smarter IELTS prep with AI",
    subtitleVi:
      "Làm đề thi thử chuẩn máy tính, chấm điểm Writing & Speaking tức thì bằng AI, luyện phát âm IPA, chép chính tả và học Flashcard thông minh — tất cả trong một nền tảng dành riêng cho người Việt.",
    subtitleEn:
      "Take computer-delivered mock tests, get instant AI feedback on Writing & Speaking, master IPA pronunciation, practice dictation, and retain vocabulary with spaced-repetition flashcards.",
    ctaPrimaryVi: "Dùng thử Premium",
    ctaPrimaryEn: "Try Premium",
    ctaPrimaryHref: "/pricing",
    ctaSecondaryVi: "Làm đề miễn phí ngay",
    ctaSecondaryEn: "Start a Free Test",
    ctaSecondaryHref: "/tests",
    limit: 4,
  },
  {
    id: "testimonials",
    enabled: true,
    titleVi: "Ví dụ minh họa lộ trình tự học",
    titleEn: "Illustrative Study Journeys (Examples)",
    subtitleVi:
      "Các tình huống ví dụ minh họa cách sử dụng tính năng của Ôn IELTS (dữ liệu mẫu, không phải đánh giá khách hàng thật)",
    subtitleEn:
      "Sample usage scenarios showing how learners combine Ôn IELTS tools (illustrative examples, not verified customer reviews)",
    badgeVi: "Dữ liệu ví dụ minh họa",
    badgeEn: "Illustrative Examples",
    limit: 6,
  },
  {
    id: "latestTests",
    enabled: true,
    titleVi: "Đề thi IELTS mới nhất",
    titleEn: "Latest IELTS Practice Tests",
    subtitleVi:
      "Giao diện thi trên máy tính chân thực, tự động chấm điểm và phân tích lỗi sai theo từng dạng câu hỏi",
    subtitleEn:
      "Authentic computer-delivered interface with instant grading and question-type analytics",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 4,
  },
  {
    id: "dailyExam",
    enabled: true,
    titleVi: "Thử thách Đề thi mỗi ngày & Bảng xếp hạng",
    titleEn: "Daily Exams & Streak Leaderboards",
    subtitleVi:
      "Mỗi ngày 1 đề ngắn tính giờ chuẩn theo múi giờ Việt Nam (UTC+7). Giữ vững chuỗi ngày học (streak) để vươn lên bảng xếp hạng Tuần, Tháng và Năm!",
    subtitleEn:
      "One server-timed exam every day in Vietnam time (UTC+7). Climb Daily, Weekly, Monthly, and Yearly streak boards!",
    ctaPrimaryVi: "Tham gia đề hôm nay",
    ctaPrimaryEn: "Take Today's Exam",
    ctaPrimaryHref: "/daily-exam",
    ctaSecondaryVi: "Xem bảng xếp hạng",
    ctaSecondaryEn: "View Leaderboards",
    ctaSecondaryHref: "/leaderboard",
    limit: 3,
  },
  {
    id: "tools",
    enabled: true,
    titleVi: "Bộ công cụ AI & Tiện ích học tập",
    titleEn: "AI Learning Tools & Band Calculators",
    subtitleVi:
      "Hỗ trợ nâng cấp từ vựng, sửa ngữ pháp, giải thích câu phức và tính điểm Band nhanh chóng",
    subtitleEn:
      "Paraphrase, check grammar, explain complex sentences, translate EN⇄VI, and compute accurate band scores",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 10,
  },
  {
    id: "courses",
    enabled: true,
    titleVi: "Khóa học IELTS bài bản",
    titleEn: "Structured IELTS Courses",
    subtitleVi: "Lộ trình từ nền tảng đến mục tiêu 7.5+ kèm tiến độ và bài kiểm tra",
    subtitleEn: "Step-by-step pathways from foundation to Band 7.5+ with tracked progress",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 6,
  },
  {
    id: "conversations",
    enabled: true,
    titleVi: "Hội thoại AI theo chủ đề",
    titleEn: "AI Role-play Conversations",
    subtitleVi:
      "Luyện phản xạ nói tiếng Anh tự nhiên với giọng đọc AI và gợi ý câu trả lời tức thì",
    subtitleEn:
      "Practice natural speaking across everyday IELTS topics with voice input/output and smart reply tips",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 8,
  },
  {
    id: "writingExercises",
    enabled: true,
    titleVi: "Bài tập nâng cấp câu viết",
    titleEn: "Writing Improvement Exercises",
    subtitleVi:
      "Luyện viết lại từng câu từ Band 5.5 lên Band 8.0+ với hướng dẫn trực quan",
    subtitleEn: "Guided sentence-by-sentence rewriting from Band 5.5 to Band 8.0+",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 6,
  },
  {
    id: "pronunciation",
    enabled: true,
    titleVi: "Luyện phát âm chuẩn bảng IPA",
    titleEn: "Interactive IPA Pronunciation",
    subtitleVi:
      "Chọn từng âm IPA để xem khẩu hình, mẹo sửa lỗi thường gặp của người Việt và chấm phát âm tham khảo",
    subtitleEn:
      "Tap any IPA sound to explore mouth tips for Vietnamese speakers and practice with AI reference scoring",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 12,
  },
  {
    id: "dictation",
    enabled: true,
    titleVi: "Chép chính tả & Shadowing",
    titleEn: "Dictation & Shadowing",
    subtitleVi:
      "Nghe chép từng câu có kiểm tra sai khác từng từ và chế độ nói đuổi (Shadowing)",
    subtitleEn:
      "Sentence-by-sentence listening with word-level diff checks and adjustable shadowing speed",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 6,
  },
  {
    id: "videos",
    enabled: true,
    titleVi: "Video học IELTS kèm phụ đề tương tác",
    titleEn: "Learn IELTS with Interactive Videos",
    subtitleVi:
      "Nhấn vào từng dòng phụ đề để tua video, nhấn vào từ bất kỳ để lưu ngay vào Flashcard",
    subtitleEn:
      "Click any transcript line to seek the video, or click any word to save a flashcard",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 6,
  },
  {
    id: "featuredBlog",
    enabled: true,
    titleVi: "Blog & Mẹo thi IELTS nổi bật",
    titleEn: "Featured IELTS Blog & Study Tips",
    subtitleVi:
      "Chiến thuật phòng thi, lộ trình tự học và kinh nghiệm tăng Band được chọn lọc.",
    subtitleEn:
      "Practical strategies, band-boosting tips, and study roadmaps curated by Ôn IELTS.",
    viewAllLabelVi: "Xem tất cả",
    viewAllLabelEn: "View all",
    limit: 6,
  },
];

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  primaryColor: "#059669",
  secondaryColor: "#0284c7",
  backgroundLight: "#f8fafc",
  backgroundDark: "#0b1120",
  fontFamily: "Be Vietnam Pro",
  borderRadius: "lg",
  defaultColorMode: "light",
};

export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  siteName: DEFAULT_SITE_GENERAL_SETTINGS.siteName,
  taglineVi: DEFAULT_SITE_GENERAL_SETTINGS.taglineVi,
  taglineEn: DEFAULT_SITE_GENERAL_SETTINGS.taglineEn,
  logoLightUrl: "",
  logoDarkUrl: "",
  faviconUrl: "",
};

export const DEFAULT_ADMIN_SIDEBAR_MENU: AdminMenuGroup[] = [
  {
    id: "grp-overview",
    labelVi: "Tổng quan",
    labelEn: "Overview",
    visible: true,
    isSystem: true,
    items: [
      { id: "adm-dashboard", labelVi: "Dashboard", labelEn: "Dashboard", href: "/admin", icon: "LayoutDashboard", visible: true, isSystem: true },
      { id: "adm-analytics", labelVi: "Thống kê học tập", labelEn: "Learning Analytics", href: "/admin/analytics", icon: "Sparkles", visible: true, isSystem: true },
      { id: "adm-audit", labelVi: "Nhật ký hoạt động", labelEn: "Audit Logs", href: "/admin/audit", icon: "Activity", visible: true, isSystem: true },
      { id: "adm-legacy", labelVi: "Quản trị nhanh (6 Tab)", labelEn: "Quick Admin (6 Tabs)", href: "/admin/legacy", icon: "SlidersHorizontal", visible: true, isSystem: true },
    ],
  },
  {
    id: "grp-content",
    labelVi: "Đề thi & Nội dung",
    labelEn: "Tests & Content",
    visible: true,
    isSystem: true,
    items: [
      { id: "adm-tests", labelVi: "Đề thi IELTS", labelEn: "IELTS Tests", href: "/admin/tests", icon: "BookOpen", visible: true, isSystem: true },
      { id: "adm-daily", labelVi: "Đề thi mỗi ngày", labelEn: "Daily Exam", href: "/admin/daily-exam", icon: "CalendarDays", visible: true, isSystem: true },
      { id: "adm-band", labelVi: "Bảng quy đổi Band", labelEn: "Band Tables", href: "/admin/band-tables", icon: "Calculator", visible: true, adminOnly: true, isSystem: true },
      { id: "adm-media", labelVi: "Thư viện Media", labelEn: "Media Library", href: "/admin/media", icon: "Image", visible: true, isSystem: true },
      { id: "adm-blog", labelVi: "Blog & Mẹo thi", labelEn: "Blog & Tips", href: "/admin/blog", icon: "FileText", visible: true, isSystem: true },
    ],
  },
  {
    id: "grp-learning",
    labelVi: "Học tập & Luyện tập",
    labelEn: "Learning Hub",
    visible: true,
    isSystem: true,
    items: [
      { id: "adm-courses", labelVi: "Khóa học & Bài học", labelEn: "Courses & Lessons", href: "/admin/courses", icon: "GraduationCap", visible: true, isSystem: true },
      { id: "adm-conv", labelVi: "Hội thoại AI", labelEn: "AI Conversations", href: "/admin/conversations", icon: "MessageSquare", visible: true, isSystem: true },
      { id: "adm-writing-ex", labelVi: "Nâng cấp câu viết", labelEn: "Writing Exercises", href: "/admin/writing-exercises", icon: "PenTool", visible: true, isSystem: true },
      { id: "adm-ipa", labelVi: "Phát âm IPA", labelEn: "IPA Pronunciation", href: "/admin/pronunciation", icon: "Volume2", visible: true, isSystem: true },
      { id: "adm-dictation", labelVi: "Chép chính tả", labelEn: "Dictation", href: "/admin/dictation", icon: "Headphones", visible: true, isSystem: true },
      { id: "adm-videos", labelVi: "Video tương tác", labelEn: "Interactive Videos", href: "/admin/videos", icon: "Video", visible: true, isSystem: true },
    ],
  },
  {
    id: "grp-system",
    labelVi: "Hệ thống & Giao diện",
    labelEn: "System & Appearance",
    visible: true,
    isSystem: true,
    items: [
      { id: "adm-appearance", labelVi: "Giao diện & Trang chủ", labelEn: "Appearance & Home", href: "/admin/appearance", icon: "Palette", visible: true, adminOnly: true, isSystem: true },
      { id: "adm-users", labelVi: "Người dùng & Premium", labelEn: "Users & Premium", href: "/admin/users", icon: "Users", visible: true, adminOnly: true, isSystem: true },
      { id: "adm-pricing", labelVi: "Gói giá & Referral", labelEn: "Pricing & Referral", href: "/admin/pricing", icon: "CreditCard", visible: true, adminOnly: true, isSystem: true },
      { id: "adm-inbox", labelVi: "Hộp thư & Phản hồi", labelEn: "Inbox & Feedback", href: "/admin/inbox", icon: "Inbox", visible: true, isSystem: true },
      { id: "adm-pages", labelVi: "Trang tĩnh & FAQs", labelEn: "Static Pages & FAQs", href: "/admin/pages", icon: "FileCode2", visible: true, isSystem: true },
      { id: "adm-settings", labelVi: "Cài đặt chung", labelEn: "General Settings", href: "/admin/settings", icon: "Settings", visible: true, adminOnly: true, isSystem: true },
      { id: "adm-seo", labelVi: "SEO & Redirect 301", labelEn: "SEO & Redirects", href: "/admin/seo", icon: "Globe", visible: true, adminOnly: true, isSystem: true },
    ],
  },
];

export const DEFAULT_PUBLIC_HEADER_MENU: PublicHeaderMenuItem[] = [
  {
    id: "hdr-ielts",
    labelVi: "IELTS",
    labelEn: "IELTS",
    href: "/tests",
    icon: "BookOpen",
    visible: true,
    isSystem: true,
    children: [
      { id: "hdr-ielts-r", labelVi: "Đề thi Reading", labelEn: "Reading Practice Tests", descVi: "Đề luyện tập chuẩn máy tính kèm giải thích song ngữ", descEn: "Computer-delivered split-pane UI with bilingual explanations", href: "/tests?skill=reading", icon: "BookOpen", visible: true, isSystem: true },
      { id: "hdr-ielts-l", labelVi: "Đề thi Listening", labelEn: "Listening Practice Tests", descVi: "Luyện nghe 4 phần có bản ghi & phân tích lỗi", descEn: "4-section audio tests with transcript & mistake analytics", href: "/tests?skill=listening", icon: "Headphones", visible: true, isSystem: true },
      { id: "hdr-ielts-w", labelVi: "Đề thi & Chấm AI Writing", labelEn: "Writing Tests & AI Checker", descVi: "Chấm Task 1, Task 2 chi tiết 4 tiêu chí", descEn: "Detailed 4-criterion grading for Task 1 & Task 2", href: "/writing", icon: "PenTool", visible: true, isSystem: true },
      { id: "hdr-ielts-s", labelVi: "Đề thi & Chấm AI Speaking", labelEn: "Speaking Tests & AI Checker", descVi: "Ghi âm trực tiếp Parts 1–3, nhận điểm tham khảo", descEn: "Record Parts 1–3 with instant reference scores", href: "/speaking", icon: "Mic", visible: true, isSystem: true },
      { id: "hdr-ielts-d", labelVi: "Đề thi mỗi ngày", labelEn: "Daily Exams", descVi: "Thử thách 15 phút mỗi ngày theo giờ Việt Nam", descEn: "One timed exam daily (Asia/Ho_Chi_Minh timezone)", href: "/daily-exam", icon: "Flame", visible: true, isSystem: true },
      { id: "hdr-ielts-lb", labelVi: "Bảng xếp hạng", labelEn: "Leaderboards", descVi: "Đua chuỗi ngày học & tốc độ làm bài", descEn: "Compete on accuracy, speed & study streaks", href: "/leaderboard", icon: "Trophy", visible: true, isSystem: true },
      { id: "hdr-ielts-bc", labelVi: "Tính điểm Band IELTS", labelEn: "IELTS Band Calculator", descVi: "Quy đổi điểm chính xác theo quy tắc làm tròn", descEn: "Official rounding & raw-score conversions", href: "/band-calculator", icon: "Calculator", visible: true, isSystem: true },
    ],
  },
  { id: "hdr-courses", labelVi: "Khóa học", labelEn: "Courses", href: "/courses", icon: "GraduationCap", visible: true, isSystem: true, children: [] },
  { id: "hdr-conv", labelVi: "Hội thoại AI", labelEn: "AI Conversations", href: "/conversations", icon: "MessageSquare", visible: true, isSystem: true, children: [] },
  {
    id: "hdr-writing",
    labelVi: "Luyện viết",
    labelEn: "Writing Lab",
    href: "/writing",
    icon: "PenTool",
    visible: true,
    isSystem: true,
    children: [
      { id: "hdr-w-check", labelVi: "Chấm bài Writing AI", labelEn: "AI Writing Checker", href: "/writing", icon: "PenTool", visible: true, isSystem: true },
      { id: "hdr-w-gen", labelVi: "Tạo bài mẫu Band 9", labelEn: "Band 9 Sample Generator", href: "/writing/generator", icon: "Sparkles", visible: true, isSystem: true },
      { id: "hdr-w-ex", labelVi: "Bài tập nâng cấp câu viết", labelEn: "Writing Improvement Exercises", href: "/writing/exercises", icon: "BookOpen", visible: true, isSystem: true },
    ],
  },
  { id: "hdr-pron", labelVi: "Phát âm", labelEn: "Pronunciation", href: "/pronunciation", icon: "Volume2", visible: true, isSystem: true, children: [] },
  { id: "hdr-dict", labelVi: "Chép chính tả/Shadowing", labelEn: "Dictation / Shadowing", href: "/dictation", icon: "Headphones", visible: true, isSystem: true, children: [] },
  { id: "hdr-fc", labelVi: "Flashcards", labelEn: "Flashcards", href: "/flashcards", icon: "Layers", visible: true, isSystem: true, children: [] },
  { id: "hdr-vid", labelVi: "Video", labelEn: "Videos", href: "/videos", icon: "Video", visible: true, isSystem: true, children: [] },
  {
    id: "hdr-tools",
    labelVi: "Công cụ",
    labelEn: "Tools",
    href: "/tools",
    icon: "Wrench",
    visible: true,
    isSystem: true,
    children: [
      { id: "hdr-t-para", labelVi: "Paraphraser", labelEn: "Paraphraser", href: "/tools/paraphraser", visible: true, isSystem: true },
      { id: "hdr-t-sum", labelVi: "Summarizer", labelEn: "Summarizer", href: "/tools/summarizer", visible: true, isSystem: true },
      { id: "hdr-t-tr", labelVi: "Translator (EN⇄VI)", labelEn: "Translator (EN⇄VI)", href: "/tools/translator", visible: true, isSystem: true },
      { id: "hdr-t-gc", labelVi: "Grammar Checker", labelEn: "Grammar Checker", href: "/tools/grammar-checker", visible: true, isSystem: true },
      { id: "hdr-t-gcor", labelVi: "Grammar Corrector", labelEn: "Grammar Corrector", href: "/tools/grammar-corrector", visible: true, isSystem: true },
      { id: "hdr-t-ti", labelVi: "Text Improver", labelEn: "Text Improver", href: "/tools/text-improver", visible: true, isSystem: true },
      { id: "hdr-t-cs", labelVi: "Complex Sentence", labelEn: "Complex Sentence", href: "/tools/complex-sentence-explainer", visible: true, isSystem: true },
      { id: "hdr-t-tts", labelVi: "Text-to-Speech", labelEn: "Text-to-Speech", href: "/tools/text-to-speech", visible: true, isSystem: true },
      { id: "hdr-t-mentor", labelVi: "Mentor Ôn IELTS", labelEn: "Mentor Ôn IELTS", href: "/mentor", icon: "Sparkles", visible: true, isSystem: true },
      { id: "hdr-t-all", labelVi: "Tất cả công cụ AI", labelEn: "All AI Learning Tools", href: "/tools", icon: "Wrench", visible: true, isSystem: true },
    ],
  },
];

export const DEFAULT_PUBLIC_FOOTER_COLUMNS: FooterColumnConfig[] = [
  {
    id: "fcol-resources",
    labelVi: "Tài nguyên học tập",
    labelEn: "Resources",
    visible: true,
    isSystem: true,
    links: [
      { id: "fl-tests", labelVi: "Đề thi Reading", labelEn: "Reading Practice Tests", href: "/tests", visible: true, isSystem: true },
      { id: "fl-daily", labelVi: "Đề thi mỗi ngày", labelEn: "Daily Exams", href: "/daily-exam", visible: true, isSystem: true },
      { id: "fl-band", labelVi: "Tính điểm Band IELTS", labelEn: "IELTS Band Calculator", href: "/band-calculator", visible: true, isSystem: true },
      { id: "fl-tools", labelVi: "Tất cả công cụ AI", labelEn: "All AI Learning Tools", href: "/tools", visible: true, isSystem: true },
      { id: "fl-blog", labelVi: "Blog & Mẹo thi", labelEn: "Study Blog & Tips", href: "/blog", visible: true, isSystem: true },
      { id: "fl-mentor", labelVi: "Mentor Ôn IELTS", labelEn: "Mentor Ôn IELTS", href: "/mentor", visible: true, isSystem: true },
    ],
  },
  {
    id: "fcol-legal",
    labelVi: "Pháp lý",
    labelEn: "Legal",
    visible: true,
    isSystem: true,
    links: [
      { id: "fl-privacy", labelVi: "Chính sách bảo mật", labelEn: "Privacy Policy", href: "/legal/privacy", visible: true, isSystem: true },
      { id: "fl-terms", labelVi: "Điều khoản sử dụng", labelEn: "Terms of Service", href: "/legal/terms", visible: true, isSystem: true },
      { id: "fl-disc", labelVi: "Miễn trừ trách nhiệm", labelEn: "Disclaimers", href: "/legal/disclaimers", visible: true, isSystem: true },
      { id: "fl-refund", labelVi: "Chính sách hoàn tiền", labelEn: "Refund Policy", href: "/legal/refund-policy", visible: true, isSystem: true },
      { id: "fl-faqs", labelVi: "Câu hỏi thường gặp", labelEn: "FAQs", href: "/legal/faqs", visible: true, isSystem: true },
    ],
  },
  {
    id: "fcol-company",
    labelVi: "Về Ôn IELTS",
    labelEn: "Company",
    visible: true,
    isSystem: true,
    links: [
      { id: "fl-about", labelVi: "Giới thiệu", labelEn: "About Us", href: "/about", visible: true, isSystem: true },
      { id: "fl-pricing", labelVi: "Bảng giá Premium", labelEn: "Pricing", href: "/pricing", visible: true, isSystem: true },
      { id: "fl-ref", labelVi: "Mời bạn bè", labelEn: "Referral Program", href: "/referral", visible: true, isSystem: true },
      { id: "fl-fr", labelVi: "Đề xuất tính năng", labelEn: "Feature Requests", href: "/feature-requests", visible: true, isSystem: true },
      { id: "fl-contact", labelVi: "Liên hệ", labelEn: "Contact", href: "/contact", visible: true, isSystem: true },
      { id: "fl-sitemap", labelVi: "Sơ đồ trang (HTML)", labelEn: "HTML Sitemap", href: "/sitemap-html", visible: true, isSystem: true },
    ],
  },
];

export const DEFAULT_APPEARANCE_CONFIG: SiteAppearanceConfig = {
  homepage: {
    sections: DEFAULT_HOME_SECTIONS,
  },
  theme: DEFAULT_THEME_CONFIG,
  branding: DEFAULT_BRANDING_CONFIG,
  menus: {
    adminSidebar: DEFAULT_ADMIN_SIDEBAR_MENU,
    publicHeader: DEFAULT_PUBLIC_HEADER_MENU,
    publicFooter: DEFAULT_PUBLIC_FOOTER_COLUMNS,
  },
  footer: {
    descriptionVi: DEFAULT_SITE_GENERAL_SETTINGS.taglineVi,
    descriptionEn: DEFAULT_SITE_GENERAL_SETTINGS.taglineEn,
    email: DEFAULT_SITE_GENERAL_SETTINGS.supportEmail,
    phone: DEFAULT_SITE_GENERAL_SETTINGS.hotline,
    address: DEFAULT_SITE_GENERAL_SETTINGS.address,
    socialYoutube: "",
    socialFacebook: "",
    socialTiktok: "",
    socialZalo: "",
    copyrightVi: "© {year} Ôn IELTS (onielts.vn). Bảo lưu mọi quyền.",
    copyrightEn: "© {year} Ôn IELTS (onielts.vn). All original content reserved.",
    disclaimerVi: DEFAULT_SITE_GENERAL_SETTINGS.disclaimerVi,
    disclaimerEn: DEFAULT_SITE_GENERAL_SETTINGS.disclaimerEn,
  },
  widgets: {
    topBanner: {
      enabled: false,
      textVi: "Mới: Thử sức Đề thi mỗi ngày 15 phút (UTC+7) & Kho đề chuẩn máy tính!",
      textEn: "New: Join today's 15-minute Daily IELTS Sprint & full mock tests!",
      ctaLabelVi: "Tham gia ngay",
      ctaLabelEn: "Join now",
      href: "/daily-exam",
      startsAt: "",
      endsAt: "",
      bgColor: "#047857",
    },
    popup: {
      enabled: false,
      titleVi: "Ưu đãi học IELTS cùng AI",
      titleEn: "Special AI IELTS Study Offer",
      bodyVi:
        "Đăng ký tài khoản miễn phí để lưu lịch sử làm bài, tạo Flashcard tự động và nhận lượt chấm AI Writing/Speaking mỗi tháng.",
      bodyEn:
        "Create a free account to save test attempts, build smart flashcards, and get monthly AI Writing & Speaking feedback.",
      imageUrl: "",
      ctaLabelVi: "Khám phá gói Premium",
      ctaLabelEn: "Explore Premium",
      ctaHref: "/pricing",
      startsAt: "",
      endsAt: "",
      frequency: "once_per_day",
    },
    floatingChat: {
      enabled: false,
      messengerUrl: "",
      zaloUrl: "",
      tooltipVi: "Nhắn tin hỗ trợ",
      tooltipEn: "Chat with Support",
    },
    cookieBanner: {
      enabled: false,
      textVi:
        "Ôn IELTS sử dụng cookie thiết yếu để duy trì đăng nhập, lưu giao diện sáng/tối và ghi nhớ tiến độ học tập của bạn.",
      textEn:
        "Ôn IELTS uses essential cookies to keep you signed in, remember your theme preference, and preserve study progress.",
      acceptLabelVi: "Đồng ý",
      acceptLabelEn: "Accept",
      policyHref: "/legal/privacy",
    },
    notFoundPage: {
      titleVi: "Không tìm thấy trang bạn yêu cầu",
      titleEn: "Page Not Found",
      descriptionVi:
        "Đường dẫn này có thể đã được chuyển sang địa chỉ mới hoặc không còn tồn tại trên Ôn IELTS.",
      descriptionEn:
        "This URL may have been moved or no longer exists on Ôn IELTS.",
      buttonLabelVi: "Quay về trang chủ",
      buttonLabelEn: "Back to Home",
      quickLinks: [
        { labelVi: "Kho đề thi IELTS", labelEn: "IELTS Practice Tests", href: "/tests" },
        { labelVi: "Chấm Writing AI", labelEn: "AI Writing Checker", href: "/writing" },
        { labelVi: "Blog & Mẹo thi", labelEn: "Blog & Tips", href: "/blog" },
        { labelVi: "Liên hệ hỗ trợ", labelEn: "Contact Support", href: "/contact" },
      ],
    },
    maintenance: {
      enabled: false,
      titleVi: "Ôn IELTS đang bảo trì nâng cấp hệ thống",
      titleEn: "Ôn IELTS is currently under maintenance",
      messageVi:
        "Chúng tôi đang nâng cấp cơ sở dữ liệu và chất lượng chấm AI để phục vụ bạn mượt mà hơn. Vui lòng quay lại sau ít phút!",
      messageEn:
        "We are upgrading our platform and AI grading experience. Please check back in a few minutes!",
      expectedReturnText: "",
    },
  },
  analytics: {
    googleAnalyticsId: "",
    googleSiteVerification: "",
  },
  uiTexts: {},
};

// =============================================================================
// SANITIZERS & PURE HELPERS
// =============================================================================
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function sanitizePlainText(input: string, maxLen = 400): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLen);
}

export function isSafeNavHref(raw?: string | null): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^mailto:[^\s]+$/i.test(trimmed)) return true;
  if (/^tel:[+\d\s().-]+$/i.test(trimmed)) return true;
  return false;
}

export function isWithinScheduleWindow(
  startsAt: string | undefined,
  endsAt: string | undefined,
  nowMs: number
): boolean {
  if (startsAt && startsAt.trim()) {
    const startMs = Date.parse(startsAt);
    if (Number.isFinite(startMs) && nowMs < startMs) return false;
  }
  if (endsAt && endsAt.trim()) {
    const endMs = Date.parse(endsAt);
    if (Number.isFinite(endMs) && nowMs > endMs) return false;
  }
  return true;
}

export function darkenHex(hex: string, amount = 0.14): string {
  if (!HEX_COLOR_REGEX.test(hex)) return "#047857";
  const r = Math.max(0, Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function hexToSoftTint(hex: string): string {
  if (!HEX_COLOR_REGEX.test(hex)) return "#ecfdf5";
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * 0.12 + 255 * 0.88));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * 0.12 + 255 * 0.88));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * 0.12 + 255 * 0.88));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function getGoogleFontHref(fontId: AppearanceFontId): string | null {
  const found = APPEARANCE_FONTS.find((f) => f.id === fontId);
  if (!found || !found.googleQuery) return null;
  return `https://fonts.googleapis.com/css2?family=${found.googleQuery}&display=swap`;
}

export function buildThemeCssVariables(theme: ThemeConfig): string {
  const primary = HEX_COLOR_REGEX.test(theme.primaryColor)
    ? theme.primaryColor
    : DEFAULT_THEME_CONFIG.primaryColor;
  const primaryHover = darkenHex(primary, 0.14);
  const primarySoft = hexToSoftTint(primary);
  const secondary = HEX_COLOR_REGEX.test(theme.secondaryColor)
    ? theme.secondaryColor
    : DEFAULT_THEME_CONFIG.secondaryColor;
  const bgLight = HEX_COLOR_REGEX.test(theme.backgroundLight)
    ? theme.backgroundLight
    : DEFAULT_THEME_CONFIG.backgroundLight;
  const bgDark = HEX_COLOR_REGEX.test(theme.backgroundDark)
    ? theme.backgroundDark
    : DEFAULT_THEME_CONFIG.backgroundDark;

  const radiusObj =
    BORDER_RADIUS_OPTIONS.find((r) => r.id === theme.borderRadius) ??
    BORDER_RADIUS_OPTIONS[3];
  const fontObj =
    APPEARANCE_FONTS.find((f) => f.id === theme.fontFamily) ?? APPEARANCE_FONTS[0];

  const isCustomPrimary =
    primary.toLowerCase() !== DEFAULT_THEME_CONFIG.primaryColor.toLowerCase();
  const isCustomRadius = theme.borderRadius !== DEFAULT_THEME_CONFIG.borderRadius;

  return [
    `:root {`,
    `  --primary: ${primary};`,
    `  --primary-hover: ${primaryHover};`,
    `  --primary-soft: ${primarySoft};`,
    `  --secondary: ${secondary};`,
    `  --background: ${bgLight};`,
    `  --cms-radius: ${radiusObj.cssValue};`,
    `  --cms-font-sans: ${fontObj.cssFamily};`,
    `}`,
    `.dark {`,
    `  --background: ${bgDark};`,
    `  --secondary: ${secondary};`,
    `}`,
    `body { font-family: var(--cms-font-sans); }`,
    isCustomRadius
      ? `.rounded-2xl { border-radius: var(--cms-radius) !important; } .rounded-xl { border-radius: calc(var(--cms-radius) * 0.75) !important; }`
      : "",
    isCustomPrimary
      ? `.bg-emerald-600 { background-color: var(--primary) !important; } .hover\\:bg-emerald-700:hover { background-color: var(--primary-hover) !important; } .text-emerald-600, .text-emerald-700 { color: var(--primary) !important; } .border-emerald-500, .border-emerald-600 { border-color: var(--primary) !important; }`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Deep-merges dot-notation UI text overrides (e.g. "home.heroTitle" -> { vi, en })
 * onto the base next-intl messages object without mutating the original.
 */
export function applyUiTextOverrides(
  baseMessages: Record<string, unknown>,
  uiTexts: Record<string, UiTextOverride> | undefined,
  locale: string
): Record<string, unknown> {
  if (!uiTexts || Object.keys(uiTexts).length === 0) return baseMessages;
  const clone = structuredClone(baseMessages);
  const lang = locale === "en" ? "en" : "vi";

  for (const [dotKey, pair] of Object.entries(uiTexts)) {
    const val = (pair?.[lang] ?? "").trim();
    if (!val) continue;
    const segments = dotKey.split(".").filter(Boolean);
    if (segments.length === 0 || segments.length > 5) continue;
    // Block prototype pollution keys
    if (segments.some((s) => s === "__proto__" || s === "prototype" || s === "constructor")) {
      continue;
    }
    let cursor: Record<string, unknown> = clone;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (typeof cursor[seg] !== "object" || cursor[seg] === null || Array.isArray(cursor[seg])) {
        cursor[seg] = {};
      }
      cursor = cursor[seg] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]] = sanitizePlainText(val, 600);
  }

  return clone;
}

/**
 * Resolves localized Group & Item labels for the active Admin pathname so
 * Sidebar, Breadcrumb, and Page Header all share 100% consistent VI/EN names.
 */
export function resolveAdminRouteBreadcrumb(
  pathname: string,
  groups: AdminMenuGroup[],
  locale: string
): {
  groupLabel: string | null;
  itemLabel: string | null;
  itemHref: string | null;
  subLabel: string | null;
} {
  const isEn = locale === "en";
  const cleanPath = pathname.replace(/\/+$/, "") || "/admin";

  let best: {
    groupLabel: string;
    itemLabel: string;
    itemHref: string;
    matchLen: number;
  } | null = null;

  for (const grp of groups) {
    const gLabel = isEn ? grp.labelEn || grp.labelVi : grp.labelVi;
    for (const item of grp.items) {
      const base = item.href.split(/[?#]/)[0].replace(/\/+$/, "") || "/admin";
      const exact = cleanPath === base;
      const nested = base !== "/admin" && cleanPath.startsWith(`${base}/`);
      if (exact || nested) {
        if (!best || base.length > best.matchLen) {
          best = {
            groupLabel: gLabel,
            itemLabel: isEn ? item.labelEn || item.labelVi : item.labelVi,
            itemHref: base,
            matchLen: base.length,
          };
        }
      }
    }
  }

  if (!best) {
    return { groupLabel: null, itemLabel: null, itemHref: null, subLabel: null };
  }

  let subLabel: string | null = null;
  if (cleanPath !== best.itemHref) {
    const tail = cleanPath.slice(best.itemHref.length + 1);
    if (tail === "new") {
      subLabel = isEn ? "Create New" : "Tạo mới";
    } else if (tail) {
      subLabel = isEn ? "Edit" : "Chỉnh sửa";
    }
  }

  return {
    groupLabel: best.groupLabel,
    itemLabel: best.itemLabel,
    itemHref: best.itemHref,
    subLabel,
  };
}

// =============================================================================
// SYSTEM MENU INTEGRITY GUARD (NEVER DELETE SYSTEM ITEMS / NEVER CHANGE SYSTEM URLS)
// =============================================================================
export function enforceSystemMenuIntegrity(
  config: SiteAppearanceConfig
): SiteAppearanceConfig {
  const next = structuredClone(config);

  // 1. Admin Sidebar: preserve all system items & lock their URLs + adminOnly flags
  const defaultAdminItems = new Map<
    string,
    { groupId: string; item: AdminMenuItem }
  >();
  for (const g of DEFAULT_ADMIN_SIDEBAR_MENU) {
    for (const it of g.items) {
      defaultAdminItems.set(it.id, { groupId: g.id, item: it });
    }
  }

  const seenAdminIds = new Set<string>();
  next.menus.adminSidebar = next.menus.adminSidebar.map((grp) => ({
    ...grp,
    labelVi: sanitizePlainText(grp.labelVi, 40) || "Nhóm",
    labelEn: sanitizePlainText(grp.labelEn || grp.labelVi, 40) || "Group",
    items: grp.items.map((it) => {
      const sys = defaultAdminItems.get(it.id);
      seenAdminIds.add(it.id);
      if (sys) {
        return {
          ...it,
          labelVi: sanitizePlainText(it.labelVi, 40) || sys.item.labelVi,
          labelEn: sanitizePlainText(it.labelEn || it.labelVi, 40) || sys.item.labelEn,
          // Renaming NEVER changes system URLs or adminOnly security flag!
          href: sys.item.href,
          adminOnly: sys.item.adminOnly,
          isSystem: true,
        };
      }
      return {
        ...it,
        labelVi: sanitizePlainText(it.labelVi, 40),
        labelEn: sanitizePlainText(it.labelEn || it.labelVi, 40),
        isSystem: false,
      };
    }),
  }));

  // Re-attach any missing system admin item (as hidden) if payload tried to delete it
  for (const [id, { groupId, item }] of defaultAdminItems.entries()) {
    if (seenAdminIds.has(id)) continue;
    let targetGroup = next.menus.adminSidebar.find((g) => g.id === groupId);
    if (!targetGroup) {
      const defGroup = DEFAULT_ADMIN_SIDEBAR_MENU.find((g) => g.id === groupId)!;
      targetGroup = { ...structuredClone(defGroup), items: [] };
      next.menus.adminSidebar.push(targetGroup);
    }
    targetGroup.items.push({ ...structuredClone(item), visible: false });
  }

  // Always keep /admin/appearance accessible so Admin can never lock themselves out!
  for (const g of next.menus.adminSidebar) {
    for (const it of g.items) {
      if (it.id === "adm-appearance") {
        it.visible = true;
        g.visible = true;
      }
    }
  }

  // 2. Public Header: preserve system items & lock their URLs
  const defaultHeaderMap = new Map(
    DEFAULT_PUBLIC_HEADER_MENU.map((m) => [m.id, m])
  );
  const seenHeaderIds = new Set<string>();
  next.menus.publicHeader = next.menus.publicHeader.map((it) => {
    seenHeaderIds.add(it.id);
    const sys = defaultHeaderMap.get(it.id);
    const sysChildMap = new Map((sys?.children ?? []).map((c) => [c.id, c]));
    const incomingChildren = (it.children ?? []).map((c) => {
      const sc = sysChildMap.get(c.id);
      if (sc) {
        return {
          ...c,
          labelVi: sanitizePlainText(c.labelVi, 40) || sc.labelVi,
          labelEn: sanitizePlainText(c.labelEn || c.labelVi, 40) || sc.labelEn,
          href: sc.href,
          isSystem: true,
        };
      }
      return {
        ...c,
        labelVi: sanitizePlainText(c.labelVi, 40),
        labelEn: sanitizePlainText(c.labelEn || c.labelVi, 40),
        isSystem: false,
      };
    });

    if (sys) {
      return {
        ...it,
        labelVi: sanitizePlainText(it.labelVi, 40) || sys.labelVi,
        labelEn: sanitizePlainText(it.labelEn || it.labelVi, 40) || sys.labelEn,
        href: sys.href,
        isSystem: true,
        children: incomingChildren,
      };
    }
    return {
      ...it,
      labelVi: sanitizePlainText(it.labelVi, 40),
      labelEn: sanitizePlainText(it.labelEn || it.labelVi, 40),
      isSystem: false,
      children: incomingChildren,
    };
  });

  for (const [id, defItem] of defaultHeaderMap.entries()) {
    if (!seenHeaderIds.has(id)) {
      next.menus.publicHeader.push({ ...structuredClone(defItem), visible: false });
    }
  }

  // 3. Public Footer Columns: preserve system links URLs when present
  const defaultFooterLinks = new Map<string, FooterLinkItem>();
  for (const col of DEFAULT_PUBLIC_FOOTER_COLUMNS) {
    for (const l of col.links) defaultFooterLinks.set(l.id, l);
  }
  next.menus.publicFooter = next.menus.publicFooter.map((col) => ({
    ...col,
    labelVi: sanitizePlainText(col.labelVi, 40) || "Liên kết",
    labelEn: sanitizePlainText(col.labelEn || col.labelVi, 40) || "Links",
    links: col.links.map((l) => {
      const sys = defaultFooterLinks.get(l.id);
      if (sys) {
        return {
          ...l,
          labelVi: sanitizePlainText(l.labelVi, 40) || sys.labelVi,
          labelEn: sanitizePlainText(l.labelEn || l.labelVi, 40) || sys.labelEn,
          href: sys.href,
          isSystem: true,
        };
      }
      return {
        ...l,
        labelVi: sanitizePlainText(l.labelVi, 40),
        labelEn: sanitizePlainText(l.labelEn || l.labelVi, 40),
        isSystem: false,
      };
    }),
  }));

  // 4. Homepage: ensure all 12 canonical sections exist
  const seenHome = new Set(next.homepage.sections.map((s) => s.id));
  for (const defSec of DEFAULT_HOME_SECTIONS) {
    if (!seenHome.has(defSec.id)) {
      next.homepage.sections.push(structuredClone(defSec));
    }
  }

  return next;
}

/**
 * Restores ONLY the default VI/EN names of all system groups and items
 * while preserving the admin's custom ordering, visibility, icons, and custom groups.
 */
export function restoreDefaultMenuNames(
  config: SiteAppearanceConfig
): SiteAppearanceConfig {
  const next = structuredClone(config);

  const defAdminGroupMap = new Map(DEFAULT_ADMIN_SIDEBAR_MENU.map((g) => [g.id, g]));
  const defAdminItemMap = new Map<string, AdminMenuItem>();
  for (const g of DEFAULT_ADMIN_SIDEBAR_MENU) {
    for (const it of g.items) defAdminItemMap.set(it.id, it);
  }

  next.menus.adminSidebar = next.menus.adminSidebar.map((grp) => {
    const dg = defAdminGroupMap.get(grp.id);
    return {
      ...grp,
      labelVi: dg ? dg.labelVi : grp.labelVi,
      labelEn: dg ? dg.labelEn : grp.labelEn,
      items: grp.items.map((it) => {
        const di = defAdminItemMap.get(it.id);
        return di
          ? { ...it, labelVi: di.labelVi, labelEn: di.labelEn, icon: di.icon }
          : it;
      }),
    };
  });

  const defHdrMap = new Map(DEFAULT_PUBLIC_HEADER_MENU.map((m) => [m.id, m]));
  const defHdrChildMap = new Map<string, MenuSubItem>();
  for (const m of DEFAULT_PUBLIC_HEADER_MENU) {
    for (const c of m.children ?? []) defHdrChildMap.set(c.id, c);
  }

  next.menus.publicHeader = next.menus.publicHeader.map((it) => {
    const dh = defHdrMap.get(it.id);
    return {
      ...it,
      labelVi: dh ? dh.labelVi : it.labelVi,
      labelEn: dh ? dh.labelEn : it.labelEn,
      children: (it.children ?? []).map((c) => {
        const dc = defHdrChildMap.get(c.id);
        return dc
          ? { ...c, labelVi: dc.labelVi, labelEn: dc.labelEn, descVi: dc.descVi, descEn: dc.descEn }
          : c;
      }),
    };
  });

  const defFColMap = new Map(DEFAULT_PUBLIC_FOOTER_COLUMNS.map((c) => [c.id, c]));
  const defFLinkMap = new Map<string, FooterLinkItem>();
  for (const col of DEFAULT_PUBLIC_FOOTER_COLUMNS) {
    for (const l of col.links) defFLinkMap.set(l.id, l);
  }

  next.menus.publicFooter = next.menus.publicFooter.map((col) => {
    const dc = defFColMap.get(col.id);
    return {
      ...col,
      labelVi: dc ? dc.labelVi : col.labelVi,
      labelEn: dc ? dc.labelEn : col.labelEn,
      links: col.links.map((l) => {
        const dl = defFLinkMap.get(l.id);
        return dl ? { ...l, labelVi: dl.labelVi, labelEn: dl.labelEn } : l;
      }),
    };
  });

  return next;
}

// =============================================================================
// STRICT ZOD VALIDATION SCHEMA
// =============================================================================
const safeHrefSchema = z
  .string()
  .trim()
  .max(400)
  .refine((v) => isSafeNavHref(v), "Đường dẫn không hợp lệ (chỉ chấp nhận /..., https://, mailto:, tel:).");

const menuLabelSchema = z
  .string()
  .trim()
  .min(1, "Tên nhóm / tên mục menu không được để trống.")
  .max(40, "Tên nhóm / tên mục menu tối đa 40 ký tự.")
  .transform((v) => sanitizePlainText(v, 40));

const optionalMenuLabelSchema = z
  .string()
  .trim()
  .max(40, "Tên tiếng Anh tối đa 40 ký tự.")
  .optional()
  .default("")
  .transform((v) => sanitizePlainText(v, 40));

const menuSubItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  labelVi: menuLabelSchema,
  labelEn: optionalMenuLabelSchema,
  descVi: z.string().trim().max(180).optional().default("").transform((v) => sanitizePlainText(v, 180)),
  descEn: z.string().trim().max(180).optional().default("").transform((v) => sanitizePlainText(v, 180)),
  href: safeHrefSchema.refine((v) => v.length >= 1, "Đường dẫn mục con không được để trống."),
  icon: z.string().trim().max(40).optional(),
  visible: z.boolean().default(true),
  isSystem: z.boolean().optional(),
});

const adminMenuItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  labelVi: menuLabelSchema,
  labelEn: optionalMenuLabelSchema,
  href: safeHrefSchema.refine((v) => v.length >= 1, "Đường dẫn mục menu không được để trống."),
  icon: z.string().trim().min(1).max(40).default("BookOpen"),
  visible: z.boolean().default(true),
  adminOnly: z.boolean().optional(),
  isSystem: z.boolean().optional(),
  children: z.array(menuSubItemSchema).max(20).optional().default([]),
});

const adminMenuGroupSchema = z.object({
  id: z.string().trim().min(1).max(80),
  labelVi: menuLabelSchema,
  labelEn: optionalMenuLabelSchema,
  visible: z.boolean().default(true),
  isSystem: z.boolean().optional(),
  items: z.array(adminMenuItemSchema).max(30),
});

const publicHeaderMenuItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  labelVi: menuLabelSchema,
  labelEn: optionalMenuLabelSchema,
  href: safeHrefSchema.refine((v) => v.length >= 1, "Đường dẫn menu header không được để trống."),
  icon: z.string().trim().max(40).default("BookOpen"),
  visible: z.boolean().default(true),
  isSystem: z.boolean().optional(),
  children: z.array(menuSubItemSchema).max(20).optional().default([]),
});

const footerLinkItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  labelVi: menuLabelSchema,
  labelEn: optionalMenuLabelSchema,
  href: safeHrefSchema.refine((v) => v.length >= 1, "Đường dẫn footer không được để trống."),
  visible: z.boolean().default(true),
  isSystem: z.boolean().optional(),
});

const footerColumnSchema = z.object({
  id: z.string().trim().min(1).max(80),
  labelVi: menuLabelSchema,
  labelEn: optionalMenuLabelSchema,
  visible: z.boolean().default(true),
  isSystem: z.boolean().optional(),
  links: z.array(footerLinkItemSchema).max(20),
});

const homeSectionSchema = z.object({
  id: z.enum([
    "hero",
    "testimonials",
    "latestTests",
    "dailyExam",
    "tools",
    "courses",
    "conversations",
    "writingExercises",
    "pronunciation",
    "dictation",
    "videos",
    "featuredBlog",
  ]),
  enabled: z.boolean(),
  titleVi: z.string().trim().min(1, "Tiêu đề khối không được để trống.").max(140).transform((v) => sanitizePlainText(v, 140)),
  titleEn: z.string().trim().max(140).optional().default("").transform((v) => sanitizePlainText(v, 140)),
  subtitleVi: z.string().trim().max(400).optional().default("").transform((v) => sanitizePlainText(v, 400)),
  subtitleEn: z.string().trim().max(400).optional().default("").transform((v) => sanitizePlainText(v, 400)),
  badgeVi: z.string().trim().max(60).optional().default("").transform((v) => sanitizePlainText(v, 60)),
  badgeEn: z.string().trim().max(60).optional().default("").transform((v) => sanitizePlainText(v, 60)),
  ctaPrimaryVi: z.string().trim().max(50).optional().default("").transform((v) => sanitizePlainText(v, 50)),
  ctaPrimaryEn: z.string().trim().max(50).optional().default("").transform((v) => sanitizePlainText(v, 50)),
  ctaPrimaryHref: safeHrefSchema.optional().default(""),
  ctaSecondaryVi: z.string().trim().max(50).optional().default("").transform((v) => sanitizePlainText(v, 50)),
  ctaSecondaryEn: z.string().trim().max(50).optional().default("").transform((v) => sanitizePlainText(v, 50)),
  ctaSecondaryHref: safeHrefSchema.optional().default(""),
  viewAllLabelVi: z.string().trim().max(40).optional().default("").transform((v) => sanitizePlainText(v, 40)),
  viewAllLabelEn: z.string().trim().max(40).optional().default("").transform((v) => sanitizePlainText(v, 40)),
  limit: z.coerce.number().int().min(1).max(30).default(6),
});

const optionalDateStrSchema = z
  .string()
  .trim()
  .max(64)
  .default("")
  .refine(
    (v) => !v || Number.isFinite(Date.parse(v)),
    "Định dạng ngày giờ không hợp lệ."
  );

const fontIds = APPEARANCE_FONTS.map((f) => f.id) as [
  AppearanceFontId,
  ...AppearanceFontId[],
];

export const siteAppearanceSchema = z.object({
  homepage: z.object({
    sections: z.array(homeSectionSchema).min(1).max(20),
  }),
  theme: z.object({
    primaryColor: z.string().trim().regex(HEX_COLOR_REGEX, "Màu chính phải có dạng mã Hex #RRGGBB."),
    secondaryColor: z.string().trim().regex(HEX_COLOR_REGEX, "Màu phụ phải có dạng mã Hex #RRGGBB."),
    backgroundLight: z.string().trim().regex(HEX_COLOR_REGEX, "Màu nền sáng phải có dạng mã Hex #RRGGBB."),
    backgroundDark: z.string().trim().regex(HEX_COLOR_REGEX, "Màu nền tối phải có dạng mã Hex #RRGGBB."),
    fontFamily: z.enum(fontIds),
    borderRadius: z.enum(["none", "sm", "md", "lg", "xl"]),
    defaultColorMode: z.enum(["light", "dark", "system"]),
  }),
  branding: z.object({
    siteName: z.string().trim().min(2, "Tên website tối thiểu 2 ký tự.").max(60).transform((v) => sanitizePlainText(v, 60)),
    taglineVi: z.string().trim().max(260).default("").transform((v) => sanitizePlainText(v, 260)),
    taglineEn: z.string().trim().max(260).default("").transform((v) => sanitizePlainText(v, 260)),
    logoLightUrl: safeHrefSchema.default(""),
    logoDarkUrl: safeHrefSchema.default(""),
    faviconUrl: safeHrefSchema.default(""),
  }),
  menus: z.object({
    adminSidebar: z.array(adminMenuGroupSchema).min(1).max(12),
    publicHeader: z.array(publicHeaderMenuItemSchema).min(1).max(16),
    publicFooter: z.array(footerColumnSchema).min(1).max(6),
  }),
  footer: z.object({
    descriptionVi: z.string().trim().max(320).default("").transform((v) => sanitizePlainText(v, 320)),
    descriptionEn: z.string().trim().max(320).default("").transform((v) => sanitizePlainText(v, 320)),
    email: z.string().trim().max(160).default("").transform((v) => sanitizePlainText(v, 160)),
    phone: z.string().trim().max(40).default("").transform((v) => sanitizePlainText(v, 40)),
    address: z.string().trim().max(240).default("").transform((v) => sanitizePlainText(v, 240)),
    socialYoutube: safeHrefSchema.default(""),
    socialFacebook: safeHrefSchema.default(""),
    socialTiktok: safeHrefSchema.default(""),
    socialZalo: safeHrefSchema.default(""),
    copyrightVi: z.string().trim().max(240).default("").transform((v) => sanitizePlainText(v, 240)),
    copyrightEn: z.string().trim().max(240).default("").transform((v) => sanitizePlainText(v, 240)),
    disclaimerVi: z.string().trim().max(600).default("").transform((v) => sanitizePlainText(v, 600)),
    disclaimerEn: z.string().trim().max(600).default("").transform((v) => sanitizePlainText(v, 600)),
  }),
  widgets: z.object({
    topBanner: z.object({
      enabled: z.boolean(),
      textVi: z.string().trim().max(260).default("").transform((v) => sanitizePlainText(v, 260)),
      textEn: z.string().trim().max(260).default("").transform((v) => sanitizePlainText(v, 260)),
      ctaLabelVi: z.string().trim().max(40).default("").transform((v) => sanitizePlainText(v, 40)),
      ctaLabelEn: z.string().trim().max(40).default("").transform((v) => sanitizePlainText(v, 40)),
      href: safeHrefSchema.default(""),
      startsAt: optionalDateStrSchema,
      endsAt: optionalDateStrSchema,
      bgColor: z.string().trim().regex(HEX_COLOR_REGEX, "Màu nền banner phải có dạng #RRGGBB.").default("#047857"),
    }),
    popup: z.object({
      enabled: z.boolean(),
      titleVi: z.string().trim().max(120).default("").transform((v) => sanitizePlainText(v, 120)),
      titleEn: z.string().trim().max(120).default("").transform((v) => sanitizePlainText(v, 120)),
      bodyVi: z.string().trim().max(600).default("").transform((v) => sanitizePlainText(v, 600)),
      bodyEn: z.string().trim().max(600).default("").transform((v) => sanitizePlainText(v, 600)),
      imageUrl: safeHrefSchema.default(""),
      ctaLabelVi: z.string().trim().max(40).default("").transform((v) => sanitizePlainText(v, 40)),
      ctaLabelEn: z.string().trim().max(40).default("").transform((v) => sanitizePlainText(v, 40)),
      ctaHref: safeHrefSchema.default("/pricing"),
      startsAt: optionalDateStrSchema,
      endsAt: optionalDateStrSchema,
      frequency: z.enum(["once_per_session", "once_per_day"]).default("once_per_day"),
    }),
    floatingChat: z.object({
      enabled: z.boolean(),
      messengerUrl: safeHrefSchema.default(""),
      zaloUrl: safeHrefSchema.default(""),
      tooltipVi: z.string().trim().max(60).default("").transform((v) => sanitizePlainText(v, 60)),
      tooltipEn: z.string().trim().max(60).default("").transform((v) => sanitizePlainText(v, 60)),
    }),
    cookieBanner: z.object({
      enabled: z.boolean(),
      textVi: z.string().trim().max(400).default("").transform((v) => sanitizePlainText(v, 400)),
      textEn: z.string().trim().max(400).default("").transform((v) => sanitizePlainText(v, 400)),
      acceptLabelVi: z.string().trim().max(40).default("Đồng ý").transform((v) => sanitizePlainText(v, 40)),
      acceptLabelEn: z.string().trim().max(40).default("Accept").transform((v) => sanitizePlainText(v, 40)),
      policyHref: safeHrefSchema.default("/legal/privacy"),
    }),
    notFoundPage: z.object({
      titleVi: z.string().trim().min(2).max(120).transform((v) => sanitizePlainText(v, 120)),
      titleEn: z.string().trim().max(120).default("").transform((v) => sanitizePlainText(v, 120)),
      descriptionVi: z.string().trim().max(400).default("").transform((v) => sanitizePlainText(v, 400)),
      descriptionEn: z.string().trim().max(400).default("").transform((v) => sanitizePlainText(v, 400)),
      buttonLabelVi: z.string().trim().min(1).max(40).transform((v) => sanitizePlainText(v, 40)),
      buttonLabelEn: z.string().trim().max(40).default("").transform((v) => sanitizePlainText(v, 40)),
      quickLinks: z
        .array(
          z.object({
            labelVi: menuLabelSchema,
            labelEn: optionalMenuLabelSchema,
            href: safeHrefSchema.refine((v) => v.length >= 1),
          })
        )
        .max(8)
        .default([]),
    }),
    maintenance: z.object({
      enabled: z.boolean(),
      titleVi: z.string().trim().min(2).max(140).transform((v) => sanitizePlainText(v, 140)),
      titleEn: z.string().trim().max(140).default("").transform((v) => sanitizePlainText(v, 140)),
      messageVi: z.string().trim().max(500).default("").transform((v) => sanitizePlainText(v, 500)),
      messageEn: z.string().trim().max(500).default("").transform((v) => sanitizePlainText(v, 500)),
      expectedReturnText: z.string().trim().max(120).default("").transform((v) => sanitizePlainText(v, 120)),
    }),
  }),
  analytics: z.object({
    googleAnalyticsId: z
      .string()
      .trim()
      .max(32)
      .default("")
      .refine(
        (v) => !v || GA4_ID_REGEX.test(v),
        "Mã Google Analytics 4 phải đúng định dạng G-XXXXXXXXXX (không dán thẻ <script>)."
      ),
    googleSiteVerification: z
      .string()
      .trim()
      .max(120)
      .default("")
      .refine(
        (v) => !v || GSC_TOKEN_REGEX.test(v),
        "Mã Google Search Console chỉ gồm ký tự hợp lệ (không dán cả thẻ <meta>)."
      ),
  }),
  uiTexts: z
    .record(
      z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._-]+$/, "Key văn bản chỉ gồm chữ, số, dấu chấm, gạch ngang."),
      z.object({
        vi: z.string().trim().max(600).transform((v) => sanitizePlainText(v, 600)),
        en: z.string().trim().max(600).transform((v) => sanitizePlainText(v, 600)),
      })
    )
    .default({}),
});

export function mergeAppearanceWithDefaults(
  partial: Partial<SiteAppearanceConfig> | null | undefined
): SiteAppearanceConfig {
  if (!partial || typeof partial !== "object") {
    return structuredClone(DEFAULT_APPEARANCE_CONFIG);
  }
  const merged: SiteAppearanceConfig = {
    homepage: {
      sections:
        Array.isArray(partial.homepage?.sections) &&
        partial.homepage.sections.length > 0
          ? partial.homepage.sections
          : structuredClone(DEFAULT_HOME_SECTIONS),
    },
    theme: {
      ...DEFAULT_THEME_CONFIG,
      ...(partial.theme ?? {}),
    },
    branding: {
      ...DEFAULT_BRANDING_CONFIG,
      ...(partial.branding ?? {}),
    },
    menus: {
      adminSidebar:
        Array.isArray(partial.menus?.adminSidebar) &&
        partial.menus.adminSidebar.length > 0
          ? partial.menus.adminSidebar
          : structuredClone(DEFAULT_ADMIN_SIDEBAR_MENU),
      publicHeader:
        Array.isArray(partial.menus?.publicHeader) &&
        partial.menus.publicHeader.length > 0
          ? partial.menus.publicHeader
          : structuredClone(DEFAULT_PUBLIC_HEADER_MENU),
      publicFooter:
        Array.isArray(partial.menus?.publicFooter) &&
        partial.menus.publicFooter.length > 0
          ? partial.menus.publicFooter
          : structuredClone(DEFAULT_PUBLIC_FOOTER_COLUMNS),
    },
    footer: {
      ...DEFAULT_APPEARANCE_CONFIG.footer,
      ...(partial.footer ?? {}),
    },
    widgets: {
      topBanner: {
        ...DEFAULT_APPEARANCE_CONFIG.widgets.topBanner,
        ...(partial.widgets?.topBanner ?? {}),
      },
      popup: {
        ...DEFAULT_APPEARANCE_CONFIG.widgets.popup,
        ...(partial.widgets?.popup ?? {}),
      },
      floatingChat: {
        ...DEFAULT_APPEARANCE_CONFIG.widgets.floatingChat,
        ...(partial.widgets?.floatingChat ?? {}),
      },
      cookieBanner: {
        ...DEFAULT_APPEARANCE_CONFIG.widgets.cookieBanner,
        ...(partial.widgets?.cookieBanner ?? {}),
      },
      notFoundPage: {
        ...DEFAULT_APPEARANCE_CONFIG.widgets.notFoundPage,
        ...(partial.widgets?.notFoundPage ?? {}),
      },
      maintenance: {
        ...DEFAULT_APPEARANCE_CONFIG.widgets.maintenance,
        ...(partial.widgets?.maintenance ?? {}),
      },
    },
    analytics: {
      ...DEFAULT_APPEARANCE_CONFIG.analytics,
      ...(partial.analytics ?? {}),
    },
    uiTexts:
      partial.uiTexts && typeof partial.uiTexts === "object"
        ? { ...partial.uiTexts }
        : {},
  };

  return enforceSystemMenuIntegrity(merged);
}
