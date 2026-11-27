import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserProgressHistory } from "@/lib/progress-analytics";
import type { HistorySkillFilter } from "@/lib/progress-shared";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_SKILLS = new Set<HistorySkillFilter>([
  "all",
  "reading",
  "listening",
  "writing",
  "speaking",
  "daily",
]);

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập để xem lịch sử làm bài." },
      { status: 401 }
    );
  }

  const rate = await checkRateLimit(
    `progress-history:${getRequestClientKey(req, user.id)}`,
    40,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Vui lòng thử lại sau ${rate.retryAfterSec} giây.` },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const rawSkill = (searchParams.get("skill") ?? "all") as HistorySkillFilter;
  const skill: HistorySkillFilter = ALLOWED_SKILLS.has(rawSkill) ? rawSkill : "all";
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "10", 10) || 10;

  const data = await getUserProgressHistory(user.id, {
    skill,
    page,
    pageSize,
  });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
