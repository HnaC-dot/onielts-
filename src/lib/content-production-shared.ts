import { z } from "zod";
import { extractPlainText } from "./sanitize";
import { slugifyVi } from "./seo";
import {
  cmsTestFormSchema,
  OPTION_TYPES_SET,
  parseAcceptedAnswersInput,
  QUESTION_TYPE_CATALOG,
  validateTestForPublish,
  type CmsTestFormInput,
} from "./test-cms-shared";
import type { QuestionType, SeoMeta } from "./types";

// =============================================================================
// 1. EDITORIAL CONTENT CALENDAR
// =============================================================================

export type ContentItemType = "blog" | "test" | "video";

export type ContentWorkflowStatus =
  | "idea"
  | "writing"
  | "review"
  | "scheduled"
  | "published";

export const CONTENT_WORKFLOW_STEPS: ReadonlyArray<{
  value: ContentWorkflowStatus;
  labelVi: string;
  badgeClass: string;
  dotClass: string;
}> = [
  {
    value: "idea",
    labelVi: "Ý tưởng",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
  {
    value: "writing",
    labelVi: "Đang viết",
    badgeClass:
      "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    dotClass: "bg-sky-500",
  },
  {
    value: "review",
    labelVi: "Chờ duyệt",
    badgeClass:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dotClass: "bg-amber-500",
  },
  {
    value: "scheduled",
    labelVi: "Đã lên lịch",
    badgeClass:
      "bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
    dotClass: "bg-violet-500",
  },
  {
    value: "published",
    labelVi: "Đã đăng",
    badgeClass:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
  },
];

export const CONTENT_TYPE_META: Record<
  ContentItemType,
  { labelVi: string; shortVi: string; badgeClass: string }
> = {
  blog: {
    labelVi: "Bài Blog",
    shortVi: "Blog",
    badgeClass:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  test: {
    labelVi: "Đề thi IELTS",
    shortVi: "Đề thi",
    badgeClass:
      "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  },
  video: {
    labelVi: "Video học IELTS",
    shortVi: "Video",
    badgeClass:
      "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
};

export interface ContentCalendarItem {
  id: string;
  title: string;
  content_type: ContentItemType;
  workflow_status: ContentWorkflowStatus;
  assignee_name: string;
  planned_date: string; // YYYY-MM-DD
  linked_href?: string | null;
  notes?: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export const contentCalendarItemSchema = z.object({
  id: z.string().trim().max(80).optional(),
  title: z
    .string()
    .trim()
    .min(3, "Tiêu đề kế hoạch cần ít nhất 3 ký tự.")
    .max(200, "Tiêu đề tối đa 200 ký tự."),
  content_type: z.enum(["blog", "test", "video"]),
  workflow_status: z
    .enum(["idea", "writing", "review", "scheduled", "published"])
    .default("idea"),
  assignee_name: z.string().trim().max(100).default(""),
  planned_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày dự kiến phải có định dạng YYYY-MM-DD."),
  linked_href: z
    .string()
    .trim()
    .max(400)
    .optional()
    .nullable()
    .refine(
      (v) => !v || v.startsWith("/") || /^https?:\/\//i.test(v),
      "Đường dẫn liên kết phải bắt đầu bằng / hoặc https://"
    ),
  notes: z.string().trim().max(1500).optional().default(""),
});

export type ContentCalendarItemInput = z.infer<typeof contentCalendarItemSchema>;

export function getNextWorkflowStatus(
  current: ContentWorkflowStatus
): ContentWorkflowStatus | null {
  const idx = CONTENT_WORKFLOW_STEPS.findIndex((s) => s.value === current);
  if (idx < 0 || idx >= CONTENT_WORKFLOW_STEPS.length - 1) return null;
  return CONTENT_WORKFLOW_STEPS[idx + 1].value;
}

// =============================================================================
// 2. BLOG TEMPLATES (4 STRUCTURED TEMPLATES WITH FAQ + PRACTICE BOX)
// =============================================================================

export interface BlogArticleTemplate {
  id:
    | "question_type_tips"
    | "band_roadmap"
    | "topic_vocabulary"
    | "common_mistakes";
  nameVi: string;
  shortDescVi: string;
  defaultCategory: string;
  defaultTags: string[];
  suggestedTitle: string;
  suggestedExcerpt: string;
  suggestedPrimaryKeyword: string;
  contentHtml: string;
}

export const BLOG_TEMPLATES: ReadonlyArray<BlogArticleTemplate> = [
  {
    id: "question_type_tips",
    nameVi: "Mẹo từng dạng câu hỏi",
    shortDescVi:
      "Khung hướng dẫn chiến thuật từng bước, ví dụ phân tích bẫy, FAQ và box bài tập luyện thêm.",
    defaultCategory: "Reading",
    defaultTags: ["ielts reading", "chien thuat", "meo lam bai"],
    suggestedTitle:
      "Chiến thuật làm dạng [Tên dạng câu hỏi] IELTS đạt 8.0+ không mắc bẫy",
    suggestedExcerpt:
      "Hướng dẫn từng bước nhận diện từ khóa, phân biệt bẫy paraphrase và áp dụng quy trình 4 bước chinh phục dạng [Tên dạng câu hỏi] trong phòng thi IELTS.",
    suggestedPrimaryKeyword: "cách làm dạng câu hỏi ielts",
    contentHtml: `<p>Trong kỳ thi IELTS, dạng bài <strong>[Tên dạng câu hỏi]</strong> thường khiến nhiều thí sinh mất điểm đáng tiếc vì nhầm lẫn giữa thông tin suy diễn và thông tin được nêu trực tiếp trong bài. Bài viết này tổng hợp quy trình làm bài chuẩn xác giúp bạn tối ưu tốc độ và độ chính xác.</p>

<h2>1. Đặc điểm nhận diện dạng câu hỏi [Tên dạng]</h2>
<p>Trình bày ngắn gọn yêu cầu đề bài, tỷ trọng xuất hiện trong đề thi thật và kỹ năng đọc/nghe cốt lõi cần vận dụng (skimming, scanning, nhận diện paraphrase).</p>

<h2>2. Quy trình 4 bước làm bài chuẩn Band 8.0+</h2>
<h3>Bước 1: Đọc câu hỏi &amp; gạch chân từ khóa định vị</h3>
<p>Ưu tiên danh từ riêng, mốc thời gian, con số và các từ mang sắc thái phủ định hoặc tuyệt đối (<em>only, always, rarely, solely</em>).</p>
<h3>Bước 2: Định vị đoạn văn chứa thông tin (Scanning)</h3>
<p>Tìm cụm từ đồng nghĩa hoặc cách diễn đạt lại (paraphrase) thay vì chỉ tìm đúng nguyên văn từ trong câu hỏi.</p>
<h3>Bước 3: Đối chiếu nghĩa từng vế câu</h3>
<p>Kiểm tra chủ ngữ, động từ chính và mức độ khẳng định để loại trừ đáp án gây nhiễu.</p>
<h3>Bước 4: Kiểm tra lại giới hạn từ &amp; chính tả</h3>
<p>Đảm bảo đúng quy định số từ (<em>NO MORE THAN TWO WORDS</em>) và ngữ pháp khi điền vào chỗ trống.</p>

<h2>3. Ví dụ phân tích đề thi thật &amp; cách né bẫy</h2>
<blockquote><strong>Ví dụ minh họa:</strong> Chèn đoạn trích ngắn + câu hỏi mẫu + giải thích vì sao đáp án đúng và vì sao các lựa chọn khác là bẫy.</blockquote>

<h2>4. Câu hỏi thường gặp (FAQ)</h2>
<h3>Câu hỏi 1: Nên làm dạng bài này trước hay sau trong bài thi?</h3>
<p>Nên hoàn thành các dạng đi theo thứ tự bài đọc (như True/False/Not Given, Gap-fill) trước để nắm mạch nội dung rồi mới xử lý dạng Matching.</p>
<h3>Câu hỏi 2: Mất bao nhiêu phút cho một nhóm 5–6 câu dạng này?</h3>
<p>Thời lượng mục tiêu lý tưởng là 6–8 phút (trung bình khoảng 1,2 phút/câu), tránh sa đà quá 2 phút cho một câu khó.</p>

<div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 my-5">
  <h3>Bài tập luyện thêm trên Ôn IELTS</h3>
  <p>Áp dụng ngay chiến thuật vừa học vào các bài luyện tập tương tác dưới đây:</p>
  <ul>
    <li><a href="/tests?skill=reading">Kho đề thi IELTS Reading chuẩn giao diện máy tính (có giải thích chi tiết)</a></li>
    <li><a href="/daily-exam">Thử sức Đề thi mỗi ngày 15 phút để rèn phản xạ tốc độ</a></li>
    <li><a href="/tools/complex-sentence-explainer">Dùng công cụ Phân tích câu phức AI khi gặp đoạn đọc khó</a></li>
  </ul>
</div>`,
  },
  {
    id: "band_roadmap",
    nameVi: "Lộ trình theo band",
    shortDescVi:
      "Khung lộ trình chia giai đoạn rõ ràng, thời khóa biểu theo tuần, tài liệu, FAQ và box bài tập luyện thêm.",
    defaultCategory: "Chiến thuật IELTS",
    defaultTags: ["lo trinh ielts", "tu hoc ielts", "tang band"],
    suggestedTitle:
      "Lộ trình tự học IELTS từ [Band A] lên [Band B] chi tiết từng tuần",
    suggestedExcerpt:
      "Kế hoạch tự học IELTS thực tế theo từng giai đoạn từ [Band A] lên [Band B], kèm phân bổ thời gian 4 kỹ năng và mốc tự kiểm tra định kỳ.",
    suggestedPrimaryKeyword: "lộ trình học ielts",
    contentHtml: `<p>Để nâng điểm IELTS bền vững từ <strong>[Band A]</strong> lên <strong>[Band B]</strong>, bạn cần một lộ trình rõ ràng thay vì luyện đề dàn trải. Dưới đây là kế hoạch tự học chi tiết chia theo từng chặng để bạn đo lường tiến bộ mỗi tuần.</p>

<h2>1. Xác định trình độ đầu vào &amp; mục tiêu điểm từng kỹ năng</h2>
<p>Trước khi bắt đầu, hãy làm một bài kiểm tra đầy đủ và ghi lại mức điểm hiện tại cho từng kỹ năng Nghe – Nói – Đọc – Viết để xác định kỹ năng cần ưu tiên kéo điểm.</p>

<h2>2. Giai đoạn 1 (Tuần 1–4): Củng cố nền tảng &amp; lấp lỗ hổng</h2>
<h3>Listening &amp; Reading</h3>
<p>Tập trung phát âm chuẩn IPA, nghe chép chính tả 15 phút/ngày và luyện đọc hiểu phân tích cấu trúc câu.</p>
<h3>Writing &amp; Speaking</h3>
<p>Nắm vững bố cục đoạn văn chuẩn học thuật và luyện phản xạ trả lời Part 1 tự nhiên, rõ ý.</p>

<h2>3. Giai đoạn 2 (Tuần 5–8): Luyện chuyên sâu từng dạng bài</h2>
<p>Chuyển sang luyện theo từng dạng câu hỏi cụ thể, ghi sổ lỗi sai sau mỗi lần làm bài và nâng cấp từ vựng học thuật theo chủ đề.</p>

<h2>4. Giai đoạn 3 (Tuần 9–12): Luyện full test bấm giờ &amp; tối ưu điểm số</h2>
<p>Mỗi tuần hoàn thành ít nhất 2 đề full test đúng thời gian phòng thi, chấm chữa kỹ bài Writing/Speaking và rà lại những dạng câu có tỷ lệ sai cao nhất.</p>

<h2>5. Câu hỏi thường gặp (FAQ)</h2>
<h3>Mỗi ngày cần học tối thiểu bao nhiêu giờ để theo kịp lộ trình?</h3>
<p>Khung tối ưu là 1,5–2 giờ tập trung mỗi ngày (duy trì đều 6 ngày/tuần), ưu tiên chất lượng phân tích lỗi sai thay vì chỉ cày số lượng đề.</p>
<h3>Nên thi thử lại sau bao lâu để kiểm tra tiến bộ?</h3>
<p>Hãy làm bài đánh giá định kỳ sau mỗi 2–3 tuần và theo dõi biểu đồ xu hướng điểm trên trang Tiến độ học tập.</p>

<div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 my-5">
  <h3>Bài tập luyện thêm trên Ôn IELTS</h3>
  <p>Bắt đầu thực hành ngay chặng đầu tiên trong lộ trình của bạn:</p>
  <ul>
    <li><a href="/band-calculator">Tính điểm Band IELTS hiện tại &amp; đặt mục tiêu kỹ năng</a></li>
    <li><a href="/courses">Khám phá Khóa học IELTS có bài giảng và quiz kiểm tra từng bài</a></li>
    <li><a href="/tests">Làm đề thi thử IELTS Reading &amp; Listening chuẩn máy tính</a></li>
    <li><a href="/progress">Theo dõi biểu đồ điểm và phân tích dạng câu yếu tại trang Tiến độ</a></li>
  </ul>
</div>`,
  },
  {
    id: "topic_vocabulary",
    nameVi: "Từ vựng theo chủ đề",
    shortDescVi:
      "Bảng từ vựng Band 7.0–8.0 kèm collocations, câu ví dụ Writing/Speaking, FAQ và box bài tập luyện thêm.",
    defaultCategory: "Từ vựng",
    defaultTags: ["tu vung ielts", "collocations", "writing speaking"],
    suggestedTitle:
      "Trọn bộ từ vựng & Collocations IELTS chủ đề [Tên chủ đề] (Band 7.5+)",
    suggestedExcerpt:
      "Tổng hợp từ vựng ăn điểm, collocations tự nhiên và ví dụ ứng dụng trực tiếp vào IELTS Writing Task 2 và Speaking chủ đề [Tên chủ đề].",
    suggestedPrimaryKeyword: "từ vựng ielts chủ đề",
    contentHtml: `<p>Chủ đề <strong>[Tên chủ đề]</strong> xuất hiện với tần suất rất cao trong cả IELTS Reading, Listening, Writing Task 2 lẫn Speaking Part 3. Ghi nhớ theo cụm <em>collocations</em> và ngữ cảnh câu giúp bạn dùng từ tự nhiên và đạt tiêu chí Lexical Resource Band 7.5+.</p>

<h2>1. Nhóm từ vựng cốt lõi chủ đề [Tên chủ đề]</h2>
<ul>
  <li><strong>[Từ vựng 1]</strong> (/phiên âm/, loại từ): Nghĩa tiếng Việt — <em>Ví dụ: Chèn câu ví dụ chuẩn IELTS.</em></li>
  <li><strong>[Từ vựng 2]</strong> (/phiên âm/, loại từ): Nghĩa tiếng Việt — <em>Ví dụ: Chèn câu ví dụ chuẩn IELTS.</em></li>
  <li><strong>[Từ vựng 3]</strong> (/phiên âm/, loại từ): Nghĩa tiếng Việt — <em>Ví dụ: Chèn câu ví dụ chuẩn IELTS.</em></li>
</ul>

<h2>2. Collocations &amp; cụm từ nâng Band Writing Task 2</h2>
<h3>Cụm diễn đạt nguyên nhân &amp; tác động</h3>
<p>Liệt kê 4–5 collocations học thuật kèm cách nâng cấp từ câu Band 5.5 lên Band 7.5+.</p>
<h3>Cụm diễn đạt giải pháp &amp; quan điểm</h3>
<p>Liệt kê các cụm tự nhiên dùng trong đoạn thân bài và kết luận.</p>

<h2>3. Ứng dụng mẫu vào IELTS Speaking Part 2 &amp; Part 3</h2>
<blockquote><strong>Câu trả lời mẫu:</strong> Viết đoạn trả lời 4–5 câu có bôi đậm các collocations vừa học để người đọc thấy rõ cách dùng thực tế.</blockquote>

<h2>4. Câu hỏi thường gặp (FAQ)</h2>
<h3>Học bao nhiêu từ mới mỗi ngày là hiệu quả nhất?</h3>
<p>Chỉ nên học sâu 8–12 từ/cụm từ mỗi ngày kèm phát âm, đặt câu riêng và ôn lặp lại ngắt quãng (Spaced Repetition) sau 1 – 3 – 7 ngày.</p>
<h3>Làm sao tránh lỗi dùng từ "đao to búa lớn" nhưng sai ngữ cảnh?</h3>
<p>Luôn học từ đi kèm cả cụm động từ/giới từ (collocation) và kiểm tra lại câu viết bằng công cụ chấm ngữ pháp &amp; từ vựng AI.</p>

<div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 my-5">
  <h3>Bài tập luyện thêm trên Ôn IELTS</h3>
  <p>Ghi nhớ sâu và ứng dụng ngay bộ từ vựng chủ đề này:</p>
  <ul>
    <li><a href="/flashcards">Ôn tập Flashcards theo thuật toán lặp lại ngắt quãng (SRS)</a></li>
    <li><a href="/writing/exercises">Luyện Bài tập nâng cấp câu viết từ Band 5.5 lên 8.0</a></li>
    <li><a href="/tools/paraphraser">Dùng Paraphraser AI để mở rộng cách diễn đạt đồng nghĩa</a></li>
    <li><a href="/conversations">Thực hành giao tiếp chủ đề này trong Hội thoại AI</a></li>
  </ul>
</div>`,
  },
  {
    id: "common_mistakes",
    nameVi: "Lỗi thường gặp",
    shortDescVi:
      "Phân tích các lỗi khiến mất điểm oan, bảng So sánh Sai → Đúng, checklist tự kiểm tra, FAQ và bài tập luyện thêm.",
    defaultCategory: "Tips",
    defaultTags: ["loi thuong gap ielts", "meo thi ielts", "tranh mat diem"],
    suggestedTitle:
      "7 Lỗi thường gặp trong IELTS [Kỹ năng] khiến bạn kẹt mãi ở Band 6.0 & cách sửa",
    suggestedExcerpt:
      "Điểm mặt những lỗi kinh điển khiến thí sinh Việt Nam mất điểm oan trong phòng thi IELTS [Kỹ năng] kèm ví dụ sửa trực tiếp và checklist tránh lặp lại.",
    suggestedPrimaryKeyword: "lỗi thường gặp ielts",
    contentHtml: `<p>Rất nhiều thí sinh đã nắm chắc kiến thức nhưng vẫn bị chững điểm ở Band 5.5–6.0 vì lặp đi lặp lại các lỗi kỹ thuật nhỏ trong phòng thi. Hãy kiểm tra xem bạn có đang mắc những lỗi phổ biến dưới đây không.</p>

<h2>1. Lỗi #1: [Tên lỗi phổ biến thứ nhất]</h2>
<p><strong>Vì sao mất điểm:</strong> Giải thích cách giám khảo hoặc hệ thống chấm trừ điểm ở tiêu chí nào.</p>
<p><strong>Cách sửa nhanh:</strong> Đưa ra ví dụ <em>Sai → Đúng</em> cụ thể để người học đối chiếu ngay.</p>

<h2>2. Lỗi #2: [Tên lỗi phổ biến thứ hai]</h2>
<p><strong>Vì sao mất điểm:</strong> Phân tích thói quen dịch word-by-word từ tiếng Việt hoặc đọc lướt bỏ sót từ khóa phủ định.</p>
<p><strong>Cách sửa nhanh:</strong> Nêu quy tắc kiểm tra lại trong 30 giây cuối bài.</p>

<h2>3. Lỗi #3: [Tên lỗi phổ biến thứ ba]</h2>
<p>Phân tích thêm lỗi quản lý thời gian, thiếu dẫn chứng cụ thể hoặc phát âm thiếu âm cuối (ending sounds).</p>

<h2>4. Checklist 3 phút tự rà lỗi trước khi nộp bài</h2>
<ul>
  <li>Kiểm tra chính tả số ít / số nhiều, thì động từ và giới hạn số từ.</li>
  <li>Rà lại những câu đánh dấu cờ (flag) còn phân vân.</li>
  <li>Đảm bảo không bỏ trống bất kỳ ô đáp án nào.</li>
</ul>

<h2>5. Câu hỏi thường gặp (FAQ)</h2>
<h3>Làm sao để biết mình đang hay mắc lỗi nào nhất?</h3>
<p>Sau mỗi lần làm đề, hãy xem thống kê tỷ lệ đúng theo từng dạng câu hỏi và lưu lại các câu sai vào sổ lỗi để ôn lại sau 48 giờ.</p>
<h3>Mất bao lâu để khắc phục thói quen mắc lỗi sai cũ?</h3>
<p>Nếu luyện tập có chủ đích và tự kiểm tra bằng checklist sau mỗi bài, đa số học viên giảm trên 60% lỗi lặp lại chỉ sau 2–3 tuần.</p>

<div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 my-5">
  <h3>Bài tập luyện thêm trên Ôn IELTS</h3>
  <p>Kiểm tra và khắc phục lỗi sai ngay bằng các công cụ trên Ôn IELTS:</p>
  <ul>
    <li><a href="/writing">Chấm bài IELTS Writing AI chi tiết 4 tiêu chí &amp; chỉ rõ lỗi sai</a></li>
    <li><a href="/tools/grammar-checker">Kiểm tra lỗi ngữ pháp tức thì với Grammar Checker AI</a></li>
    <li><a href="/pronunciation">Sửa lỗi phát âm người Việt hay gặp qua bảng phiên âm IPA</a></li>
    <li><a href="/tests">Luyện đề thi thử IELTS có phân tích đáp án &amp; giải thích song ngữ</a></li>
  </ul>
</div>`,
  },
];

// =============================================================================
// 3. INTERNAL LINK EXTRACTION & AUTO-SUGGESTION ENGINE
// =============================================================================

export interface InternalLinkCandidate {
  id: string;
  kind: "test" | "course" | "tool";
  title: string;
  href: string;
  subtitle: string;
  keywords: string[];
}

export interface InternalLinkSuggestion extends InternalLinkCandidate {
  score: number;
  alreadyLinked: boolean;
}

function normalizeMatchText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9/\-\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractInternalLinks(
  html: string,
  siteHosts: string[] = ["onielts.vn", "onielts.com", "localhost"]
): string[] {
  if (!html) return [];
  const found = new Set<string>();
  const hrefRe = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const raw = (m[1] || m[2] || m[3] || "").trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
      continue;
    }
    if (raw.startsWith("/") && !raw.startsWith("//")) {
      found.add(raw.split("#")[0]);
      continue;
    }
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();
      if (
        siteHosts.some(
          (allowed) =>
            allowed &&
            (host === allowed.toLowerCase() ||
              host.endsWith(`.${allowed.toLowerCase()}`))
        )
      ) {
        found.add((parsed.pathname + parsed.search).split("#")[0] || "/");
      }
    } catch {
      // ignore invalid URLs
    }
  }
  return Array.from(found);
}

export function rankInternalLinkSuggestions(
  context: {
    title: string;
    category: string;
    tags: string[];
    primaryKeyword?: string;
    contentHtml: string;
  },
  catalog: InternalLinkCandidate[],
  limit = 9
): InternalLinkSuggestion[] {
  const existingLinks = new Set(
    extractInternalLinks(context.contentHtml).map((href) =>
      href.toLowerCase().replace(/\/$/, "")
    )
  );
  const haystack = normalizeMatchText(
    `${context.title} ${context.category} ${context.tags.join(" ")} ${context.primaryKeyword ?? ""} ${extractPlainText(context.contentHtml).slice(0, 1800)}`
  );
  const tokens = new Set(haystack.split(" ").filter((t) => t.length >= 2));
  const catNorm = normalizeMatchText(context.category);

  const scored: InternalLinkSuggestion[] = catalog.map((item) => {
    const normalizedHref = item.href.toLowerCase().replace(/\/$/, "");
    const alreadyLinked = existingLinks.has(normalizedHref);
    let score = 0;

    for (const kw of item.keywords) {
      const kwNorm = normalizeMatchText(kw);
      if (!kwNorm) continue;
      if (catNorm && (kwNorm.includes(catNorm) || catNorm.includes(kwNorm))) {
        score += 5;
      }
      if (haystack.includes(kwNorm)) {
        score += kwNorm.includes(" ") ? 4 : 2;
      } else {
        const kwTokens = kwNorm.split(" ").filter((w) => w.length >= 3);
        for (const t of kwTokens) {
          if (tokens.has(t)) score += 1;
        }
      }
    }

    const titleNorm = normalizeMatchText(item.title);
    for (const w of titleNorm.split(" ")) {
      if (w.length >= 4 && tokens.has(w)) score += 1.5;
    }

    if (tokens.size < 5) {
      score += 1;
    }

    return {
      ...item,
      score,
      alreadyLinked,
    };
  });

  const unlinked = scored
    .filter((s) => !s.alreadyLinked)
    .sort((a, b) => b.score - a.score);
  const linked = scored
    .filter((s) => s.alreadyLinked)
    .sort((a, b) => b.score - a.score);

  const picked: InternalLinkSuggestion[] = [];
  const usedIds = new Set<string>();

  for (const kind of ["test", "course", "tool"] as const) {
    const topForKind = unlinked.filter((s) => s.kind === kind).slice(0, 2);
    for (const item of topForKind) {
      if (!usedIds.has(item.id)) {
        usedIds.add(item.id);
        picked.push(item);
      }
    }
  }

  for (const item of [...unlinked, ...linked]) {
    if (picked.length >= limit) break;
    if (!usedIds.has(item.id)) {
      usedIds.add(item.id);
      picked.push(item);
    }
  }

  return picked.sort((a, b) => {
    if (a.alreadyLinked !== b.alreadyLinked) return a.alreadyLinked ? 1 : -1;
    return b.score - a.score;
  });
}

// =============================================================================
// 4. PRE-PUBLISH QUALITY GATE (CONFIGURABLE MIN WORDS, DEFAULT 800)
// =============================================================================

export interface BlogQualityConfig {
  minWordCount: number;
  minInternalLinks: number;
}

export const DEFAULT_BLOG_QUALITY_CONFIG: BlogQualityConfig = {
  minWordCount: 800,
  minInternalLinks: 2,
};

export const blogQualityConfigSchema = z.object({
  minWordCount: z.coerce
    .number()
    .int()
    .min(100, "Số từ tối thiểu ít nhất 100 từ.")
    .max(5000, "Số từ tối thiểu tối đa 5.000 từ.")
    .default(800),
  minInternalLinks: z.coerce
    .number()
    .int()
    .min(1, "Số link nội bộ tối thiểu ít nhất 1.")
    .max(20, "Số link nội bộ tối thiểu tối đa 20.")
    .default(2),
});

export interface QualityGateCheck {
  id:
    | "min_words"
    | "cover_image_alt"
    | "meta_title_desc"
    | "primary_keyword"
    | "internal_links";
  label: string;
  passed: boolean;
  detail: string;
}

export interface QualityGateReport {
  passed: boolean;
  score: number;
  maxScore: number;
  wordCount: number;
  internalLinkCount: number;
  internalLinks: string[];
  hasZeroInternalLinks: boolean;
  checks: QualityGateCheck[];
}

export function countHtmlWords(html: string): number {
  const plain = extractPlainText(html || "");
  return plain.split(/\s+/).filter(Boolean).length;
}

export function evaluateBlogQualityGate(
  params: {
    title: string;
    excerpt: string;
    contentHtml: string;
    coverImageUrl?: string | null;
    seoMeta?: SeoMeta;
  },
  config: BlogQualityConfig = DEFAULT_BLOG_QUALITY_CONFIG
): QualityGateReport {
  const minWords = Math.max(100, config.minWordCount || 800);
  const minLinks = Math.max(1, config.minInternalLinks || 2);

  const wordCount = countHtmlWords(params.contentHtml);
  const internalLinks = extractInternalLinks(params.contentHtml);
  const internalLinkCount = internalLinks.length;

  const coverUrl = (params.coverImageUrl || "").trim();
  const coverAlt = (
    params.seoMeta?.coverImageAlt ||
    params.seoMeta?.ogImageAlt ||
    ""
  ).trim();
  const metaTitle = (params.seoMeta?.metaTitle || params.title || "").trim();
  const metaDesc = (params.seoMeta?.metaDescription || params.excerpt || "").trim();
  const primaryKw = (params.seoMeta?.primaryKeyword || "").trim();

  const checks: QualityGateCheck[] = [
    {
      id: "min_words",
      label: `Độ dài tối thiểu ${minWords.toLocaleString("vi-VN")} từ`,
      passed: wordCount >= minWords,
      detail:
        wordCount >= minWords
          ? `Đạt: ${wordCount.toLocaleString("vi-VN")} / ${minWords.toLocaleString("vi-VN")} từ`
          : `Còn thiếu ${(minWords - wordCount).toLocaleString("vi-VN")} từ (hiện có ${wordCount.toLocaleString("vi-VN")} từ)`,
    },
    {
      id: "cover_image_alt",
      label: "Có ảnh đại diện & Alt Text mô tả",
      passed: Boolean(coverUrl) && coverAlt.length >= 3,
      detail: !coverUrl
        ? "Chưa chọn ảnh đại diện bài viết"
        : coverAlt.length < 3
        ? "Đã có ảnh đại diện nhưng thiếu Alt Text (≥ 3 ký tự)"
        : `Đã đủ ảnh & Alt ("${coverAlt.slice(0, 40)}")`,
    },
    {
      id: "meta_title_desc",
      label: "Có Meta Title & Meta Description",
      passed: metaTitle.length >= 10 && metaDesc.length >= 50,
      detail:
        metaTitle.length < 10
          ? `Meta Title quá ngắn (${metaTitle.length} ký tự, cần ≥ 10)`
          : metaDesc.length < 50
          ? `Meta Description quá ngắn (${metaDesc.length} ký tự, cần ≥ 50)`
          : `Title ${metaTitle.length} ký tự · Desc ${metaDesc.length} ký tự`,
    },
    {
      id: "primary_keyword",
      label: "Đã nhập từ khóa chính SEO",
      passed: primaryKw.length >= 2,
      detail: primaryKw
        ? `Từ khóa chính: "${primaryKw}"`
        : "Nhập từ khóa chính ở bảng Cài đặt SEO bên dưới",
    },
    {
      id: "internal_links",
      label: `Có ít nhất ${minLinks} link nội bộ trong bài`,
      passed: internalLinkCount >= minLinks,
      detail:
        internalLinkCount === 0
          ? "Cảnh báo: Bài viết chưa có link nội bộ nào!"
          : internalLinkCount < minLinks
          ? `Mới có ${internalLinkCount}/${minLinks} link nội bộ`
          : `Đạt: ${internalLinkCount} link nội bộ`,
    },
  ];

  const score = checks.filter((c) => c.passed).length;

  return {
    passed: score === checks.length,
    score,
    maxScore: checks.length,
    wordCount,
    internalLinkCount,
    internalLinks,
    hasZeroInternalLinks: internalLinkCount === 0,
    checks,
  };
}

// =============================================================================
// 5. AUTO TABLE OF CONTENTS (SAFE POST-SANITIZATION ANCHOR INJECTION)
// =============================================================================

export interface TocHeadingItem {
  id: string;
  level: 2 | 3;
  text: string;
}

export function extractTocAndInjectAnchors(safeHtml: string): {
  htmlWithAnchors: string;
  items: TocHeadingItem[];
} {
  if (!safeHtml) return { htmlWithAnchors: "", items: [] };

  const items: TocHeadingItem[] = [];
  const usedIds = new Map<string, number>();

  const htmlWithAnchors = safeHtml.replace(
    /<(h[23])(\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (fullMatch, tagRaw: string, attrsRaw: string, innerHtml: string) => {
      const level = tagRaw.toLowerCase() === "h2" ? 2 : 3;
      const text = extractPlainText(innerHtml).trim();
      if (!text) return fullMatch;

      const baseSlug = slugifyVi(text).slice(0, 60) || `muc-${items.length + 1}`;
      const seenCount = usedIds.get(baseSlug) ?? 0;
      usedIds.set(baseSlug, seenCount + 1);
      const id = seenCount === 0 ? `muc-${baseSlug}` : `muc-${baseSlug}-${seenCount + 1}`;

      items.push({ id, level, text });

      const cleanAttrs = attrsRaw.replace(/\s+id\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
      return `<${tagRaw.toLowerCase()} id="${id}"${cleanAttrs}>${innerHtml}</${tagRaw.toLowerCase()}>`;
    }
  );

  return { htmlWithAnchors, items };
}

// =============================================================================
// 6. BULK TEST IMPORT (CSV & JSON TEMPLATES, PARSER & ROW-BY-ROW VALIDATION)
// =============================================================================

export interface BulkImportIssue {
  row: number;
  slug?: string;
  field: string;
  severity: "error" | "warning";
  message: string;
}

export interface BulkImportParseResult {
  format: "csv" | "json";
  totalRows: number;
  tests: CmsTestFormInput[];
  errors: BulkImportIssue[];
  warnings: BulkImportIssue[];
}

const VALID_QUESTION_TYPES = new Set<string>(
  QUESTION_TYPE_CATALOG.map((q) => q.value)
);

export function parseCsvRows(rawCsv: string): string[][] {
  const input = rawCsv.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r") {
        if (input[i + 1] === "\n") i += 1;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const REQUIRED_CSV_HEADERS = [
  "test_slug",
  "test_title_vi",
  "skill",
  "section_title",
  "question_number",
  "question_type",
  "prompt",
  "correct_answers",
] as const;

export function parseBulkTestCsv(rawCsv: string): BulkImportParseResult {
  const errors: BulkImportIssue[] = [];
  const warnings: BulkImportIssue[] = [];
  const rows = parseCsvRows(rawCsv);

  if (rows.length < 2) {
    errors.push({
      row: 1,
      field: "file",
      severity: "error",
      message:
        "File CSV cần có dòng tiêu đề (header) và ít nhất 1 dòng dữ liệu câu hỏi.",
    });
    return { format: "csv", totalRows: 0, tests: [], errors, warnings };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const colIdx = new Map<string, number>();
  headers.forEach((h, i) => colIdx.set(h, i));

  for (const reqHeader of REQUIRED_CSV_HEADERS) {
    if (!colIdx.has(reqHeader)) {
      errors.push({
        row: 1,
        field: reqHeader,
        severity: "error",
        message: `Thiếu cột bắt buộc "${reqHeader}" ở dòng tiêu đề CSV.`,
      });
    }
  }
  if (errors.length > 0) {
    return {
      format: "csv",
      totalRows: rows.length - 1,
      tests: [],
      errors,
      warnings,
    };
  }

  const cell = (r: string[], name: string) =>
    (r[colIdx.get(name) ?? -1] ?? "").trim();

  interface GroupedTest {
    firstRow: number;
    slug: string;
    title_vi: string;
    title_en: string;
    description_vi: string;
    skill: "reading" | "listening" | "writing" | "speaking";
    module: "academic" | "general";
    duration_minutes: number;
    difficulty: "band_5_6" | "band_6_7" | "band_7_plus";
    is_premium: boolean;
    sectionsMap: Map<
      string,
      {
        title: string;
        instruction: string;
        passage: string;
        audioUrl: string;
        questions: Array<{
          id: string;
          number: number;
          type: QuestionType;
          prompt: string;
          options?: string[];
          correctAnswers: string[];
          explanation_vi: string;
          explanation_en: string;
        }>;
      }
    >;
  }

  const grouped = new Map<string, GroupedTest>();

  for (let i = 1; i < rows.length; i++) {
    const rowNum = i + 1;
    const r = rows[i];

    const rawSlug = cell(r, "test_slug");
    const slug = slugifyVi(rawSlug);
    const titleVi = cell(r, "test_title_vi");
    const titleEn = cell(r, "test_title_en");
    const descVi = cell(r, "description_vi");
    const skillRaw = cell(r, "skill").toLowerCase();
    const moduleRaw = (cell(r, "module") || "academic").toLowerCase();
    const durationRaw = Number(cell(r, "duration_minutes") || (skillRaw === "listening" ? 30 : 60));
    const difficultyRaw = (cell(r, "difficulty") || "band_6_7").toLowerCase();
    const isPremiumRaw = cell(r, "is_premium").toLowerCase();

    const sectionTitle = cell(r, "section_title");
    const instruction = cell(r, "section_instruction");
    const passage = cell(r, "passage");
    const audioUrl = cell(r, "audio_url");

    const qNumRaw = Number(cell(r, "question_number"));
    const qTypeRaw = cell(r, "question_type").toLowerCase();
    const prompt = cell(r, "prompt");
    const optionsRaw = cell(r, "options");
    const answersRaw = cell(r, "correct_answers");
    const explanationVi = cell(r, "explanation_vi");
    const explanationEn = cell(r, "explanation_en");

    let rowHasError = false;

    if (!slug || slug.length < 3) {
      errors.push({
        row: rowNum,
        slug: rawSlug,
        field: "test_slug",
        severity: "error",
        message: "Slug đề thi phải có ít nhất 3 ký tự hợp lệ.",
      });
      rowHasError = true;
    }

    if (titleVi.length < 5) {
      errors.push({
        row: rowNum,
        slug,
        field: "test_title_vi",
        severity: "error",
        message: "Tiêu đề đề thi (test_title_vi) cần ít nhất 5 ký tự.",
      });
      rowHasError = true;
    }

    if (skillRaw !== "reading" && skillRaw !== "listening") {
      errors.push({
        row: rowNum,
        slug,
        field: "skill",
        severity: "error",
        message: `Kỹ năng "${skillRaw}" không hỗ trợ nhập CSV dạng câu hỏi (dùng "reading" hoặc "listening"; với Writing/Speaking hãy dùng mẫu JSON).`,
      });
      rowHasError = true;
    }

    if (moduleRaw !== "academic" && moduleRaw !== "general") {
      errors.push({
        row: rowNum,
        slug,
        field: "module",
        severity: "error",
        message: `Giá trị module "${moduleRaw}" không hợp lệ (chỉ nhận "academic" hoặc "general").`,
      });
      rowHasError = true;
    }

    if (
      difficultyRaw !== "band_5_6" &&
      difficultyRaw !== "band_6_7" &&
      difficultyRaw !== "band_7_plus"
    ) {
      errors.push({
        row: rowNum,
        slug,
        field: "difficulty",
        severity: "error",
        message: `Độ khó "${difficultyRaw}" không hợp lệ (band_5_6, band_6_7, hoặc band_7_plus).`,
      });
      rowHasError = true;
    }

    if (!sectionTitle) {
      errors.push({
        row: rowNum,
        slug,
        field: "section_title",
        severity: "error",
        message: "Thiếu tên Section / Passage / Part.",
      });
      rowHasError = true;
    }

    if (!Number.isInteger(qNumRaw) || qNumRaw < 1 || qNumRaw > 60) {
      errors.push({
        row: rowNum,
        slug,
        field: "question_number",
        severity: "error",
        message: `Số thứ tự câu hỏi "${cell(r, "question_number")}" phải là số nguyên 1–60.`,
      });
      rowHasError = true;
    }

    if (!VALID_QUESTION_TYPES.has(qTypeRaw)) {
      errors.push({
        row: rowNum,
        slug,
        field: "question_type",
        severity: "error",
        message: `Dạng câu hỏi "${qTypeRaw}" không hợp lệ (VD: tfng, ynng, mcq, summary_completion, sentence_completion...).`,
      });
      rowHasError = true;
    }

    if (prompt.length < 3) {
      errors.push({
        row: rowNum,
        slug,
        field: "prompt",
        severity: "error",
        message: "Nội dung câu hỏi (prompt) không được để trống.",
      });
      rowHasError = true;
    }

    const correctAnswers = parseAcceptedAnswersInput(answersRaw);
    if (correctAnswers.length === 0) {
      errors.push({
        row: rowNum,
        slug,
        field: "correct_answers",
        severity: "error",
        message: "Thiếu đáp án đúng (correct_answers).",
      });
      rowHasError = true;
    }

    const parsedOptions = optionsRaw
      ? optionsRaw
          .split("|")
          .map((o) => o.trim())
          .filter(Boolean)
      : undefined;

    if (
      !rowHasError &&
      OPTION_TYPES_SET.has(qTypeRaw as QuestionType) &&
      (!parsedOptions || parsedOptions.length < 2)
    ) {
      const def = QUESTION_TYPE_CATALOG.find((c) => c.value === qTypeRaw);
      if (!def?.defaultOptions) {
        errors.push({
          row: rowNum,
          slug,
          field: "options",
          severity: "error",
          message: `Dạng "${qTypeRaw}" cần danh sách lựa chọn phân tách bởi dấu "|".`,
        });
        rowHasError = true;
      }
    }

    if (rowHasError) continue;

    let group = grouped.get(slug);
    if (!group) {
      group = {
        firstRow: rowNum,
        slug,
        title_vi: titleVi,
        title_en: titleEn || titleVi,
        description_vi: descVi,
        skill: skillRaw as "reading" | "listening",
        module: moduleRaw as "academic" | "general",
        duration_minutes:
          Number.isFinite(durationRaw) && durationRaw >= 5 && durationRaw <= 180
            ? Math.round(durationRaw)
            : skillRaw === "listening"
            ? 30
            : 60,
        difficulty: difficultyRaw as "band_5_6" | "band_6_7" | "band_7_plus",
        is_premium: isPremiumRaw === "true" || isPremiumRaw === "1" || isPremiumRaw === "yes",
        sectionsMap: new Map(),
      };
      grouped.set(slug, group);
    }

    let sec = group.sectionsMap.get(sectionTitle);
    if (!sec) {
      sec = {
        title: sectionTitle,
        instruction,
        passage,
        audioUrl,
        questions: [],
      };
      group.sectionsMap.set(sectionTitle, sec);
    } else {
      if (!sec.passage && passage) sec.passage = passage;
      if (!sec.audioUrl && audioUrl) sec.audioUrl = audioUrl;
      if (!sec.instruction && instruction) sec.instruction = instruction;
    }

    const defaultOpts = QUESTION_TYPE_CATALOG.find(
      (c) => c.value === qTypeRaw
    )?.defaultOptions;

    sec.questions.push({
      id: `${slug}-q${qNumRaw}`,
      number: qNumRaw,
      type: qTypeRaw as QuestionType,
      prompt,
      options:
        parsedOptions && parsedOptions.length > 0
          ? parsedOptions
          : OPTION_TYPES_SET.has(qTypeRaw as QuestionType)
          ? defaultOpts
          : undefined,
      correctAnswers,
      explanation_vi: explanationVi,
      explanation_en: explanationEn || explanationVi,
    });
  }

  const tests: CmsTestFormInput[] = [];

  for (const g of grouped.values()) {
    const sections = Array.from(g.sectionsMap.values()).map((sec, sIdx) => ({
      id: `${g.slug}-sec-${sIdx + 1}`,
      title: sec.title,
      instruction: sec.instruction || undefined,
      passage: sec.passage || undefined,
      audioUrl: sec.audioUrl || undefined,
      questions: sec.questions.sort((a, b) => a.number - b.number),
    }));

    const candidate = {
      slug: g.slug,
      skill: g.skill,
      module: g.module,
      title_vi: g.title_vi,
      title_en: g.title_en,
      description_vi: g.description_vi,
      description_en: g.description_vi,
      duration_minutes: g.duration_minutes,
      difficulty: g.difficulty,
      is_published: false,
      is_daily_eligible: false,
      is_premium: g.is_premium,
      seo_meta: {},
      sections,
    };

    const parsed = cmsTestFormSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        row: g.firstRow,
        slug: g.slug,
        field: parsed.error.issues[0]?.path.join(".") || "test",
        severity: "error",
        message:
          parsed.error.issues[0]?.message ||
          `Đề "${g.slug}" không đạt kiểm tra schema.`,
      });
      continue;
    }

    const check = validateTestForPublish({
      skill: parsed.data.skill,
      sections: parsed.data.sections,
    });
    if (check.duplicateNumbers.length > 0) {
      errors.push({
        row: g.firstRow,
        slug: g.slug,
        field: "question_number",
        severity: "error",
        message: `Đề "${g.slug}" bị trùng số thứ tự câu: ${check.duplicateNumbers.join(", ")}.`,
      });
      continue;
    }

    if (check.questionCount < 40) {
      warnings.push({
        row: g.firstRow,
        slug: g.slug,
        field: "questionCount",
        severity: "warning",
        message: `Đề "${g.slug}" mới có ${check.questionCount}/40 câu — sẽ được lưu ở trạng thái Nháp để bổ sung đủ 40 câu trước khi xuất bản.`,
      });
    }

    tests.push({ ...parsed.data, is_published: false });
  }

  return {
    format: "csv",
    totalRows: rows.length - 1,
    tests,
    errors,
    warnings,
  };
}

export function parseBulkTestJson(rawJson: string): BulkImportParseResult {
  const errors: BulkImportIssue[] = [];
  const warnings: BulkImportIssue[] = [];

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(rawJson.replace(/^\uFEFF/, ""));
  } catch (err) {
    errors.push({
      row: 1,
      field: "json",
      severity: "error",
      message: `Lỗi cú pháp JSON: ${err instanceof Error ? err.message : "Không thể parse JSON."}`,
    });
    return { format: "json", totalRows: 0, tests: [], errors, warnings };
  }

  const list = Array.isArray(parsedRaw)
    ? parsedRaw
    : parsedRaw &&
      typeof parsedRaw === "object" &&
      Array.isArray((parsedRaw as { tests?: unknown[] }).tests)
    ? (parsedRaw as { tests: unknown[] }).tests
    : [parsedRaw];

  if (list.length === 0) {
    errors.push({
      row: 1,
      field: "tests",
      severity: "error",
      message: "File JSON không chứa đề thi nào.",
    });
    return { format: "json", totalRows: 0, tests: [], errors, warnings };
  }

  const tests: CmsTestFormInput[] = [];
  const seenSlugs = new Set<string>();

  list.forEach((rawItem, idx) => {
    const itemNum = idx + 1;
    if (!rawItem || typeof rawItem !== "object") {
      errors.push({
        row: itemNum,
        field: "item",
        severity: "error",
        message: `Mục #${itemNum} không phải đối tượng đề thi hợp lệ.`,
      });
      return;
    }

    const obj = rawItem as Record<string, unknown>;
    const normalizedSections = Array.isArray(obj.sections)
      ? obj.sections.map((secRaw, sIdx) => {
          const sec = (secRaw && typeof secRaw === "object"
            ? secRaw
            : {}) as Record<string, unknown>;
          const questions = Array.isArray(sec.questions)
            ? sec.questions.map((qRaw, qIdx) => {
                const q = (qRaw && typeof qRaw === "object"
                  ? qRaw
                  : {}) as Record<string, unknown>;
                const rawAns = q.correctAnswers ?? q.correct_answers;
                const correctAnswers = Array.isArray(rawAns)
                  ? rawAns.map((a) => String(a).trim()).filter(Boolean)
                  : typeof rawAns === "string"
                  ? parseAcceptedAnswersInput(rawAns)
                  : [];
                return {
                  ...q,
                  id:
                    typeof q.id === "string" && q.id.trim()
                      ? q.id.trim()
                      : `imp-${itemNum}-s${sIdx + 1}-q${qIdx + 1}`,
                  number: Number(q.number ?? qIdx + 1),
                  correctAnswers,
                  explanation_vi: String(q.explanation_vi ?? ""),
                  explanation_en: String(
                    q.explanation_en ?? q.explanation_vi ?? ""
                  ),
                };
              })
            : [];
          return {
            ...sec,
            id:
              typeof sec.id === "string" && sec.id.trim()
                ? sec.id.trim()
                : `imp-${itemNum}-sec-${sIdx + 1}`,
            questions,
          };
        })
      : [];

    const candidate = {
      ...obj,
      sections: normalizedSections,
      is_published: false,
    };

    const parsed = cmsTestFormSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues.slice(0, 3)) {
        errors.push({
          row: itemNum,
          slug: typeof obj.slug === "string" ? obj.slug : undefined,
          field: issue.path.join(".") || "test",
          severity: "error",
          message: `Đề #${itemNum}: ${issue.message}`,
        });
      }
      return;
    }

    if (seenSlugs.has(parsed.data.slug)) {
      errors.push({
        row: itemNum,
        slug: parsed.data.slug,
        field: "slug",
        severity: "error",
        message: `Đề #${itemNum} bị trùng slug "${parsed.data.slug}" ngay trong file nhập.`,
      });
      return;
    }
    seenSlugs.add(parsed.data.slug);

    const check = validateTestForPublish({
      skill: parsed.data.skill,
      sections: parsed.data.sections,
      writingPrompt: parsed.data.writingPrompt,
      speakingPrompts: parsed.data.speakingPrompts,
    });

    if (check.duplicateNumbers.length > 0) {
      errors.push({
        row: itemNum,
        slug: parsed.data.slug,
        field: "sections.questions",
        severity: "error",
        message: `Đề #${itemNum} (${parsed.data.slug}) trùng số thứ tự câu: ${check.duplicateNumbers.join(", ")}.`,
      });
      return;
    }

    if (
      (parsed.data.skill === "reading" || parsed.data.skill === "listening") &&
      check.questionCount < 40
    ) {
      warnings.push({
        row: itemNum,
        slug: parsed.data.slug,
        field: "questionCount",
        severity: "warning",
        message: `Đề "${parsed.data.slug}" hiện có ${check.questionCount}/40 câu — sẽ được lưu ở trạng thái Nháp.`,
      });
    }

    tests.push({ ...parsed.data, is_published: false });
  });

  return {
    format: "json",
    totalRows: list.length,
    tests,
    errors,
    warnings,
  };
}

