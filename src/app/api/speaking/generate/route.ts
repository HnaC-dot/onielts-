import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { checkUsageLimit } from "@/lib/usage-limits";
import { generateStructuredAi, sanitizeUserDataForPrompt } from "@/lib/ai";

export const maxDuration = 60;

const reqSchema = z.object({
  part: z.enum(["part_1", "part_2", "part_3"]),
  topic: z.string().trim().min(2).max(500),
});

const outputSchema = z.object({
  partTitle: z.string(),
  cueCardBullets: z.array(z.string()).optional(),
  items: z.array(
    z.object({
      question: z.string(),
      band8Answer: z.string(),
      vocabTips: z.array(z.string()),
      strategyVi: z.string(),
    })
  ),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = checkRateLimit(clientKey, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Thao tác quá nhanh, vui lòng chờ vài giây." }, { status: 429 });
  }

  const usage = await checkUsageLimit(user, "generator", clientKey);
  if (!usage.allowed) {
    return NextResponse.json(
      { error: "Đã hết lượt tạo câu trả lời mẫu miễn phí hôm nay.", limitReached: true, usage },
      { status: 402 }
    );
  }

  try {
    const body = await req.json();
    const parsed = reqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Chủ đề không hợp lệ" }, { status: 400 });
    }

    const { part, topic } = parsed.data;
    const safeTopic = sanitizeUserDataForPrompt(topic, 500);

    const aiRes = await generateStructuredAi({
      feature: "speaking:generate",
      skill: "speaking",
      userId: user?.id ?? clientKey,
      systemPrompt:
        "You are an IELTS Speaking Band 9 coach. Generate natural, original spoken questions and Band 8.5 sample answers for the requested Speaking Part and topic, with key collocations and concise Vietnamese strategy notes.",
      userPrompt: `Speaking Part: ${part}\nTopic:\n${safeTopic}`,
      schema: outputSchema,
      jsonSchemaHint: `{
  "partTitle": "string",
  "cueCardBullets": ["optional 4 bullets for part_2"],
  "items": [{ "question": "string", "band8Answer": "string", "vocabTips": ["string"], "strategyVi": "string" }]
}`,
      cacheTtlMs: 30 * 60 * 1000,
      mockFallback: () => {
        if (part === "part_2") {
          return {
            partTitle: `Speaking Part 2 Cue Card — ${topic}`,
            cueCardBullets: [
              "When and where this experience took place",
              "Who was involved with you",
              "What made it memorable or challenging",
              "And explain how you felt about it afterwards",
            ],
            items: [
              {
                question: `Describe a memorable experience related to ${topic}.`,
                band8Answer: `I'd like to share a truly rewarding experience I had regarding ${topic} about a year ago. At that time, I was juggling a fairly intense study schedule and wanted to step outside my comfort zone. Together with two close classmates, I joined a weekend community project that pushed us to communicate clearly and solve unexpected logistical hiccups on the spot. Looking back, what stood out most wasn't just the final outcome, but the genuine camaraderie we built along the way. It left me feeling far more self-assured and eager to embrace similar challenges in the future.`,
                vocabTips: ["step outside my comfort zone", "logistical hiccups", "genuine camaraderie", "self-assured"],
                strategyVi: "Kể theo mạch thời gian Quá khứ (bối cảnh) → Cao trào (sự kiện) → Suy ngẫm (bài học) để giữ mạch 2 phút tự nhiên.",
              },
            ],
          };
        }
        if (part === "part_3") {
          return {
            partTitle: `Speaking Part 3 Discussion — ${topic}`,
            items: [
              {
                question: `How have attitudes toward ${topic} changed across generations in Vietnam?`,
                band8Answer: `There has been a striking generational shift. Older generations typically prioritized stability and practical necessity, whereas younger Vietnamese adults increasingly value personal fulfillment, digital convenience, and sustainability when engaging with ${topic}.`,
                vocabTips: ["striking generational shift", "practical necessity", "personal fulfillment"],
                strategyVi: "So sánh 2 thế hệ bằng cấu trúc đối lập 'whereas' để nâng điểm Coherence & Grammar.",
              },
              {
                question: `Should local authorities play a larger role in supporting ${topic}?`,
                band8Answer: `To a certain extent, yes. While individual initiative matters enormously, targeted municipal investment in infrastructure and public awareness campaigns ensures that benefits reach rural communities rather than remaining concentrated in major cities.`,
                vocabTips: ["to a certain extent", "targeted municipal investment", "public awareness campaigns"],
                strategyVi: "Mở đầu bằng cách trả lời cân bằng ('To a certain extent') thay vì 'Yes/No' đơn thuần.",
              },
            ],
          };
        }
        return {
          partTitle: `Speaking Part 1 Q&A — ${topic}`,
          items: [
            {
              question: `Do you spend much time on ${topic} these days?`,
              band8Answer: `Quite a bit, actually! Whenever my weekday schedule eases up, I try to carve out at least thirty minutes for ${topic} because it keeps my mind refreshed and breaks up my routine.`,
              vocabTips: ["carve out time", "keeps my mind refreshed", "breaks up my routine"],
              strategyVi: "Áp dụng công thức A–R–E (Trả lời → Lý do → Chi tiết) trong 2–3 câu gọn tự nhiên.",
            },
            {
              question: `Was ${topic} popular in your hometown when you were growing up?`,
              band8Answer: `Definitely. Back in high school, almost everyone in my neighborhood was into it, although back then people enjoyed it in a much simpler, offline way compared to today.`,
              vocabTips: ["back in high school", "was into it", "compared to today"],
              strategyVi: "Kết hợp khéo léo thì quá khứ đơn ('was') và đối chiếu hiện tại để thể hiện độ linh hoạt ngữ pháp.",
            },
          ],
        };
      },
    });

    return NextResponse.json({
      ok: true,
      result: aiRes.data,
      mocked: aiRes.mocked,
    });
  } catch {
    return NextResponse.json({ error: "Không thể tạo bộ câu hỏi mẫu." }, { status: 500 });
  }
}
