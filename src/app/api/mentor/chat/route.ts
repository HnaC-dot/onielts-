import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { generateStructuredAi, sanitizeUserDataForPrompt } from "@/lib/ai";

export const maxDuration = 45;

const reqSchema = z.object({
  message: z.string().trim().min(2).max(1500),
  history: z
    .array(z.object({ role: z.enum(["mentor", "user"]), text: z.string().max(1500) }))
    .max(12)
    .optional()
    .default([]),
});

const mentorReplySchema = z.object({
  replyVi: z.string().min(10),
  actionPlanSteps: z.array(
    z.object({
      phase: z.string(),
      focus: z.string(),
      dailyRoutine: z.string(),
      recommendedLink: z.string(),
    })
  ),
  followUpQuestions: z.array(z.string()),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = checkRateLimit(clientKey, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Vui lòng đợi vài giây trước khi nhắn tiếp." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = reqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Tin nhắn không hợp lệ." }, { status: 400 });
    }

    const { message, history } = parsed.data;
    const context = history
      .slice(-6)
      .map((m) => `${m.role === "mentor" ? "Mentor" : "Học viên"}: ${m.text}`)
      .join("\n");

    const aiRes = await generateStructuredAi({
      feature: "mentor:chat",
      skill: "study_plan",
      userId: user?.id ?? clientKey,
      systemPrompt: `You are "Mentor Ôn IELTS", a warm, structured Vietnamese IELTS study advisor on onielts.vn.
Always reply in clear, motivating Vietnamese. Build concrete study plans tailored to the learner's current band, target band, timeline, and weak skills, linking directly to Ôn IELTS features (/tests, /writing, /speaking, /pronunciation, /dictation, /flashcards, /daily-exam, /courses).`,
      userPrompt: `Recent chat:\n${context}\n\nLearner message:\n${sanitizeUserDataForPrompt(message, 1500)}`,
      schema: mentorReplySchema,
      jsonSchemaHint: `{
  "replyVi": "string (clear, warm Vietnamese coaching response)",
  "actionPlanSteps": [{ "phase": "Tuần 1–4", "focus": "string", "dailyRoutine": "string", "recommendedLink": "/tests | /writing | /speaking | /dictation | /pronunciation" }],
  "followUpQuestions": ["string", "string"]
}`,
      mockFallback: () => ({
        replyVi:
          "Chào bạn! Dựa trên mục tiêu bạn vừa chia sẻ, Mentor Ôn IELTS đã thiết kế lộ trình 3 giai đoạn tối ưu cho người Việt tự học khoảng 90 phút mỗi ngày. Trọng tâm là tăng nhanh Reading & Listening lên 7.5 để kéo điểm Overall, đồng thời nâng Writing & Speaking lên 6.5–7.0 vững chắc.",
        actionPlanSteps: [
          {
            phase: "Giai đoạn 1 (Tuần 1–4): Củng cố nền tảng",
            focus: "Phát âm IPA, Chép chính tả & Từ vựng cốt lõi",
            dailyRoutine: "20p Phát âm IPA + 25p Chép chính tả + 15p Flashcard SM-2 + 30p Bài học Khóa nền tảng.",
            recommendedLink: "/pronunciation",
          },
          {
            phase: "Giai đoạn 2 (Tuần 5–8): Luyện kỹ thuật 4 kỹ năng",
            focus: "Chấm AI Writing/Speaking & Chiến thuật dạng câu Reading",
            dailyRoutine: "Mỗi tuần 2 bài Writing chấm AI + 3 buổi Hội thoại AI + làm Đề thi mỗi ngày 15 phút.",
            recommendedLink: "/writing",
          },
          {
            phase: "Giai đoạn 3 (Tuần 9–12): Thi thử bấm giờ & Vá lỗ hổng",
            focus: "Thi chuẩn máy tính & Phân tích dạng câu hay sai",
            dailyRoutine: "2 đề Reading/Listening bấm giờ/tuần, xem báo cáo Tiến độ để ôn lại đúng dạng câu yếu nhất.",
            recommendedLink: "/tests",
          },
        ],
        followUpQuestions: [
          "Bạn đang yếu nhất kỹ năng nào trong 4 kỹ năng?",
          "Bạn dự định thi IELTS vào tháng mấy?",
        ],
      }),
    });

    return NextResponse.json({ ok: true, mentor: aiRes.data, mocked: aiRes.mocked });
  } catch {
    return NextResponse.json({ error: "Mentor đang bận, thử lại sau nhé." }, { status: 500 });
  }
}
