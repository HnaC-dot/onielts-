import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { reserveUsageLimit } from "@/lib/usage-limits";
import {
  generateStructuredAi,
  getActiveGeminiModel,
  sanitizeUserDataForPrompt,
} from "@/lib/ai";
import {
  buildAiErrorResponse,
  buildQuotaDeniedResponse,
} from "@/lib/ai-route-helpers";
import { releaseAiQuotaRecord } from "@/lib/db";

export const maxDuration = 45;

const reqSchema = z.object({
  weakSentence: z.string().min(5).max(500),
  userRewrite: z.string().trim().min(5, "Hãy viết câu nâng cấp của bạn.").max(800),
  band8Model: z.string().min(5).max(800),
});

const resultSchema = z.object({
  estimatedBand: z.number().min(4).max(9),
  feedbackVi: z.string(),
  strengthsVi: z.array(z.string()),
  nextStepVi: z.string(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = await checkRateLimit(clientKey, 25, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Quá nhiều lượt thử, đợi vài giây nhé." }, { status: 429 });
  }

  let parsedData: z.infer<typeof reqSchema>;
  try {
    const body = await req.json();
    const parsed = reqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ" }, { status: 400 });
    }
    parsedData = parsed.data;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const reservation = await reserveUsageLimit({
    user,
    feature: "writing_exercise",
    rawFeatureName: "writing:exercise_check",
    skill: "writing",
    model: getActiveGeminiModel(),
    fallbackActorId: clientKey,
  });
  if (!reservation.allowed) {
    return buildQuotaDeniedResponse(reservation);
  }

  try {
    const { weakSentence, userRewrite, band8Model } = parsedData;
    const aiRes = await generateStructuredAi({
      feature: "writing:exercise_check",
      skill: "writing",
      userId: user?.id ?? clientKey,
      reservationId: reservation.reservationId,
      systemPrompt:
        "You are an IELTS Writing tutor giving brief, motivating Vietnamese feedback on a learner's sentence rewrite compared against the original weak sentence and a Band 8 model.",
      userPrompt: `Original weak sentence: ${weakSentence}\nTarget Band 8 model: ${band8Model}\nLearner rewrite:\n${sanitizeUserDataForPrompt(userRewrite, 800)}`,
      schema: resultSchema,
      jsonSchemaHint: `{ "estimatedBand": number, "feedbackVi": "string", "strengthsVi": ["string"], "nextStepVi": "string" }`,
      mockFallback: () => {
        const longer = userRewrite.split(/\s+/).length >= weakSentence.split(/\s+/).length + 2;
        const hasAcademic =
          /(exacerbate|subsid|transition|ecosystem|surge|expenditure|streamline|flexibility|mitigate|significant|considerabl|proportion|proliferation)/i.test(
            userRewrite
          );
        const band = hasAcademic ? 8.0 : longer ? 7.0 : 6.0;
        return {
          estimatedBand: band,
          feedbackVi: hasAcademic
            ? "Rất xuất sắc! Câu viết lại của bạn sử dụng từ vựng học thuật chính xác và cấu trúc tự nhiên ngang mức Band 8.0."
            : "Câu đã rõ nghĩa và trang trọng hơn câu gốc. Hãy đối chiếu với câu mẫu Band 8 bên dưới để mượn thêm 1–2 collocation đắt giá.",
          strengthsVi: [
            "Giữ nguyên được ý nghĩa cốt lõi của câu gốc.",
            longer
              ? "Đã mở rộng mạch diễn đạt đầy đủ và rõ sắc thái hơn."
              : "Diễn đạt gọn gàng, đúng trọng tâm.",
          ],
          nextStepVi:
            "Thử áp dụng kỹ thuật danh từ hóa (nominalization) hoặc mệnh đề quan hệ để câu thêm uyển chuyển.",
        };
      },
    });

    return NextResponse.json({ ok: true, result: aiRes.data, mocked: aiRes.mocked });
  } catch (err) {
    await releaseAiQuotaRecord(reservation.reservationId).catch(() => {});
    return buildAiErrorResponse(err, "Lỗi chấm câu nâng cấp.");
  }
}