export const CSV_IMPORT_TEMPLATE = `test_slug,test_title_vi,test_title_en,description_vi,skill,module,duration_minutes,difficulty,is_premium,section_title,section_instruction,passage,audio_url,question_number,question_type,prompt,options,correct_answers,explanation_vi
reading-urban-vertical-farming,IELTS Reading: Nông nghiệp thẳng đứng đô thị,IELTS Reading: Urban Vertical Farming,Đề mẫu nhập hàng loạt qua CSV (sẽ lưu trạng thái Nháp),reading,academic,60,band_6_7,false,Passage 1: Vertical Farming in Modern Cities,Questions 1-3: Answer the following questions.,"Vertical farming grows crops in stacked indoor layers using hydroponics and LED lighting, reducing water consumption by up to 90 percent compared with conventional agriculture. Supporters highlight year-round harvests close to urban consumers, while critics note high electricity costs.",,1,tfng,Vertical farming requires significantly less water than traditional farming.,TRUE|FALSE|NOT GIVEN,TRUE,Đoạn văn nêu rõ giảm tới 90% lượng nước so với nông nghiệp truyền thống.
reading-urban-vertical-farming,IELTS Reading: Nông nghiệp thẳng đứng đô thị,IELTS Reading: Urban Vertical Farming,Đề mẫu nhập hàng loạt qua CSV (sẽ lưu trạng thái Nháp),reading,academic,60,band_6_7,false,Passage 1: Vertical Farming in Modern Cities,Questions 1-3: Answer the following questions.,,,2,sentence_completion,Critics point out that vertical farms still face high ________ costs.,,electricity,Đoạn văn ghi 'while critics note high electricity costs'.
reading-urban-vertical-farming,IELTS Reading: Nông nghiệp thẳng đứng đô thị,IELTS Reading: Urban Vertical Farming,Đề mẫu nhập hàng loạt qua CSV (sẽ lưu trạng thái Nháp),reading,academic,60,band_6_7,false,Passage 1: Vertical Farming in Modern Cities,Questions 1-3: Answer the following questions.,,,3,mcq,What is one advantage mentioned by supporters?,A. Zero electricity usage|B. Year-round harvests near cities|C. Outdoor soil fertility|D. Free LED equipment,B,Supporters highlight year-round harvests close to urban consumers.
`;

