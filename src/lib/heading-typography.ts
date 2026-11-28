import { z } from "zod";

// =============================================================================
// GOOGLE FONTS ALLOWLIST (SHARED BY GLOBAL THEME & HEADING TYPOGRAPHY)
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
    googleQuery: "Inter:wght@400;500;600;700;800",
    cssFamily: "'Inter', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Plus Jakarta Sans",
    label: "Plus Jakarta Sans (Trẻ trung · EdTech)",
    googleQuery: "Plus+Jakarta+Sans:wght@400;500;600;700;800",
    cssFamily:
      "'Plus Jakarta Sans', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Lexend",
    label: "Lexend (Dễ đọc dài · Luyện Reading)",
    googleQuery: "Lexend:wght@400;500;600;700;800",
    cssFamily: "'Lexend', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Nunito",
    label: "Nunito (Thân thiện · Bo tròn)",
    googleQuery: "Nunito:wght@400;500;600;700;800",
    cssFamily: "'Nunito', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Manrope",
    label: "Manrope (Sắc nét · Chuyên nghiệp)",
    googleQuery: "Manrope:wght@400;500;600;700;800",
    cssFamily: "'Manrope', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Roboto",
    label: "Roboto (Phổ thông · Rõ ràng)",
    googleQuery: "Roboto:wght@400;500;700;900",
    cssFamily: "'Roboto', var(--font-be-vietnam-pro), ui-sans-serif, sans-serif",
  },
  {
    id: "Merriweather",
    label: "Merriweather (Serif học thuật)",
    googleQuery: "Merriweather:wght@400;700;900",
    cssFamily: "'Merriweather', Georgia, serif",
  },
] as const;

export type AppearanceFontId = (typeof APPEARANCE_FONTS)[number]["id"];

export type HeadingFontChoice = "inherit" | AppearanceFontId;

export const HEADING_AREA_IDS = [
  "home",
  "blog",
  "tests",
  "courses",
  "pages",
] as const;

export type HeadingAreaId = (typeof HEADING_AREA_IDS)[number];

export const HEADING_WEIGHT_OPTIONS = [
  { id: "medium", label: "Vừa (600)", cssValue: "600" },
  { id: "bold", label: "Đậm (700 · Mặc định)", cssValue: "700" },
  { id: "extrabold", label: "Rất đậm (800)", cssValue: "800" },
] as const;

export type HeadingWeightPreset = (typeof HEADING_WEIGHT_OPTIONS)[number]["id"];

export const HEADING_SIZE_OPTIONS = [
  { id: "sm", label: "Nhỏ" },
  { id: "md", label: "Vừa (Mặc định)" },
  { id: "lg", label: "Lớn" },
  { id: "xl", label: "Rất lớn" },
] as const;

export type HeadingSizePreset = (typeof HEADING_SIZE_OPTIONS)[number]["id"];

export const HEADING_LINE_HEIGHT_OPTIONS = [
  { id: "tight", label: "Chặt", cssValue: "1.18" },
  { id: "normal", label: "Chuẩn (Mặc định)", cssValue: "1.3" },
  { id: "relaxed", label: "Thoáng", cssValue: "1.45" },
] as const;

export type HeadingLineHeightPreset =
  (typeof HEADING_LINE_HEIGHT_OPTIONS)[number]["id"];

export const HEADING_PASSAGE_ALIGN_OPTIONS = [
  { id: "left", label: "Căn trái (Mặc định)" },
  { id: "center", label: "Căn giữa" },
] as const;

export type HeadingPassageAlign =
  (typeof HEADING_PASSAGE_ALIGN_OPTIONS)[number]["id"];

export const CONTENT_TITLE_SIZE_OPTIONS = [
  { id: "", label: "Mặc định (theo cài đặt chung)" },
  { id: "lg", label: "Lớn" },
  { id: "xl", label: "Rất lớn" },
] as const;

export type ContentTitleSizeOverride = "" | "lg" | "xl";

export interface AreaHeadingTypographyConfig {
  weight: HeadingWeightPreset;
  h1Size: HeadingSizePreset;
  h2Size: HeadingSizePreset;
  h3Size: HeadingSizePreset;
  lineHeight: HeadingLineHeightPreset;
  fontFamily: HeadingFontChoice;
  /** Only used by `tests` area for Reading Passage Title alignment. */
  passageTitleAlign?: HeadingPassageAlign;
}

