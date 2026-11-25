import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { checkUsageLimit } from "@/lib/usage-limits";
import { generateStructuredAi, sanitizeUserDataForPrompt } from "@/lib/ai";

export const maxDuration = 60;

const reqSchema = z.object({
  taskType: z.enum(["academic_t1", "general_t1", "task_2"]),
  topic: z.string().trim().min(5, "Vui lòng nhập đề bài cụ thể hơn.").max(1500),
  stance: z.string().max(120).optional().default("balanced"),
});

const sampleOutputSchema = z.object({
  title: z.string(),
  outlineVi: z.array(z.string()),
  sampleEssay: z.string(),
  wordCount: z.number(),
  keyVocab: z.array(
    z.object({
      phrase: z.string(),
      meaningVi: z.string(),
    })
  ),
  examinerNoteVi: z.string(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = checkRateLimit(clientKey, 15, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Vui lòng chờ một lát rồi thử lại." }, { status: 429 });
  }

  const usage = checkUsageLimit(user, "generator", clientKey);
  if (!usage.allowed) {
    return NextResponse.json(
      { error: "Đã hết lượt tạo bài mẫu miễn phí hôm nay.", limitReached: true, usage },
      { status: 402 }
    );
  }

  try {
    const body = await req.json();
    const parsed = reqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Đề bài không hợp lệ" },
        { status: 400 }
      );
    }

    const { taskType, topic, stance } = parsed.data;
    const safeTopic = sanitizeUserDataForPrompt(topic, 1500);

    const aiRes = await generateStructuredAi({
      feature: "writing:generate",
      skill: "writing",
      userId: user?.id ?? clientKey,
      systemPrompt:
        "You are a Band 9.0 IELTS Writing author. Write a 100% original Band 9 model response for the requested task type and topic, plus a concise Vietnamese outline, 5 C1/C2 vocabulary phrases with Vietnamese meanings, and an examiner note in Vietnamese.",
      userPrompt: `Task Type: ${taskType}\nStance/Style: ${stance}\nTopic:\n${safeTopic}`,
      schema: sampleOutputSchema,
      jsonSchemaHint: `{
  "title": "string",
  "outlineVi": ["string"],
  "sampleEssay": "string",
  "wordCount": number,
  "keyVocab": [{ "phrase": "string", "meaningVi": "string" }],
  "examinerNoteVi": "string"
}`,
      cacheTtlMs: 30 * 60 * 1000,
      mockFallback: () => {
        const sampleEssay =
          taskType === "academic_t1"
            ? "The illustration compares how urban commuters allocated travel modes across four surveyed years. Overall, private car usage declined steadily while public rail and cycling recorded substantial growth throughout the period.\n\nIn the initial year, automobiles dominated daily journeys, accounting for more than half of all trips. However, following targeted congestion charges and expanded metro lines, car reliance dropped noticeably over the subsequent decade.\n\nConversely, rail patronage climbed steeply to become the single largest commuting choice by the final year, while dedicated bicycle corridors helped double active cycling participation among younger residents."
            : taskType === "general_t1"
            ? "Dear Municipal Council,\n\nI am writing as a long-term resident of District 3 to propose the creation of a shaded pedestrian path along our main riverside boulevard.\n\nCurrently, commuters and elderly walkers share narrow sidewalks with parked motorbikes, creating both safety hazards and congestion during peak hours. Installing dedicated pedestrian barriers, native shade trees, and solar lighting would transform the area into an inviting public space.\n\nI would be pleased to join any upcoming neighborhood consultation to discuss practical implementation steps.\n\nYours sincerely,\nTran Hoang Nam"
            : "Rapid advances in artificial intelligence and automation are reshaping both higher education and modern workplaces. While some fear that technological reliance could erode independent thinking, I firmly believe that thoughtful integration delivers far greater benefits when paired with strong ethical guidelines.\n\nAdmittedly, over-dependence on automated tools poses genuine educational risks. If students delegate essay planning or mathematical reasoning entirely to software, they may miss the cognitive struggle required to build durable analytical judgment. Addressing this requires universities to redesign assessments around oral defense, collaborative projects, and process-based feedback.\n\nNevertheless, the constructive potential of well-governed AI is transformative. Adaptive study platforms enable learners from rural or under-resourced communities to receive immediate, personalized feedback on writing and pronunciation—resources that were once accessible only through costly private tutoring. When educators guide learners to treat AI as a reflective sparring partner rather than a shortcut, overall proficiency rises markedly.\n\nIn conclusion, technology itself neither diminishes nor guarantees human intellect; its impact hinges on pedagogical design. By cultivating critical literacy alongside digital fluency, societies can harness innovation to widen educational opportunity.";

        return {
          title: `Bài mẫu Band 9.0 (${taskType.replace("_", " ").toUpperCase()})`,
          outlineVi: [
            "Mở bài: Diễn đạt lại (paraphrase) bối cảnh đề bài và nêu lập trường rõ ràng ngay từ câu thứ 2.",
            "Thân bài 1: Phân tích góc nhìn đối lập / xu hướng chính thứ nhất kèm giải thích sâu.",
            "Thân bài 2: Phát triển luận điểm trọng tâm kèm dẫn chứng thực tế sắc bén.",
            "Kết bài: Tổng hợp quan điểm cô đọng, không đưa ý mới.",
          ],
          sampleEssay,
          wordCount: sampleEssay.split(/\s+/).length,
          keyVocab: [
            { phrase: "thoughtful integration", meaningVi: "sự tích hợp có cân nhắc, bài bản" },
            { phrase: "cognitive struggle", meaningVi: "quá trình rèn luyện tư duy vượt thử thách" },
            { phrase: "durable analytical judgment", meaningVi: "năng lực đánh giá phân tích bền vững" },
            { phrase: "reflective sparring partner", meaningVi: "người đồng hành phản biện giúp tự soi chiếu" },
            { phrase: "widen educational opportunity", meaningVi: "mở rộng cơ hội tiếp cận giáo dục" },
          ],
          examinerNoteVi:
            "Bài mẫu đạt Band 9.0 nhờ mạch lập luận nhượng bộ (Admittedly... Nevertheless...), từ vựng collocation tự nhiên không gượng ép và đa dạng cấu trúc câu phức.",
        };
      },
    });

    return NextResponse.json({
      ok: true,
      sample: aiRes.data,
      usage: checkUsageLimit(user, "generator", clientKey),
      mocked: aiRes.mocked,
    });
  } catch {
    return NextResponse.json({ error: "Không thể tạo bài mẫu lúc này." }, { status: 500 });
  }
}