export const JSON_IMPORT_TEMPLATE = JSON.stringify(
  [
    {
      slug: "reading-ocean-microplastics-sample",
      skill: "reading",
      module: "academic",
      title_vi: "IELTS Reading: Giải pháp xử lý vi nhựa đại dương",
      title_en: "IELTS Reading: Ocean Microplastics Solutions",
      description_vi:
        "Đề mẫu nhập hàng loạt từ JSON (tự động lưu trạng thái Nháp).",
      duration_minutes: 60,
      difficulty: "band_6_7",
      is_premium: false,
      sections: [
        {
          title: "Passage 1: Filtering Microplastics at Source",
          instruction: "Questions 1-2: Read the passage and answer.",
          passage:
            "Synthetic textiles shed thousands of microscopic fibres during every domestic wash cycle. Installing fine-mesh filters inside washing machines can capture over 75 percent of these particles before wastewater enters municipal rivers.",
          questions: [
            {
              number: 1,
              type: "tfng",
              prompt:
                "Washing synthetic clothes releases microscopic plastic fibres.",
              options: ["TRUE", "FALSE", "NOT GIVEN"],
              correctAnswers: ["TRUE"],
              explanation_vi:
                "Câu đầu tiên xác nhận vải tổng hợp thải ra hàng nghìn sợi vi nhựa trong mỗi chu kỳ giặt.",
            },
            {
              number: 2,
              type: "sentence_completion",
              prompt:
                "Fine-mesh filters in washing machines can trap more than ________ percent of fibres.",
              correctAnswers: ["75", "seventy-five"],
              explanation_vi:
                "Bài đọc ghi 'capture over 75 percent of these particles'.",
            },
          ],
        },
      ],
    },
  ],
  null,
  2
);

// =============================================================================
// 7. BLOG NEWSLETTER SUBSCRIPTION
// =============================================================================

export interface NewsletterSubscriber {
  id: string;
  email: string;
  source_slug?: string | null;
  locale: string;
  status: "active" | "unsubscribed";
  subscribed_at: string;
}

export const newsletterSubscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Vui lòng nhập địa chỉ email hợp lệ.")
    .max(160, "Email quá dài."),
  source_slug: z.string().trim().max(160).optional().nullable(),
  locale: z.enum(["vi", "en"]).optional().default("vi"),
});

export function escapeCsvCellSafe(raw: string | null | undefined): string {
  let str = String(raw ?? "");
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildSubscribersCsv(items: NewsletterSubscriber[]): string {
  const header = "email,source_slug,locale,status,subscribed_at";
  const rows = items.map((s) =>
    [
      escapeCsvCellSafe(s.email),
      escapeCsvCellSafe(s.source_slug ?? ""),
      escapeCsvCellSafe(s.locale),
      escapeCsvCellSafe(s.status),
      escapeCsvCellSafe(s.subscribed_at),
    ].join(",")
  );
  return `\uFEFF${[header, ...rows].join("\r\n")}\r\n`;
}