export type HeadingTypographyConfig = Record<
  HeadingAreaId,
  AreaHeadingTypographyConfig
>;

export const HEADING_AREA_METADATA: ReadonlyArray<{
  id: HeadingAreaId;
  label: string;
  shortLabel: string;
  description: string;
  h1Label: string;
  h2Label: string;
  h3Label: string;
  sampleH1: string;
  sampleH2: string;
  sampleH3: string;
}> = [
  {
    id: "home",
    label: "Trang chủ",
    shortLabel: "Trang chủ",
    description: "Tiêu đề khối mở đầu (Hero) và tiêu đề các khối trên Trang chủ.",
    h1Label: "H1 — Tiêu đề Hero Trang chủ",
    h2Label: "H2 — Tiêu đề các khối Trang chủ",
    h3Label: "H3 — Tiêu đề thẻ nổi bật",
    sampleH1: "Ôn luyện IELTS thông minh cùng AI",
    sampleH2: "Đề thi IELTS mới nhất",
    sampleH3: "Reading Academic 01: Vi khí hậu đô thị",
  },
  {
    id: "blog",
    label: "Blog & Mẹo thi",
    shortLabel: "Blog",
    description: "Tiêu đề bài viết (H1) và các tiêu đề mục H2 / H3 trong nội dung bài.",
    h1Label: "H1 — Tiêu đề bài Blog",
    h2Label: "H2 — Tiêu đề phần chính trong bài",
    h3Label: "H3 — Tiêu đề mục phụ trong bài",
    sampleH1: "5 Chiến thuật làm dạng True / False / Not Given đạt 8.0+",
    sampleH2: "1. Phân biệt rõ FALSE và NOT GIVEN trong bài đọc",
    sampleH3: "Bước 1: Gạch chân từ khóa tuyệt đối và mệnh đề phủ định",
  },
  {
    id: "tests",
    label: "Đề thi IELTS",
    shortLabel: "Đề thi",
    description: "Tên đề thi (H1), tiêu đề Part/Section (H2) và Tiêu đề bài đọc (H3).",
    h1Label: "H1 — Tên đề thi (Trang kho đề & Phòng thi)",
    h2Label: "H2 — Tiêu đề Part / Passage",
    h3Label: "H3 — Tiêu đề bài đọc (Reading Passage Title)",
    sampleH1: "Reading Academic 01: Vi khí hậu đô thị & Rừng ngập mặn",
    sampleH2: "Passage 1: Cooling Tropical Cities Through Urban Design",
    sampleH3: "Cooling Tropical Cities Through Passive Architecture",
  },
  {
    id: "courses",
    label: "Khóa học & Bài học",
    shortLabel: "Khóa học",
    description: "Tên khóa học (H1), tiêu đề bài học / H2 và tiểu mục H3 trong bài giảng.",
    h1Label: "H1 — Tên Khóa học",
    h2Label: "H2 — Tiêu đề Bài học & mục chính",
    h3Label: "H3 — Tiểu mục trong nội dung bài học",
    sampleH1: "Lộ trình IELTS Reading từ 5.5 lên 7.5+ thực chiến",
    sampleH2: "Bài 3: Kỹ thuật Skimming & Scanning không sót từ khóa",
    sampleH3: "Ví dụ phân tích đoạn văn học thuật Cambridge",
  },
  {
    id: "pages",
    label: "Trang tĩnh",
    shortLabel: "Trang tĩnh",
    description: "Tiêu đề trang Giới thiệu (/about), Chính sách & FAQs (/legal/*) và H2/H3 nội dung.",
    h1Label: "H1 — Tiêu đề Trang tĩnh",
    h2Label: "H2 — Tiêu đề mục & Câu hỏi FAQ",
    h3Label: "H3 — Tiểu mục nội dung trang tĩnh",
    sampleH1: "Giới thiệu về nền tảng tự học Ôn IELTS",
    sampleH2: "Sứ mệnh đồng hành cùng người học Việt Nam",
    sampleH3: "Cam kết minh bạch dữ liệu và quyền riêng tư",
  },
];

