import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { readStore, updateStore } from "@/lib/store";

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
  const store = readStore();
  const userId = user?.id ?? "demo-free-001";

  const sets = store.flashcard_sets.filter(
    (s) => s.user_id === userId || s.is_public
  );
  const allowedSetIds = new Set(sets.map((s) => s.id));
  const cards = store.flashcards.filter(
    (c) => c.user_id === userId || allowedSetIds.has(c.set_id)
  );

  return NextResponse.json({ sets, cards });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Vui lòng nhập đầy đủ từ vựng và nghĩa tiếng Việt." },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    const userId = user?.id ?? "demo-free-001";
    const data = parsed.data;

    const result = updateStore((store) => {
      let targetSetId = data.set_id;
      if (data.new_set_title && data.new_set_title.length > 0) {
        const newSet = {
          id: `set-${Date.now()}`,
          user_id: userId,
          title: data.new_set_title,
          description: "Bộ thẻ tự tạo từ công cụ lưu nhanh Ôn IELTS",
          is_public: false,
          created_at: new Date().toISOString(),
        };
        store.flashcard_sets.unshift(newSet);
        targetSetId = newSet.id;
      } else if (!targetSetId || !store.flashcard_sets.some((s) => s.id === targetSetId)) {
        const firstOwned = store.flashcard_sets.find((s) => s.user_id === userId);
        if (firstOwned) {
          targetSetId = firstOwned.id;
        } else {
          const fallbackSet = {
            id: `set-${Date.now()}`,
            user_id: userId,
            title: "Từ vựng IELTS của tôi",
            description: "Các từ mới lưu trong quá trình ôn luyện",
            is_public: false,
            created_at: new Date().toISOString(),
          };
          store.flashcard_sets.unshift(fallbackSet);
          targetSetId = fallbackSet.id;
        }
      }

      const card = {
        id: `fc-${Date.now()}`,
        set_id: targetSetId!,
        user_id: userId,
        term: data.term,
        phonetic: data.phonetic,
        part_of_speech: data.part_of_speech,
        definition_vi: data.definition_vi,
        definition_en: data.definition_en,
        example_sentence: data.example_sentence,
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      store.flashcards.unshift(card);
      return { card, setId: targetSetId };
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Không thể lưu thẻ" }, { status: 500 });
  }
}
