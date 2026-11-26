import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { checkUsageLimit } from "@/lib/usage-limits";
import { generateStructuredAi, sanitizeUserDataForPrompt } from "@/lib/ai";

export const maxDuration = 45;

const reqSchema = z.object({
  topicTitle: z.string().min(2).max(120),
  history: z
    .array(
      z.object({
        role: z.enum(["ai", "user"]),
        text: z.string().max(1000),
      })
    )
    .max(20),
  userMessage: z.string().trim().min(2).max(1000),
});

const replySchema = z.object({
  aiReply: z.string().min(5),
  quickTipVi: z.string().min(5),
  suggestedReplies: z.array(z.string()).min(2).max(4),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = checkRateLimit(clientKey, 25, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Bạn nhắn quá nhanh, chờ vài giây nhé." }, { status: 429 });
  }

  const usage = await checkUsageLimit(user, "conversation", clientKey);
  if (!usage.allowed) {
    return NextResponse.json(
      { error: "Đã hết lượt hội thoại AI miễn phí hôm nay.", limitReached: true, usage },
      { status: 402 }
    );
  }

  try {
    const body = await req.json();
    const parsed = reqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Tin nhắn không hợp lệ" }, { status: 400 });
    }

    const { topicTitle, history, userMessage } = parsed.data;
    const transcript = history
      .slice(-6)
      .map((m) => `${m.role === "ai" ? "Examiner" : "Learner"}: ${m.text}`)
      .join("\n");

    const aiRes = await generateStructuredAi({
      feature: "conversation:reply",
      skill: "speaking",
      userId: user?.id ?? clientKey,
      systemPrompt: `You are a warm, encouraging IELTS Speaking partner role-playing the topic "${topicTitle}".
Respond naturally in 2-3 sentences and ask one engaging follow-up question.
Also give one brief, helpful Vietnamese tip improving the learner's previous reply (grammar or natural vocabulary), plus 3 Band 7.5-8.5 reply suggestions the learner can use next.`,
      userPrompt: `Recent conversation:\n${transcript}\n\nLatest learner message:\n${sanitizeUserDataForPrompt(userMessage, 1000)}`,
      schema: replySchema,
      jsonSchemaHint: `{
  "aiReply": "string (natural examiner reply + follow-up question)",
  "quickTipVi": "string (1 short Vietnamese improvement tip)",
  "suggestedReplies": ["string", "string", "string"]
}`,
      mockFallback: () => ({
        aiReply: `That sounds really interesting! I love how clearly you described that aspect of ${topicTitle}. Follow-up question: has your view or routine around this changed at all over the past two or three years?`,
        quickTipVi:
          "Câu trả lời rõ ý và tự nhiên! Ở lượt tiếp theo, hãy thử dùng cụm nối 'Over the past few years...' hoặc 'What I appreciate most is...' để tăng điểm Fluency & Lexical Resource.",
        suggestedReplies: [
          "Yes, quite a lot actually! A few years ago I barely paid attention to it, whereas now it's a core part of my weekly routine.",
          "Not dramatically, though I've come to appreciate the smaller details much more as I've grown older.",
          "To be honest, modern technology has reshaped how I experience it—making everything more convenient yet slightly faster-paced.",
        ],
      }),
    });

    return NextResponse.json({
      ok: true,
      reply: aiRes.data,
      mocked: aiRes.mocked,
    });
  } catch {
    return NextResponse.json({ error: "Không thể phản hồi hội thoại lúc này." }, { status: 500 });
  }
}
