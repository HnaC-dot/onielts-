import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { checkUsageLimit } from "@/lib/usage-limits";
import { generateStructuredAi, sanitizeUserDataForPrompt } from "@/lib/ai";
import { calculateCriterionBand } from "@/lib/band-calculator";
import { updateStore } from "@/lib/store";
import type { SpeakingEvaluation } from "@/lib/types";

export const maxDuration = 60;

// Cap base64 string ~14MB (corresponds to 10MB binary audio)
const evaluateSpeakingSchema = z.object({
  part: z.enum(["part_1", "part_2", "part_3"]),
  promptText: z.string().trim().min(5).max(1500),
  durationSec: z.number().min(1).max(180),
  audioBase64: z.string().max(14_000_000).optional(),
  audioMimeType: z
    .enum(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg", "audio/aac"])
    .optional(),
  transcriptHint: z.string().trim().max(4000).optional(),
});

const speakingEvalSchema: z.ZodType<SpeakingEvaluation> = z.object({
  transcript: z.string().min(1),
  overallBand: z.number().min(0).max(9),
  isReferenceScore: z.literal(true),
  criteria: z.object({
    fluencyCoherence: z.object({ band: z.number().min(0).max(9), feedbackVi: z.string() }),
    lexicalResource: z.object({ band: z.number().min(0).max(9), feedbackVi: z.string() }),
    grammaticalRange: z.object({ band: z.number().min(0).max(9), feedbackVi: z.string() }),
    pronunciation: z.object({
      band: z.number().min(0).max(9),
      feedbackVi: z.string(),
      referenceNoteVi: z.string(),
    }),
  }),
  strengthsVi: z.array(z.string()),
  improvementsVi: z.array(z.string()),
  improvedAnswer: z.string().min(10),
});

function buildMockSpeakingEvaluation(
  part: "part_1" | "part_2" | "part_3",
  promptText: string,
  transcriptHint?: string
): SpeakingEvaluation {
  const transcript =
    transcriptHint?.trim() ||
    (part === "part_2"
      ? "I would like to talk about a quiet riverside park in my hometown where I often go on Sunday mornings. I started visiting it about two years ago when I wanted to jog and escape my busy screen schedule. What makes the park memorable is the long row of old trees and the friendly elderly residents doing morning exercises there. Whenever I spend an hour walking along the water, I feel much calmer and more focused for the coming week."
      : "Honestly, I really enjoy spending my weekends exploring small coffee shops with close friends. It helps me recharge after a demanding week at work, and we usually catch up on books or travel plans.");

  const words = transcript.split(/\s+/).filter(Boolean).length;
  const fc = words >= 45 ? 7.0 : 6.0;
  const lr = words >= 40 ? 6.5 : 6.0;
  const gra = 6.5;
  const pron = 6.5;
  const overall = calculateCriterionBand(fc, lr, gra, pron).band;

  return {
    transcript,
    overallBand: overall,
    isReferenceScore: true,
    criteria: {
      fluencyCoherence: {
        band: fc,
        feedbackVi:
          "Mạch nói tương đối tự nhiên, liên kết ý rõ ràng bằng các từ nối giao tiếp. Hãy giảm ngập ngừng khi chuyển sang ví dụ cụ thể.",
      },
      lexicalResource: {
        band: lr,
        feedbackVi:
          "Dùng được một số cụm tự nhiên (recharge, demanding week). Bổ sung thêm thành ngữ ngữ cảnh nhẹ nhàng và tính từ mô tả sắc thái sẽ nâng lên 7.5.",
      },
      grammaticalRange: {
        band: gra,
        feedbackVi:
          "Sử dụng tốt thì hiện tại đơn và quá khứ đơn; nên xen kẽ thêm câu điều kiện loại 2 hoặc mệnh đề quan hệ để tăng độ đa dạng.",
      },
      pronunciation: {
        band: pron,
        feedbackVi:
          "Rõ chữ và dễ hiểu. Chú ý bật rõ âm cuối /t/, /d/, /s/ ở cuối cụm từ và nhấn trọng âm rõ vào từ mang nghĩa chính.",
        referenceNoteVi:
          "Điểm Phát âm là điểm tham khảo ước lượng từ AI, không thay thế giám khảo chính thức.",
      },
    },
    strengthsVi: [
      "Trả lời trực tiếp trọng tâm câu hỏi và mở rộng có lý do cụ thể.",
      "Giữ được ngữ điệu tự nhiên, không bị cảm giác học thuộc lòng máy móc.",
    ],
    improvementsVi: [
      "Chú ý bật âm cuối (-ed, -s) rõ ràng hơn khi nói nhanh.",
      `Mở rộng thêm một góc nhìn đối lập nhẹ cho chủ đề: "${promptText.slice(0, 60)}..."`,
    ],
    improvedAnswer:
      part === "part_2"
        ? "One place I'm genuinely fond of is a tranquil riverside park just ten minutes from my home. I first discovered it a couple of years ago while looking for a peaceful spot to jog before work. What makes it truly stand out is the canopy of mature trees lining the walkway and the warm sense of community—you always see retirees practicing tai chi alongside university students sketching by the water. Spending even half an hour there completely clears my head and reminds me to slow down amidst the pace of city life."
        : "To be honest, I'm quite keen on spending Sunday afternoons at cozy neighborhood cafés with a couple of close friends. After a hectic week staring at spreadsheets, it's a lovely way to unwind, trade book recommendations, and feel recharged before Monday rolls around.",
  };
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = checkRateLimit(clientKey, 15, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Vui lòng chờ ${rate.retryAfterSec} giây trước khi chấm tiếp.` },
      { status: 429 }
    );
  }

  const usage = checkUsageLimit(user, "speaking_eval", clientKey);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: "Bạn đã dùng hết 2 lượt chấm Speaking miễn phí trong tháng này.",
        limitReached: true,
        usage,
      },
      { status: 402 }
    );
  }

  try {
    const body = await req.json();
    const parsed = evaluateSpeakingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu bài nói không hợp lệ." },
        { status: 400 }
      );
    }

    const { part, promptText, durationSec, audioBase64, audioMimeType, transcriptHint } =
      parsed.data;

    if (!audioBase64 && (!transcriptHint || transcriptHint.length < 15)) {
      return NextResponse.json(
        { error: "Vui lòng ghi âm, tải tệp âm thanh hoặc nhập câu trả lời tối thiểu 15 ký tự." },
        { status: 400 }
      );
    }

    const safePrompt = sanitizeUserDataForPrompt(promptText, 1500);
    const safeTranscript = transcriptHint
      ? sanitizeUserDataForPrompt(transcriptHint, 4000)
      : "Transcribe directly from attached learner audio.";

    const aiRes = await generateStructuredAi({
      feature: "speaking:evaluate",
      skill: "speaking",
      userId: user?.id ?? clientKey,
      systemPrompt: `You are an IELTS Speaking Examiner evaluating a Vietnamese learner (${part}).
If audio is attached, transcribe it accurately first, then evaluate Fluency & Coherence (FC), Lexical Resource (LR), Grammatical Range & Accuracy (GRA), and Pronunciation (clearly noting Pronunciation is an AI reference estimate — "điểm tham khảo").
Provide actionable Vietnamese feedback and a natural Band 8.0+ improved spoken answer.`,
      userPrompt: `Part: ${part}\nDuration: ${durationSec}s\nQuestion:\n${safePrompt}\n\nLearner Transcript / Audio:\n${safeTranscript}`,
      schema: speakingEvalSchema,
      jsonSchemaHint: `{
  "transcript": "string",
  "overallBand": number,
  "isReferenceScore": true,
  "criteria": {
    "fluencyCoherence": { "band": number, "feedbackVi": "string" },
    "lexicalResource": { "band": number, "feedbackVi": "string" },
    "grammaticalRange": { "band": number, "feedbackVi": "string" },
    "pronunciation": { "band": number, "feedbackVi": "string", "referenceNoteVi": "Điểm tham khảo ước lượng từ AI" }
  },
  "strengthsVi": ["string"],
  "improvementsVi": ["string"],
  "improvedAnswer": "string"
}`,
      inlineMedia:
        audioBase64 && audioMimeType
          ? { mimeType: audioMimeType, base64Data: audioBase64 }
          : undefined,
      mockFallback: () => buildMockSpeakingEvaluation(part, promptText, transcriptHint),
    });

    const submission = updateStore((store) => {
      const record = {
        id: `ss-${Date.now()}`,
        user_id: user?.id ?? "demo-free-001",
        part,
        prompt_text: promptText,
        audio_duration_sec: durationSec,
        transcript: aiRes.data.transcript,
        overall_band: aiRes.data.overallBand,
        evaluation: aiRes.data,
        is_public: false,
        created_at: new Date().toISOString(),
      };
      store.speaking_submissions.unshift(record);
      return record;
    });

    return NextResponse.json({
      ok: true,
      submission,
      usage: checkUsageLimit(user, "speaking_eval", clientKey),
      mocked: aiRes.mocked,
    });
  } catch {
    return NextResponse.json({ error: "Không thể chấm bài Speaking lúc này." }, { status: 500 });
  }
}