// =============================================================================
// RESPONSIVE CLAMP() FONT-SIZE SCALES
// Default ("md") values match Ôn IELTS's existing desktop typography while
// scaling down gracefully on mobile phones to prevent overflow or crowding.
// =============================================================================
export const HEADING_CLAMP_SCALES: Record<
  HeadingAreaId,
  {
    h1: Record<HeadingSizePreset, string>;
    h2: Record<HeadingSizePreset, string>;
    h3: Record<HeadingSizePreset, string>;
    /** Compact sticky exam bar H1 for `tests` area */
    examBarH1?: Record<HeadingSizePreset, string>;
  }
> = {
  home: {
    h1: {
      sm: "clamp(1.625rem, 3.4vw, 2.5rem)",
      md: "clamp(1.875rem, 4.5vw, 3rem)", // exact current: 30px -> 48px
      lg: "clamp(2rem, 5vw, 3.375rem)",
      xl: "clamp(2.125rem, 5.5vw, 3.75rem)",
    },
    h2: {
      sm: "clamp(1.2rem, 2.2vw, 1.35rem)",
      md: "clamp(1.375rem, 3vw, 1.5rem)", // exact current: text-2xl (24px)
      lg: "clamp(1.5rem, 3.4vw, 1.875rem)",
      xl: "clamp(1.625rem, 4vw, 2.25rem)",
    },
    h3: {
      sm: "clamp(0.9rem, 1.3vw, 0.95rem)",
      md: "clamp(0.95rem, 1.6vw, 1rem)", // exact current: text-base (16px)
      lg: "clamp(1rem, 1.9vw, 1.15rem)",
      xl: "clamp(1.0625rem, 2.2vw, 1.3rem)",
    },
  },
  blog: {
    h1: {
      sm: "clamp(1.45rem, 3vw, 1.6875rem)",
      md: "clamp(1.625rem, 3.8vw, 1.875rem)", // exact current: text-3xl (30px)
      lg: "clamp(1.75rem, 4.2vw, 2.25rem)",
      xl: "clamp(1.875rem, 4.8vw, 2.625rem)",
    },
    h2: {
      sm: "clamp(1.0625rem, 2vw, 1.125rem)",
      md: "clamp(1.125rem, 2.4vw, 1.25rem)", // exact current: .cms-richtext h2 (1.25rem)
      lg: "clamp(1.25rem, 2.8vw, 1.5rem)",
      xl: "clamp(1.35rem, 3.2vw, 1.75rem)",
    },
    h3: {
      sm: "clamp(0.95rem, 1.6vw, 1rem)",
      md: "clamp(1rem, 1.9vw, 1.075rem)", // exact current: .cms-richtext h3 (1.075rem)
      lg: "clamp(1.075rem, 2.2vw, 1.25rem)",
      xl: "clamp(1.15rem, 2.5vw, 1.4rem)",
    },
  },
  tests: {
    h1: {
      sm: "clamp(1.45rem, 3vw, 1.6875rem)",
      md: "clamp(1.625rem, 3.8vw, 1.875rem)", // exact current: /tests & W/S H1 (30px)
      lg: "clamp(1.75rem, 4.2vw, 2.25rem)",
      xl: "clamp(1.875rem, 4.8vw, 2.5rem)",
    },
    examBarH1: {
      sm: "clamp(0.84rem, 1.3vw, 0.9375rem)",
      md: "clamp(0.875rem, 1.5vw, 1rem)", // exact current: text-sm sm:text-base (14px -> 16px)
      lg: "clamp(0.95rem, 1.8vw, 1.15rem)",
      xl: "clamp(1.025rem, 2.1vw, 1.3rem)",
    },
    h2: {
      sm: "clamp(0.975rem, 1.7vw, 1.05rem)",
      md: "clamp(1.05rem, 2vw, 1.125rem)", // exact current: Part/Section text-lg (18px)
      lg: "clamp(1.125rem, 2.4vw, 1.35rem)",
      xl: "clamp(1.25rem, 2.8vw, 1.55rem)",
    },
    h3: {
      sm: "clamp(1rem, 1.8vw, 1.125rem)",
      md: "clamp(1.125rem, 2.2vw, 1.25rem)", // Reading Passage Title (bold & larger than body)
      lg: "clamp(1.25rem, 2.6vw, 1.5rem)",
      xl: "clamp(1.35rem, 3vw, 1.75rem)",
    },
  },
  courses: {
    h1: {
      sm: "clamp(1.45rem, 3vw, 1.6875rem)",
      md: "clamp(1.625rem, 3.8vw, 1.875rem)", // exact current: text-3xl (30px)
      lg: "clamp(1.75rem, 4.2vw, 2.25rem)",
      xl: "clamp(1.875rem, 4.8vw, 2.625rem)",
    },
    h2: {
      sm: "clamp(1.0625rem, 2vw, 1.125rem)",
      md: "clamp(1.125rem, 2.4vw, 1.25rem)", // exact current: text-xl (20px)
      lg: "clamp(1.25rem, 2.8vw, 1.5rem)",
      xl: "clamp(1.35rem, 3.2vw, 1.75rem)",
    },
    h3: {
      sm: "clamp(0.95rem, 1.6vw, 1rem)",
      md: "clamp(1rem, 1.9vw, 1.075rem)",
      lg: "clamp(1.075rem, 2.2vw, 1.25rem)",
      xl: "clamp(1.15rem, 2.5vw, 1.4rem)",
    },
  },
  pages: {
    h1: {
      sm: "clamp(1.45rem, 3vw, 1.6875rem)",
      md: "clamp(1.625rem, 3.8vw, 1.875rem)", // exact current: text-3xl (30px)
      lg: "clamp(1.75rem, 4.2vw, 2.25rem)",
      xl: "clamp(1.875rem, 4.8vw, 2.625rem)",
    },
    h2: {
      sm: "clamp(1.0625rem, 2vw, 1.125rem)",
      md: "clamp(1.125rem, 2.4vw, 1.25rem)",
      lg: "clamp(1.25rem, 2.8vw, 1.5rem)",
      xl: "clamp(1.35rem, 3.2vw, 1.75rem)",
    },
    h3: {
      sm: "clamp(0.95rem, 1.6vw, 1rem)",
      md: "clamp(1rem, 1.9vw, 1.075rem)",
      lg: "clamp(1.075rem, 2.2vw, 1.25rem)",
      xl: "clamp(1.15rem, 2.5vw, 1.4rem)",
    },
  },
};

