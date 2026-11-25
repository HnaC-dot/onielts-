import { NextResponse } from "next/server";
import { z } from "zod";
import { readStore, updateStore } from "@/lib/store";

const createSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(8).max(1000),
});

const voteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  const store = readStore();
  return NextResponse.json({ items: store.feature_requests });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Tiêu đề hoặc mô tả quá ngắn." }, { status: 400 });
    }
    const item = updateStore((store) => {
      const created = {
        id: `fr-${Date.now()}`,
        title: parsed.data.title,
        description: parsed.data.description,
        votes: 1,
        status: "open" as const,
        created_at: new Date().toISOString(),
      };
      store.feature_requests.unshift(created);
      return created;
    });
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const updated = updateStore((store) => {
      const found = store.feature_requests.find((i) => i.id === parsed.data.id);
      if (!found) return null;
      found.votes += 1;
      return found;
    });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, item: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
