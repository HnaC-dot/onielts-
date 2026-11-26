import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { generateStructuredAi, sanitizeUserDataForPrompt } from "@/lib/ai";

export const maxDuration = 45;

const reqSchema = z.object({
  symbol: z.string().min(1).max(20),
  targetSentence: z.string().min(3).max(500),
  audioBase64: z.string().max(8_000_000).optional(),
  audioMimeType: z.string().max(60).optional(),
});

const outputSchema = z.object({
  referenceScore: z.number().min(0).max(100),
  estimatedBand: z.number().min(4).max(9),
  labelVi: z.literal("điểm tham khảo"),
  feedbackVi: z.string(),
  mouthAdjustmentVi: z.string(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = await checkRateLimit(clientKey, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Quá nhiều lượt thử, đợi vài giây nhé." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = reqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const { symbol, targetSentence, audioBase64, audioMimeType } = parsed.data;
    const aiRes = await generateStructuredAi({
      feature: "pronunciation:check",
      skill: "speaking",
      userId: user?.id ?? clientKey,
      systemPrompt:
        "You are an English phonetics coach helping Vietnamese IELTS learners practice specific IPA sounds. Provide an encouraging reference accuracy score (0-100), estimated pronunciation band, and specific mouth/tongue advice in Vietnamese. Always label labelVi as 'điểm tham khảo'.",
      userPrompt: `Target IPA sound: ${symbol}\nTarget sentence:\n${sanitizeUserDataForPrompt(targetSentence, 500)}`,
      schema: outputSchema,
      jsonSchemaHint: `{ "referenceScore": number, "estimatedBand": number, "labelVi": "điểm tham khảo", "feedbackVi": "string", "mouthAdjustmentVi": "string" }`,
      inlineMedia:
        audioBase64 && audioMimeType
          ? { mimeType: audioMimeType, base64Data: audioBase64 }
          : undefined,
      mockFallback: () => ({
        referenceScore: 82,
        estimatedBand: 7.0,
        labelVi: "điểm tham khảo",
        feedbackVi: `Bạn phát âm khá rõ âm ${symbol} trong các từ chính! Hãy giữ nhịp câu đều hơn và chú ý bật nhẹ phụ âm cuối để câu nói sắc nét hơn.`,
        mouthAdjustmentVi: `Kiểm tra lại khẩu hình cho âm ${symbol}: tập đọc chậm 2 lần từng từ ví dụ trước khi ghép vào cả câu với tốc độ bình thường.`,
      }),
    });

    return NextResponse.json({ ok: true, result: aiRes.data, mocked: aiRes.mocked });
  } catch {
    return NextResponse.json({ error: "Không thể chấm phát âm lúc này." }, { status: 500 });
  }
}