export const DEFAULT_AREA_HEADING_TYPOGRAPHY: AreaHeadingTypographyConfig = {
  weight: "bold",
  h1Size: "md",
  h2Size: "md",
  h3Size: "md",
  lineHeight: "normal",
  fontFamily: "inherit",
};

export const DEFAULT_HEADING_TYPOGRAPHY: HeadingTypographyConfig = {
  home: { ...DEFAULT_AREA_HEADING_TYPOGRAPHY },
  blog: { ...DEFAULT_AREA_HEADING_TYPOGRAPHY },
  tests: { ...DEFAULT_AREA_HEADING_TYPOGRAPHY, passageTitleAlign: "left" },
  courses: { ...DEFAULT_AREA_HEADING_TYPOGRAPHY },
  pages: { ...DEFAULT_AREA_HEADING_TYPOGRAPHY },
};

// =============================================================================
// ZOD SCHEMAS
// =============================================================================
const headingFontChoices = [
  "inherit",
  ...APPEARANCE_FONTS.map((f) => f.id),
] as [HeadingFontChoice, ...HeadingFontChoice[]];

export const contentTitleSizeSchema = z
  .enum(["", "lg", "xl"])
  .optional()
  .default("");

export const areaHeadingTypographySchema = z.object({
  weight: z.enum(["medium", "bold", "extrabold"]).default("bold"),
  h1Size: z.enum(["sm", "md", "lg", "xl"]).default("md"),
  h2Size: z.enum(["sm", "md", "lg", "xl"]).default("md"),
  h3Size: z.enum(["sm", "md", "lg", "xl"]).default("md"),
  lineHeight: z.enum(["tight", "normal", "relaxed"]).default("normal"),
  fontFamily: z.enum(headingFontChoices).default("inherit"),
  passageTitleAlign: z.enum(["left", "center"]).optional(),
});

