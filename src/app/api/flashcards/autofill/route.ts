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

export const maxDuration = 30;

const reqSchema = z.object({
  term: z.string().trim().min(1).max(120),
});

const flashcardFillSchema = z.object({
  phonetic: z.string(),
  part_of_speech: z.string(),
  definition_vi: z.string(),
  definition_en: z.string(),
  example_sentence: z.string(),
});

const BUILTIN_LEXICON: Record<string, z.infer<typeof flashcardFillSchema>> = {
  mitigate: {
    phonetic: "/ˈmɪtɪɡeɪt/",
    part_of_speech: "verb",
    definition_vi: "giảm nhẹ, làm dịu bớt mức độ nghiêm trọng",
    definition_en: "make less severe, serious, or painful",
    example_sentence: "Urban green roofs help mitigate extreme summer heat in dense cities.",
  },
  sustainable: {
    phonetic: "/səˈsteɪnəbl/",
    part_of_speech: "adjective",
    definition_vi: "bền vững, có thể duy trì lâu dài không gây hại môi trường",
    definition_en: "able to be maintained without depleting natural resources",
    example_sentence: "Investing in public rail is essential for sustainable urban mobility.",
  },
  exacerbate: {
    phonetic: "/ɪɡˈzæsəbeɪt/",
    part_of_speech: "verb",
    definition_vi: "làm trầm trọng thêm một vấn đề đang có",
    definition_en: "make an existing problem or negative situation worse",
    example_sentence: "Rising fuel prices could exacerbate household living costs.",
  },
  paraphrase: {
    phonetic: "/ˈpærəfreɪz/",
    part_of_speech: "verb / noun",
    definition_vi: "diễn đạt lại một ý bằng từ ngữ và cấu trúc khác",
    definition_en: "express the same meaning using different words",
    example_sentence: "Strong IELTS candidates paraphrase the prompt naturally in their introduction.",
  },
  urbanization: {
    phonetic: "/ˌɜːbənaɪˈzeɪʃn/",
    part_of_speech: "noun",
    definition_vi: "quá trình đô thị hóa",
    definition_en: "the process of making an area more urban as populations shift to cities",
    example_sentence: "Rapid urbanization has transformed coastal towns across Vietnam.",
  },
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = await checkRateLimit(clientKey, 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu, vui lòng đợi vài giây." }, { status: 429 });
  }

  let rawTerm: string;
  try {
    const body = await req.json();
    const parsed = reqSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Từ vựng không hợp lệ" }, { status: 400 });
    }
    rawTerm = parsed.data.term;
  } catch {
    return NextResponse.json({ error: "Từ vựng không hợp lệ" }, { status: 400 });
  }

  const key = rawTerm.toLowerCase();

  // Serve verified built-in dictionary terms instantly without spending AI quota or calling Gemini
  if (BUILTIN_LEXICON[key]) {
    return NextResponse.json({
      term: rawTerm,
      ...BUILTIN_LEXICON[key],
      mocked: false,
      cached: true,
    });
  }

  const reservation = await reserveUsageLimit({
    user,
    feature: "flashcard_autofill",
    rawFeatureName: "flashcard:autofill",
    skill: "vocabulary",
    model: getActiveGeminiModel(),
    fallbackActorId: clientKey,
  });
  if (!reservation.allowed) {
    return buildQuotaDeniedResponse(reservation);
  }

  try {
    const aiRes = await generateStructuredAi({
      feature: "flashcard:autofill",
      skill: "vocabulary",
      userId: user?.id ?? clientKey,
      reservationId: reservation.reservationId,
      systemPrompt:
        "You are an IELTS English-Vietnamese lexicographer. For the given English word or phrase, return accurate British IPA phonetics, part of speech, clear Vietnamese meaning, concise English definition, and one original Band 8 IELTS example sentence.",
      userPrompt: `Define this vocabulary item:\n${sanitizeUserDataForPrompt(rawTerm, 120)}`,
      schema: flashcardFillSchema,
      jsonSchemaHint: `{
  "phonetic": "/.../",
  "part_of_speech": "verb | noun | adjective | phrase",
  "definition_vi": "clear Vietnamese meaning",
  "definition_en": "short English definition",
  "example_sentence": "original IELTS sentence"
}`,
      cacheTtlMs: 24 * 60 * 60 * 1000,
      mockFallback: () => ({
        phonetic: `/${key.replace(/\s+/g, " ")}/`,
        part_of_speech: rawTerm.includes(" ") ? "phrase" : "vocabulary",
        definition_vi: `Thuật ngữ tiếng Anh "${rawTerm}" (gợi ý tự động — chỉnh sửa theo ngữ cảnh bài học)`,
        definition_en: `Academic IELTS expression: ${rawTerm}`,
        example_sentence: `Mastering "${rawTerm}" accurately helps strengthen IELTS Writing and Speaking expression.`,
      }),
    });

    return NextResponse.json({
      term: rawTerm,
      ...aiRes.data,
      cached: aiRes.cached,
      mocked: aiRes.mocked,
    });
  } catch (err) {
    await releaseAiQuotaRecord(reservation.reservationId).catch(() => {});
    return buildAiErrorResponse(err, "Không thể tự điền dữ liệu lúc này.");
  }
}
