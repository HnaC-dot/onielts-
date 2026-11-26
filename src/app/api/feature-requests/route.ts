import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  createFeatureRequest,
  getFeatureRequests,
  voteFeatureRequest,
} from "@/lib/db";

const createSchema = z.object({
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().min(8).max(1000),
});

const voteSchema = z.object({
  id: z.string().min(1),
});

export async function GET() {
  const items = await getFeatureRequests();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Tiêu đề hoặc mô tả quá ngắn." },
        { status: 400 }
      );
    }
    const user = await getCurrentUser();
    const item = await createFeatureRequest({
      userId: user?.id ?? null,
      email: user?.email ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
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
    const updated = await voteFeatureRequest(parsed.data.id);
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, item: updated });
  } catch {
    return NextResponse.json({ error: "Lỗi máy chủ" }, { status: 500 });
  }
}