export const headingTypographySchema = z
  .object({
    home: areaHeadingTypographySchema.default({ ...DEFAULT_HEADING_TYPOGRAPHY.home }),
    blog: areaHeadingTypographySchema.default({ ...DEFAULT_HEADING_TYPOGRAPHY.blog }),
    tests: areaHeadingTypographySchema.default({ ...DEFAULT_HEADING_TYPOGRAPHY.tests }),
    courses: areaHeadingTypographySchema.default({ ...DEFAULT_HEADING_TYPOGRAPHY.courses }),
    pages: areaHeadingTypographySchema.default({ ...DEFAULT_HEADING_TYPOGRAPHY.pages }),
  })
  .optional()
  .default(DEFAULT_HEADING_TYPOGRAPHY);

// =============================================================================
// MERGE, PARITY & CSS VARIABLE BUILDERS
// =============================================================================
export function mergeHeadingTypographyWithDefaults(
  partial?: Partial<Record<HeadingAreaId, Partial<AreaHeadingTypographyConfig>>> | null
): HeadingTypographyConfig {
  const out = structuredClone(DEFAULT_HEADING_TYPOGRAPHY);
  if (!partial || typeof partial !== "object") return out;

  for (const areaId of HEADING_AREA_IDS) {
    const src = partial[areaId];
    if (!src || typeof src !== "object") continue;
    out[areaId] = {
      ...out[areaId],
      ...src,
      ...(areaId === "tests"
        ? {
            passageTitleAlign:
              src.passageTitleAlign === "center" ? "center" : "left",
          }
        : {}),
    };
  }
  return out;
}

export function isAreaHeadingDefault(
  areaId: HeadingAreaId,
  area: AreaHeadingTypographyConfig
): boolean {
  const def = DEFAULT_HEADING_TYPOGRAPHY[areaId];
  return (
    area.weight === def.weight &&
    area.h1Size === def.h1Size &&
    area.h2Size === def.h2Size &&
    area.h3Size === def.h3Size &&
    area.lineHeight === def.lineHeight &&
    area.fontFamily === def.fontFamily &&
    (areaId !== "tests" || (area.passageTitleAlign ?? "left") === "left")
  );
}

export function isHeadingTypographyDefault(
  config: HeadingTypographyConfig | undefined
): boolean {
  if (!config) return true;
  return HEADING_AREA_IDS.every((id) => isAreaHeadingDefault(id, config[id]));
}

export function resolveHeadingFontCss(choice: HeadingFontChoice): string {
  if (choice === "inherit") return "var(--cms-font-sans)";
  const found = APPEARANCE_FONTS.find((f) => f.id === choice);
  return found ? found.cssFamily : "var(--cms-font-sans)";
}

export function resolveHeadingWeightCss(weight: HeadingWeightPreset): string {
  return (
    HEADING_WEIGHT_OPTIONS.find((w) => w.id === weight)?.cssValue ?? "700"
  );
}

export function resolveHeadingLineHeightCss(
  lh: HeadingLineHeightPreset,
  areaId?: HeadingAreaId,
  level?: "h1" | "h2" | "h3"
): string {
  if (areaId === "home" && level === "h1") {
    if (lh === "tight") return "1.08";
    if (lh === "relaxed") return "1.28";
    return "1.15"; // preserves existing hero leading-[1.12]..1.15
  }
  if (level === "h1") {
    if (lh === "tight") return "1.15";
    if (lh === "relaxed") return "1.38";
    return "1.25"; // preserves existing leading-tight on H1
  }
  if (lh === "tight") return "1.2";
  if (lh === "relaxed") return "1.5";
  return "1.35";
}

/**
 * Returns a single deduplicated Google Fonts v2 stylesheet href covering the global
 * theme font plus any area-specific heading fonts (returns null if only Be Vietnam Pro).
 */
