import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { readJsonBody } from "@/lib/request-json";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { createFlashcardItem, getFlashcardsForUser } from "@/lib/db";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

const createCardSchema = z.object({
  term: z.string().trim().min(1).max(120),
  phonetic: z.string().trim().max(120).optional().default(""),
  part_of_speech: z.string().trim().max(60).optional().default(""),
  definition_vi: z.string().trim().min(1).max(400),
  definition_en: z.string().trim().max(400).optional().default(""),
  example_sentence: z.string().trim().max(500).optional().default(""),
  set_id: z.string().trim().max(100).optional(),
  new_set_title: z.string().trim().max(120).optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  const data = await getFlashcardsForUser(user?.id ?? null);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  try {
    const user = await getCurrentUser();
    if (isSupabaseConfigured() && !user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập để lưu Flashcard vào tài khoản của bạn." },
        { status: 401 }
      );
    }

    const rate = await checkRateLimit(
      `fc-create:${getRequestClientKey(req, user?.id)}`,
      30,
      60_000
    );
    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Bạn tạo thẻ quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
        },
        { status: 429 }
      );
    }

    const jsonResult = await readJsonBody(req);
    if (!jsonResult.ok) return jsonResult.response;
    const parsed = createCardSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ từ vựng và nghĩa tiếng Việt." },
        { status: 400 }
      );
    }

    const result = await createFlashcardItem(user?.id ?? null, parsed.data);
    if (!result) {
      if (parsed.data.set_id) {
        return NextResponse.json(
          { error: "Bộ thẻ không tồn tại hoặc không thuộc quyền sở hữu của bạn." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Không thể lưu thẻ" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Không thể lưu thẻ" }, { status: 500 });
  }
}
