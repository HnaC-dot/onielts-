import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { checkUsageLimit, reserveUsageLimit } from "@/lib/usage-limits";
import {
  generateStructuredAi,
  getActiveGeminiModel,
  sanitizeUserDataForPrompt,
} from "@/lib/ai";
import {
  buildAiErrorResponse,
  buildQuotaDeniedResponse,
} from "@/lib/ai-route-helpers";
import { calculateCriterionBand } from "@/lib/band-calculator";
import { releaseAiQuotaRecord, saveWritingSubmission } from "@/lib/db";
import type { WritingEvaluation } from "@/lib/types";

export const maxDuration = 60;

const evaluateSchema = z.object({
  taskType: z.enum(["academic_t1", "general_t1", "task_2"]),
  promptText: z.string().trim().min(10, "Vui lòng nhập đề bài tối thiểu 10 ký tự.").max(2000),
  essayText: z.string().trim().min(40, "Bài viết quá ngắn (tối thiểu 40 ký tự).").max(8000),
  chartImageBase64: z.string().max(7_000_000).optional(),
  chartImageMime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
  chartImageName: z.string().max(200).optional(),
});

const criterionSchema = z.object({
  band: z.number().min(0).max(9),
  feedbackVi: z.string().min(1),
  feedbackEn: z.string().min(1),
});

const writingEvaluationSchema: z.ZodType<WritingEvaluation> = z.object({
  overallBand: z.number().min(0).max(9),
  criteria: z.object({
    taskResponse: criterionSchema,
    coherenceCohesion: criterionSchema,
    lexicalResource: criterionSchema,
    grammaticalRange: criterionSchema,
  }),
  inlineErrors: z.array(
    z.object({
      original: z.string(),
      correction: z.string(),
      category: z.enum(["grammar", "vocabulary", "coherence", "spelling"]),
      explanationVi: z.string(),
    })
  ),
  vocabUpgrades: z.array(
    z.object({
      basic: z.string(),
      upgraded: z.string(),
      noteVi: z.string(),
    })
  ),
  band8Rewrite: z.string().min(20),
  summaryVi: z.string().min(10),
});