export function buildCombinedGoogleFontsHref(
  themeFont: AppearanceFontId,
  headings?: HeadingTypographyConfig
): string | null {
  const queries: string[] = [];
  const seen = new Set<string>();

  const addFont = (id: HeadingFontChoice | undefined) => {
    if (!id || id === "inherit") return;
    const found = APPEARANCE_FONTS.find((f) => f.id === id);
    if (!found || !found.googleQuery || seen.has(found.googleQuery)) return;
    seen.add(found.googleQuery);
    queries.push(`family=${found.googleQuery}`);
  };

  addFont(themeFont);
  if (headings) {
    for (const areaId of HEADING_AREA_IDS) {
      addFont(headings[areaId]?.fontFamily);
    }
  }

  if (queries.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${queries.join("&")}&display=swap`;
}

/**
 * Generates CSS custom properties for all 5 heading typography areas using responsive
 * `clamp()` values so phones never overflow while desktop reflects Admin settings cleanly.
 */
export function buildHeadingTypographyCssVariables(
  headings?: HeadingTypographyConfig
): string {
  const cfg = mergeHeadingTypographyWithDefaults(headings);
  const lines: string[] = [`:root {`];

  for (const areaId of HEADING_AREA_IDS) {
    const area = cfg[areaId];
    const scales = HEADING_CLAMP_SCALES[areaId];
    lines.push(`  --ht-${areaId}-font: ${resolveHeadingFontCss(area.fontFamily)};`);
    lines.push(`  --ht-${areaId}-weight: ${resolveHeadingWeightCss(area.weight)};`);
    lines.push(
      `  --ht-${areaId}-h1-lh: ${resolveHeadingLineHeightCss(area.lineHeight, areaId, "h1")};`
    );
    lines.push(
      `  --ht-${areaId}-lh: ${resolveHeadingLineHeightCss(area.lineHeight, areaId, "h2")};`
    );
    lines.push(`  --ht-${areaId}-h1: ${scales.h1[area.h1Size]};`);
    lines.push(`  --ht-${areaId}-h1-lg: ${scales.h1.lg};`);
    lines.push(`  --ht-${areaId}-h1-xl: ${scales.h1.xl};`);
    lines.push(`  --ht-${areaId}-h2: ${scales.h2[area.h2Size]};`);
    lines.push(`  --ht-${areaId}-h2-lg: ${scales.h2.lg};`);
    lines.push(`  --ht-${areaId}-h2-xl: ${scales.h2.xl};`);
    lines.push(`  --ht-${areaId}-h3: ${scales.h3[area.h3Size]};`);

    if (areaId === "tests" && scales.examBarH1) {
      lines.push(`  --ht-tests-exam-h1: ${scales.examBarH1[area.h1Size]};`);
      lines.push(
        `  --ht-tests-passage-title-align: ${area.passageTitleAlign === "center" ? "center" : "left"};`
      );
    }
  }

  lines.push(`}`);
  return lines.join("\n");
}

// =============================================================================
// WCAG 2.1 CONTRAST & DARK-MODE CHECKER
// =============================================================================
const HEX_6_RE = /^#[0-9A-Fa-f]{6}$/;

function hexToRelativeLuminance(hex: string): number {
  const clean = HEX_6_RE.test(hex) ? hex : "#ffffff";
  const channels = [
    parseInt(clean.slice(1, 3), 16) / 255,
    parseInt(clean.slice(3, 5), 16) / 255,
    parseInt(clean.slice(5, 7), 16) / 255,
  ].map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function computeContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = hexToRelativeLuminance(fgHex);
  const l2 = hexToRelativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export interface HeadingContrastCheck {
  mode: "light" | "dark";
  label: string;
  fgHex: string;
  bgHex: string;
  ratio: number;
  passesAA: boolean;
  passesAALarge: boolean;
  passesAAA: boolean;
}

export function evaluateHeadingContrast(theme: {
  backgroundLight: string;
  backgroundDark: string;
}): {
  checks: HeadingContrastCheck[];
  allPassAA: boolean;
} {
  const lightBg = HEX_6_RE.test(theme.backgroundLight)
    ? theme.backgroundLight
    : "#f8fafc";
  const darkBg = HEX_6_RE.test(theme.backgroundDark)
    ? theme.backgroundDark
    : "#0b1120";

  const pairs: Array<{
    mode: "light" | "dark";
    label: string;
    fgHex: string;
    bgHex: string;
  }> = [
    {
      mode: "light",
      label: "Chế độ Sáng (chữ tiêu đề trên nền trang)",
      fgHex: "#0f172a",
      bgHex: lightBg,
    },
    {
      mode: "light",
      label: "Chế độ Sáng (chữ tiêu đề trên thẻ nội dung)",
      fgHex: "#0f172a",
      bgHex: "#ffffff",
    },
    {
      mode: "dark",
      label: "Chế độ Tối (chữ tiêu đề trên nền trang)",
      fgHex: "#f8fafc",
      bgHex: darkBg,
    },
    {
      mode: "dark",
      label: "Chế độ Tối (chữ tiêu đề trên thẻ nội dung)",
      fgHex: "#f8fafc",
      bgHex: "#111827",
    },
  ];

  const checks: HeadingContrastCheck[] = pairs.map((p) => {
    const ratio = computeContrastRatio(p.fgHex, p.bgHex);
    return {
      ...p,
      ratio,
      passesAALarge: ratio >= 3.0,
      passesAA: ratio >= 4.5,
      passesAAA: ratio >= 7.0,
    };
  });

  return {
    checks,
    allPassAA: checks.every((c) => c.passesAA),
  };
}

// =============================================================================
// CONTENT HEADING STRUCTURE AUDITOR (SEO & ACCESSIBILITY PUBLISH WARNINGS)
// =============================================================================
export interface HeadingSkipIssue {
  from: number;
  to: number;
  headingText: string;
}

export interface HeadingAuditReport {
  hasWarnings: boolean;
  hasH1InBody: boolean;
  h1Count: number;
  h1Texts: string[];
  skippedLevels: HeadingSkipIssue[];
  warnings: string[];
  headingsFound: Array<{ level: number; text: string }>;
}

/**
 * Inspects rich-text HTML body content for SEO & Accessibility heading issues:
 * 1. Any `<h1>` inside body content (each page must have only ONE H1 — the page title).
 * 2. Skipped heading hierarchy levels (e.g. page H1 -> H3/H4, or H2 -> H4).
 *
 * For Reading Passages (`allowPassageStartAtH3 = true`), starting directly at H3
 * (e.g. `<h3 class="reading-passage-title">`) is valid because the exam UI already
 * renders H1 (Test Title) and H2 (Part/Section Title) above the passage.
 */
export function auditHeadingStructure(
  html: string,
  options?: { allowPassageStartAtH3?: boolean }
): HeadingAuditReport {
  const headingsFound: Array<{ level: number; text: string }> = [];
  if (!html || typeof html !== "string") {
    return {
      hasWarnings: false,
      hasH1InBody: false,
      h1Count: 0,
      h1Texts: [],
      skippedLevels: [],
      warnings: [],
      headingsFound,
    };
  }

  const regex = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const level = Number.parseInt(match[1], 10);
    const text = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    headingsFound.push({ level, text: text || `H${level}` });
  }

  const h1Texts = headingsFound.filter((h) => h.level === 1).map((h) => h.text);
  const h1Count = h1Texts.length;
  const hasH1InBody = h1Count > 0;

  const skippedLevels: HeadingSkipIssue[] = [];
  // The outer page renders H1 (and in Reading passages, also H2 for Part/Section)
  let prevLevel = options?.allowPassageStartAtH3 ? 2 : 1;

  for (const h of headingsFound) {
    if (h.level > prevLevel + 1) {
      skippedLevels.push({
        from: prevLevel,
        to: h.level,
        headingText: h.text.slice(0, 60),
      });
    }
    prevLevel = h.level;
  }

  const warnings: string[] = [];
  if (hasH1InBody) {
    warnings.push(
      `Nội dung đang chứa ${h1Count} thẻ H1. Mỗi trang chỉ nên có duy nhất một H1 là tiêu đề trang — hãy đổi sang H2/H3 để tránh ảnh hưởng SEO và khả năng truy cập (Accessibility).`
    );
  }
  for (const skip of skippedLevels) {
    warnings.push(
      `Nhảy cấp tiêu đề từ H${skip.from} xuống H${skip.to} ("${skip.headingText}"). Hãy dùng thứ tự tuần tự (H2 → H3 → H4) để tối ưu SEO và trình đọc màn hình.`
    );
  }

  return {
    hasWarnings: warnings.length > 0,
    hasH1InBody,
    h1Count,
    h1Texts,
    skippedLevels,
    warnings,
    headingsFound,
  };
}

/**
 * Convenience fix helper: converts any accidental `<h1>...</h1>` tags in body HTML into `<h2>...</h2>`.
 */
export function convertBodyH1ToH2(html: string): string {
  if (!html) return html;
  return html
    .replace(/<h1(\b[^>]*)>/gi, "<h2$1>")
    .replace(/<\/h1>/gi, "</h2>");
}
