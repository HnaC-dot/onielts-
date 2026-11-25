import React from "react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";

interface LegalDoc {
  titleVi: string;
  titleEn: string;
  updatedAt: string;
  sectionsVi: { heading: string; body: string }[];
  sectionsEn: { heading: string; body: string }[];
}

const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    titleVi: "Chính sách bảo mật",
    titleEn: "Privacy Policy",
    updatedAt: "25/11/2026",
    sectionsVi: [
      {
        heading: "1. Dữ liệu chúng tôi thu thập",
        body: "Ôn IELTS chỉ thu thập thông tin cần thiết để phục vụ quá trình học tập của bạn: địa chỉ email đăng nhập, tên hiển thị, kết quả làm đề, bài viết/bài nói bạn chủ động gửi chấm AI và các bộ Flashcard bạn lưu.",
      },
      {
        heading: "2. Quyền riêng tư mặc định đối với bài viết & ghi âm",
        body: "Mọi bài luận Writing và bản ghi âm Speaking do bạn nộp đều ở chế độ RIÊNG TƯ theo mặc định (is_public = false). Không ai khác có thể xem bài của bạn trừ khi bạn chủ động bật công tắc chia sẻ công khai.",
      },
      {
        heading: "3. Bảo mật cơ sở dữ liệu (Row Level Security)",
        body: "Mọi bảng dữ liệu trên hệ thống đều áp dụng chính sách bảo mật cấp dòng (Row Level Security), bảo đảm tài khoản của bạn chỉ truy cập được dữ liệu thuộc quyền sở hữu của chính bạn.",
      },
    ],
    sectionsEn: [
      {
        heading: "1. Data We Collect",
        body: "Ôn IELTS collects only what is necessary to support your study journey: account email, display name, practice test attempts, essays/audio you submit for AI feedback, and saved flashcards.",
      },
      {
        heading: "2. Private by Default",
        body: "All user Writing essays and Speaking recordings are PRIVATE by default. Other users cannot view your submissions unless you explicitly opt in to publish them.",
      },
      {
        heading: "3. Row Level Security",
        body: "Every table in our PostgreSQL database enforces strict Row Level Security (RLS) policies to isolate personal data across accounts.",
      },
    ],
  },
  terms: {
    titleVi: "Điều khoản sử dụng",
    titleEn: "Terms of Service",
    updatedAt: "25/11/2026",
    sectionsVi: [
      {
        heading: "1. Mục đích sử dụng",
        body: "Ôn IELTS cung cấp đề thi luyện tập gốc, khóa học và công cụ AI hỗ trợ tự học IELTS. Bạn đồng ý không lạm dụng API, không tự động thu thập dữ liệu hoặc chia sẻ tài khoản cho mục đích thương mại.",
      },
      {
        heading: "2. Bản quyền nội dung gốc",
        body: "Toàn bộ bài đọc, kịch bản nghe, câu hỏi, bài mẫu và bài học trên Ôn IELTS đều được biên soạn nguyên bản. Người học được sử dụng cho mục đích ôn luyện cá nhân.",
      },
      {
        heading: "3. Tài khoản Free và Premium",
        body: "Tài khoản Free được làm đầy đủ đề thi và nhận hạn mức chấm AI hàng tháng. Gói Premium mở khóa không giới hạn lượt chấm AI, trình tạo bài mẫu và hội thoại AI trong suốt thời hạn đã thanh toán một lần (không tự động trừ tiền gia hạn).",
      },
    ],
    sectionsEn: [
      {
        heading: "1. Acceptable Use",
        body: "Ôn IELTS provides original IELTS practice tests, courses, and AI study utilities for individual learners. Automated scraping, rate-limit abuse, or commercial redistribution is prohibited.",
      },
      {
        heading: "2. Original Content Ownership",
        body: "All passages, listening scripts, questions, and sample essays on Ôn IELTS are 100% original educational content.",
      },
      {
        heading: "3. One-Time Premium Access",
        body: "Premium plans are billed one-time in VND for 1, 3, 6, or 12 months with no surprise auto-renewals.",
      },
    ],
  },
  disclaimers: {
    titleVi: "Tuyên bố miễn trừ trách nhiệm",
    titleEn: "Disclaimers",
    updatedAt: "25/11/2026",
    sectionsVi: [
      {
        heading: "1. Không liên kết với các tổ chức IELTS chính thức",
        body: "Ôn IELTS (onielts.vn) là nền tảng giáo dục độc lập. Chúng tôi KHÔNG liên kết, không đại diện và không được chứng thực bởi British Council, IDP Education hay Cambridge Assessment English. IELTS® là nhãn hiệu đã đăng ký của các tổ chức sở hữu tương ứng.",
      },
      {
        heading: "2. Điểm chấm AI mang tính tham khảo",
        body: "Điểm Band Writing, Speaking và đặc biệt là điểm Phát âm (Pronunciation) do AI ước lượng là 'điểm tham khảo' nhằm giúp bạn phát hiện điểm yếu và cải thiện nhanh hơn, không thay thế kết quả chấm chính thức của giám khảo trong kỳ thi thật.",
      },
    ],
    sectionsEn: [
      {
        heading: "1. Non-Affiliation Notice",
        body: "Ôn IELTS (onielts.vn) is an independent preparation platform and is NOT affiliated with, endorsed by, or sponsored by the British Council, IDP Education, or Cambridge Assessment English.",
      },
      {
        heading: "2. AI Scores Are Estimates",
        body: "AI Writing, Speaking, and Pronunciation scores are reference estimates designed to guide self-study and do not guarantee an identical official exam score.",
      },
    ],
  },
  "refund-policy": {
    titleVi: "Chính sách hoàn tiền",
    titleEn: "Refund Policy",
    updatedAt: "25/11/2026",
    sectionsVi: [
      {
        heading: "1. Đảm bảo trải nghiệm trong 7 ngày",
        body: "Bạn có thể yêu cầu hoàn tiền 100% trong vòng 7 ngày kể từ khi thanh toán gói Premium nếu gặp sự cố kỹ thuật không thể khắc phục hoặc sử dụng dưới 5 lượt chấm AI chuyên sâu.",
      },
      {
        heading: "2. Quy trình xử lý",
        body: "Gửi mã đơn hàng PayOS (VietQR) và email tài khoản qua trang Liên hệ. Chúng tôi xác minh và chuyển khoản hoàn lại trong vòng 3–5 ngày làm việc.",
      },
    ],
    sectionsEn: [
      {
        heading: "1. 7-Day Satisfaction Guarantee",
        body: "You may request a full refund within 7 days of purchasing a one-time Premium plan if you experienced unresolved technical issues or used fewer than 5 AI evaluations.",
      },
      {
        heading: "2. How to Request",
        body: "Submit your PayOS order code and account email via our Contact page; approved refunds are processed within 3–5 business days.",
      },
    ],
  },
  faqs: {
    titleVi: "Câu hỏi thường gặp (FAQs)",
    titleEn: "Frequently Asked Questions",
    updatedAt: "25/11/2026",
    sectionsVi: [
      {
        heading: "Gói Miễn phí (Free) dùng được những gì?",
        body: "Tài khoản Free được làm toàn bộ kho đề thi IELTS Reading/Listening, tham gia Đề thi mỗi ngày, dùng công cụ Tính điểm Band, học Flashcard và nhận 2 lượt chấm AI miễn phí mỗi kỹ năng mỗi tháng cùng giới hạn lượt dùng hàng ngày cho 8 công cụ AI cơ bản.",
      },
      {
        heading: "Thanh toán Premium có tự động gia hạn không?",
        body: "KHÔNG. Mọi gói 1, 3, 6 và 12 tháng trên Ôn IELTS đều là thanh toán 1 lần qua mã VietQR (PayOS). Khi hết hạn, tài khoản tự chuyển về Free mà không tự động trừ tiền.",
      },
      {
        heading: "Điểm Phát âm AI có chính xác tuyệt đối không?",
        body: "Điểm Phát âm được gắn nhãn rõ là 'điểm tham khảo' dựa trên phân tích âm thanh AI. Kết hợp giữa điểm tham khảo, luyện từng âm IPA và Shadowing sẽ giúp bạn cải thiện rõ rệt trước ngày thi.",
      },
      {
        heading: "Đề thi mỗi ngày tính theo múi giờ nào?",
        body: "Đề thi mỗi ngày làm mới lúc 00:00 theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7), mỗi tài khoản có 1 lượt thi chính thức mỗi ngày và được bấm giờ trên máy chủ.",
      },
    ],
    sectionsEn: [
      {
        heading: "What is included in the Free plan?",
        body: "Free accounts get full access to practice tests, Daily Exams, Band Calculators, Flashcards, 2 AI evaluations per skill per month, and daily free allowances on general AI tools.",
      },
      {
        heading: "Do Premium plans auto-renew?",
        body: "No. All 1, 3, 6, and 12-month plans are one-time VND payments via VietQR (PayOS) with zero automatic recurring charges.",
      },
      {
        heading: "Which timezone do Daily Exams follow?",
        body: "Daily Exams reset at midnight Vietnam time (Asia/Ho_Chi_Minh, UTC+7) with one server-timed attempt per user per day.",
      },
    ],
  },
};

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = LEGAL_DOCS[slug];
  if (!doc) notFound();

  const locale = await getLocale();
  const isEn = locale === "en";
  const sections = isEn ? doc.sectionsEn : doc.sectionsVi;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Card className="p-6 sm:p-10">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {isEn ? `Last updated: ${doc.updatedAt}` : `Cập nhật lần cuối: ${doc.updatedAt}`}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {isEn ? doc.titleEn : doc.titleVi}
        </h1>
        <div className="mt-8 space-y-6">
          {sections.map((sec) => (
            <section key={sec.heading}>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {sec.heading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {sec.body}
              </p>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