function buildMockWritingEvaluation(
  taskType: "academic_t1" | "general_t1" | "task_2",
  essayText: string
): WritingEvaluation {
  const words = essayText.trim().split(/\s+/).filter(Boolean);
  const wc = words.length;
  const minTarget = taskType === "task_2" ? 250 : 150;
  const baseBand = wc >= minTarget ? 6.5 : wc >= Math.floor(minTarget * 0.6) ? 6.0 : 5.5;
  const tr = baseBand;
  const cc = Math.min(8.5, baseBand + 0.5);
  const lr = baseBand;
  const gra = baseBand;
  const overall = calculateCriterionBand(tr, cc, lr, gra).band;

  const firstSentence = essayText.split(/(?<=[.!?])\s+/)[0] || essayText.slice(0, 80);
  const snippet = firstSentence.slice(0, 55);

  return {
    overallBand: overall,
    criteria: {
      taskResponse: {
        band: tr,
        feedbackVi:
          wc >= minTarget
            ? `Bài viết đạt đủ độ dài (${wc} từ) và trả lời đúng trọng tâm đề bài. Để lên 7.5+, hãy mở rộng thêm ví dụ thực tế cụ thể ở đoạn thân bài thứ hai.`
            : `Bài viết hiện có ${wc} từ (khuyến nghị tối thiểu ${minTarget} từ). Cần bổ sung thêm lập luận và dẫn chứng để tránh mất điểm Task ${taskType === "task_2" ? "Response" : "Achievement"}.`,
        feedbackEn: `Word count is ${wc} words. Clear position with room to deepen specific supporting evidence.`,
      },
      coherenceCohesion: {
        band: cc,
        feedbackVi:
          "Bố cục đoạn văn rõ ràng, có câu chủ đề và từ nối hợp lý. Nên thay một số từ nối lặp (Firstly, Also) bằng phép quy chiếu (this trend, such initiatives).",
        feedbackEn: "Logical paragraphing and clear progression; vary cohesive devices further.",
      },
      lexicalResource: {
        band: lr,
        feedbackVi:
          "Vốn từ diễn đạt rõ ý, tuy nhiên còn một số tính từ phổ thông (good, bad, many people). Bổ sung collocations chuyên ngành sẽ giúp bứt phá lên Band 7.5.",
        feedbackEn: "Adequate academic range with opportunities to introduce stronger collocations.",
      },
      grammaticalRange: {
        band: gra,
        feedbackVi:
          "Kết hợp được câu đơn và câu ghép. Cần kiểm tra kỹ mạo từ (a/an/the), chia động từ số ít/nhiều và bổ sung mệnh đề quan hệ không xác định.",
        feedbackEn: "Mix of simple and complex structures with minor accuracy slips.",
      },
    },
    inlineErrors: [
      {
        original: snippet,
        correction:
          taskType === "academic_t1"
            ? "Overall, the chart illustrates a pronounced upward trajectory across the period examined."
            : "It is widely acknowledged that this issue carries significant implications for modern society.",
        category: "vocabulary",
        explanationVi:
          "Câu mở đầu có thể diễn đạt học thuật và cô đọng hơn bằng cấu trúc bị động khách quan hoặc động từ mô tả xu hướng chính xác.",
      },
      {
        original: words.find((w) => /^(very|good|bad|big|a lot)$/i.test(w)) || words[Math.min(4, words.length - 1)] || "important",
        correction: "substantial / compelling",
        category: "vocabulary",
        explanationVi:
          "Nên thay từ phổ thông bằng tính từ học thuật mang sắc thái chính xác hơn trong IELTS Writing.",
      },
      {
        original: words.slice(Math.max(0, Math.floor(words.length / 2)), Math.max(3, Math.floor(words.length / 2) + 4)).join(" "),
        correction: "which consequently fosters long-term resilience",
        category: "grammar",
        explanationVi:
          "Bổ sung mệnh đề quan hệ chỉ kết quả ('which consequently + V') giúp tăng điểm tiêu chí Grammatical Range & Accuracy.",
      },
    ],
    vocabUpgrades: [
      {
        basic: "very important",
        upgraded: "pivotal / indispensable",
        noteVi: "Dùng khi nhấn mạnh yếu tố then chốt trong bài luận Task 2.",
      },
      {
        basic: "solve the problem",
        upgraded: "mitigate the underlying issue",
        noteVi: "Collocation tự nhiên ở mức Band 7.5–8.5.",
      },
      {
        basic: "increase quickly",
        upgraded: "witness a pronounced surge",
        noteVi: "Rất hiệu quả cho Academic Task 1 mô tả biểu đồ tăng mạnh.",
      },
    ],
    band8Rewrite:
      taskType === "academic_t1"
        ? "The chart compares key shifts in the selected categories over the surveyed timeframe. Overall, while renewable and digital categories experienced a marked upward trajectory, traditional segments recorded a gradual yet steady decline.\n\nAt the outset of the period, conventional methods accounted for the largest share before steadily losing ground as newer alternatives gained momentum. By the final year, the gap between the leading and trailing categories had narrowed considerably, reflecting a broader structural transition."
        : taskType === "general_t1"
        ? "Dear Sir or Madam,\n\nI am writing to express my sincere appreciation for the recent community initiative while also offering a few constructive suggestions for future improvements.\n\nAlthough the event was remarkably well organized and fostered strong local engagement, extending evening registration hours would make participation far more accessible for full-time working residents. I would be delighted to assist as a volunteer at the next gathering.\n\nYours faithfully,\nNguyen Minh Anh"
        : "In contemporary society, the debate surrounding this issue has attracted considerable attention from policymakers and citizens alike. While short-term convenience often drives initial adoption, a balanced long-term framework is essential to maximize societal benefits while minimizing unintended drawbacks.\n\nOn the one hand, targeted public investment and clearer educational standards can empower individuals to adapt constructively. On the other hand, without equitable access and transparent governance, existing disparities may inadvertently widen. Ultimately, combining proactive regulation with community participation represents the most sustainable path forward.",
    summaryVi: `Ước lượng tổng thể: Band ${overall.toFixed(1)} (${wc} từ). Điểm mạnh nằm ở bố cục rõ ràng; trọng tâm cải thiện trong 2 tuần tới là nâng cấp collocations và tăng độ chính xác của mệnh đề phức.`,
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = await checkRateLimit(clientKey, 15, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Vui lòng chờ ${rate.retryAfterSec} giây trước khi chấm bài tiếp.` },
      { status: 429 }
    );
  }

  let parsedData: z.infer<typeof evaluateSchema>;
  try {
    const body = await req.json();
    const parsed = evaluateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu bài viết không hợp lệ." },
        { status: 400 }
      );
    }
    parsedData = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu bài viết không hợp lệ." },
      { status: 400 }
    );
  }

  const reservation = await reserveUsageLimit({
    user,
    feature: "writing_eval",
    rawFeatureName: "writing:evaluate",
    skill: "writing",
    model: getActiveGeminiModel(),
    fallbackActorId: clientKey,
  });
  if (!reservation.allowed) {
    return buildQuotaDeniedResponse(reservation);
  }

  try {
    const { taskType, promptText, essayText, chartImageBase64, chartImageMime, chartImageName } =
      parsedData;
    const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;

    const safePrompt = sanitizeUserDataForPrompt(promptText, 2000);
    const safeEssay = sanitizeUserDataForPrompt(essayText, 8000);

    const taskLabel =
      taskType === "academic_t1"
        ? "IELTS Academic Writing Task 1 (Chart/Diagram Report)"
        : taskType === "general_t1"
        ? "IELTS General Training Task 1 (Letter)"
        : "IELTS Writing Task 2 (Essay)";

    const aiRes = await generateStructuredAi({
      feature: "writing:evaluate",
      skill: "writing",
      userId: user?.id ?? clientKey,
      reservationId: reservation.reservationId,
      systemPrompt: `You are a certified senior IELTS Writing Examiner teaching Vietnamese learners.
Grade the learner's ${taskLabel} strictly against the 4 official IELTS Writing criteria (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy).
Identify specific exact substrings from the essay as inlineErrors with corrections and clear Vietnamese explanations. Suggest 3-5 vocabulary upgrades and provide a full Band 8.5+ rewrite.`,
      userPrompt: `Task Type: ${taskLabel}\nPrompt:\n${safePrompt}\n\nLearner Essay (${wordCount} words):\n${safeEssay}`,
      schema: writingEvaluationSchema,
      jsonSchemaHint: `{
  "overallBand": number (0-9 in 0.5 increments),
  "criteria": {
    "taskResponse": { "band": number, "feedbackVi": "string", "feedbackEn": "string" },
    "coherenceCohesion": { "band": number, "feedbackVi": "string", "feedbackEn": "string" },
    "lexicalResource": { "band": number, "feedbackVi": "string", "feedbackEn": "string" },
    "grammaticalRange": { "band": number, "feedbackVi": "string", "feedbackEn": "string" }
  },
  "inlineErrors": [{ "original": "exact substring from essay", "correction": "string", "category": "grammar|vocabulary|coherence|spelling", "explanationVi": "string" }],
  "vocabUpgrades": [{ "basic": "string", "upgraded": "string", "noteVi": "string" }],
  "band8Rewrite": "string",
  "summaryVi": "string"
}`,
      inlineMedia:
        chartImageBase64 && chartImageMime
          ? { mimeType: chartImageMime, base64Data: chartImageBase64 }
          : undefined,
      mockFallback: () => buildMockWritingEvaluation(taskType, essayText),
    });

    // Persist real AI evaluations ONLY — never store mock data in database
    const submission = aiRes.mocked
      ? {
          id: `mock-writing-${Date.now()}`,
          user_id: user?.id ?? "guest",
          task_type: taskType,
          prompt_text: promptText,
          chart_image_name: chartImageName ?? null,
          essay_text: essayText,
          word_count: wordCount,
          evaluation: aiRes.data,
          is_public: false,
          created_at: new Date().toISOString(),
        }
      : await saveWritingSubmission({
          userId: user?.id ?? null,
          taskType,
          promptText,
          chartImageName: chartImageName ?? null,
          essayText,
          wordCount,
          evaluation: aiRes.data,
        });

    const updatedUsage = await checkUsageLimit(user, "writing_eval", clientKey);

    return NextResponse.json({
      ok: true,
      submission,
      usage: updatedUsage,
      mocked: aiRes.mocked,
    });
  } catch (err) {
    await releaseAiQuotaRecord(reservation.reservationId).catch(() => {});
    return buildAiErrorResponse(err, "Đã xảy ra lỗi khi chấm bài Writing.");
  }
}
