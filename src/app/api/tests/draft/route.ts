import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySameOrigin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import type { ExamDraftPayload, ExamTextAnnotation } from "@/lib/exam-session";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { readStore, updateStore } from "@/lib/store";
import {
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,119}$/;
const MODE_KEY_REGEX = /^[a-z0-9:_-]{1,120}$/i;

const annotationSchema = z.object({
  id: z.string().min(1).max(80),
  sectionId: z.string().min(1).max(120),
  paragraphIndex: z.number().int().min(0).max(500),
  startOffset: z.number().int().min(0).max(50000),
  endOffset: z.number().int().min(0).max(50000),
  text: z.string().max(1000),
  color: z.enum(["amber", "sky", "emerald", "rose"]).default("amber"),
  note: z.string().max(1000).optional(),
  createdAt: z.string().max(64).optional(),
});

const putDraftSchema = z.object({
  testSlug: z.string().regex(SLUG_REGEX),
  modeKey: z.string().regex(MODE_KEY_REGEX).default("full"),
  answers: z
    .record(z.string().max(120), z.string().max(500))
    .refine((obj) => Object.keys(obj).length <= 120, "Too many answers")
    .default({}),
  flagged: z
    .record(z.string().max(120), z.boolean())
    .refine((obj) => Object.keys(obj).length <= 120, "Too many flags")
    .default({}),
  annotations: z.array(annotationSchema).max(250).default([]),
  notesText: z.string().max(10_000).default(""),
  timerSeconds: z.number().int().min(0).max(86_400).default(0),
  activeSectionIdx: z.number().int().min(0).max(50).default(0),
});

interface DraftDbRow {
  test_slug: string;
  mode_key: string;
  answers: Record<string, string> | null;
  flagged: Record<string, boolean> | null;
  annotations: ExamTextAnnotation[] | null;
  notes_text: string | null;
  timer_seconds: number | null;
  active_section_idx: number | null;
  updated_at: string | null;
}

function isMissingDraftTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("test_session_drafts") &&
    (msg.includes("does not exist") || msg.includes("could not find the table"))
  );
}

function mapRowToDraft(row: DraftDbRow): ExamDraftPayload {
  return {
    testSlug: row.test_slug,
    modeKey: row.mode_key || "full",
    answers: row.answers && typeof row.answers === "object" ? row.answers : {},
    flagged: row.flagged && typeof row.flagged === "object" ? row.flagged : {},
    annotations: Array.isArray(row.annotations) ? row.annotations : [],
    notesText: typeof row.notes_text === "string" ? row.notes_text : "",
    timerSeconds:
      typeof row.timer_seconds === "number" && Number.isFinite(row.timer_seconds)
        ? Math.max(0, Math.floor(row.timer_seconds))
        : 0,
    activeSectionIdx:
      typeof row.active_section_idx === "number" &&
      Number.isFinite(row.active_section_idx)
        ? Math.max(0, Math.floor(row.active_section_idx))
        : 0,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

function parseQueryParams(req: Request): { testSlug: string; modeKey: string } | null {
  const { searchParams } = new URL(req.url);
  const testSlug = (searchParams.get("testSlug") ?? "").trim();
  const modeKey = (searchParams.get("modeKey") ?? "full").trim() || "full";
  if (!SLUG_REGEX.test(testSlug) || !MODE_KEY_REGEX.test(modeKey)) {
    return null;
  }
  return { testSlug, modeKey };
}

export async function GET(req: Request) {
  const params = parseQueryParams(req);
  if (!params) {
    return NextResponse.json(
      { error: "Tham số testSlug hoặc modeKey không hợp lệ." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: true, authenticated: false, tableReady: true, draft: null },
      { headers: NO_STORE_HEADERS }
    );
  }

  try {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        return NextResponse.json(
          { ok: true, authenticated: true, tableReady: false, draft: null },
          { headers: NO_STORE_HEADERS }
        );
      }

      const { data, error } = await supabase
        .from("test_session_drafts")
        .select(
          "test_slug, mode_key, answers, flagged, annotations, notes_text, timer_seconds, active_section_idx, updated_at"
        )
        .eq("user_id", user.id)
        .eq("test_slug", params.testSlug)
        .eq("mode_key", params.modeKey)
        .maybeSingle();

      if (error) {
        if (isMissingDraftTableError(error)) {
          return NextResponse.json(
            { ok: true, authenticated: true, tableReady: false, draft: null },
            { headers: NO_STORE_HEADERS }
          );
        }
        return NextResponse.json(
          { error: "Không thể tải bản nháp bài làm." },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          authenticated: true,
          tableReady: true,
          draft: data ? mapRowToDraft(data as DraftDbRow) : null,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // Local store mode (dev / unit tests)
    const store = readStore();
    const found = (store.test_session_drafts ?? []).find(
      (d) =>
        d.userId === user.id &&
        d.testSlug === params.testSlug &&
        d.modeKey === params.modeKey
    );

    const draft: ExamDraftPayload | null = found
      ? {
          testSlug: found.testSlug,
          modeKey: found.modeKey,
          answers: found.answers,
          flagged: found.flagged,
          annotations: found.annotations,
          notesText: found.notesText,
          timerSeconds: found.timerSeconds,
          activeSectionIdx: found.activeSectionIdx,
          updatedAt: found.updatedAt,
        }
      : null;

    return NextResponse.json(
      { ok: true, authenticated: true, tableReady: true, draft },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { error: "Lỗi tải bản nháp bài làm." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PUT(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập để đồng bộ bản nháp." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const rate = await checkRateLimit(
    `test-draft:${getRequestClientKey(req, user.id)}`,
    60,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Bạn lưu nháp quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
      },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const jsonResult = await readJsonBody(req);
    if (!jsonResult.ok) return jsonResult.response;

    const parsed = putDraftSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu bản nháp không hợp lệ." },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const nowIso = new Date().toISOString();
    const payload = parsed.data;

    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        return NextResponse.json(
          { ok: true, saved: false, tableReady: false, updatedAt: nowIso },
          { headers: NO_STORE_HEADERS }
        );
      }

      const { data, error } = await supabase
        .from("test_session_drafts")
        .upsert(
          {
            user_id: user.id,
            test_slug: payload.testSlug,
            mode_key: payload.modeKey,
            answers: payload.answers,
            flagged: payload.flagged,
            annotations: payload.annotations,
            notes_text: payload.notesText,
            timer_seconds: payload.timerSeconds,
            active_section_idx: payload.activeSectionIdx,
            updated_at: nowIso,
          },
          { onConflict: "user_id,test_slug,mode_key" }
        )
        .select("updated_at")
        .single();

      if (error) {
        if (isMissingDraftTableError(error)) {
          return NextResponse.json(
            { ok: true, saved: false, tableReady: false, updatedAt: nowIso },
            { headers: NO_STORE_HEADERS }
          );
        }
        return NextResponse.json(
          { error: "Không thể đồng bộ bản nháp lên máy chủ." },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      return NextResponse.json(
        {
          ok: true,
          saved: true,
          tableReady: true,
          updatedAt: (data as { updated_at?: string } | null)?.updated_at ?? nowIso,
        },
        { headers: NO_STORE_HEADERS }
      );
    }

    // Local store mode
    updateStore((draft) => {
      if (!Array.isArray(draft.test_session_drafts)) {
        draft.test_session_drafts = [];
      }
      const existingIdx = draft.test_session_drafts.findIndex(
        (d) =>
          d.userId === user.id &&
          d.testSlug === payload.testSlug &&
          d.modeKey === payload.modeKey
      );
      const record = {
        userId: user.id,
        testSlug: payload.testSlug,
        modeKey: payload.modeKey,
        answers: payload.answers,
        flagged: payload.flagged,
        annotations: payload.annotations,
        notesText: payload.notesText,
        timerSeconds: payload.timerSeconds,
        activeSectionIdx: payload.activeSectionIdx,
        updatedAt: nowIso,
      };
      if (existingIdx >= 0) {
        draft.test_session_drafts[existingIdx] = record;
      } else {
        draft.test_session_drafts.push(record);
      }
    });

    return NextResponse.json(
      { ok: true, saved: true, tableReady: true, updatedAt: nowIso },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { error: "Lỗi đồng bộ bản nháp bài làm." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403, headers: NO_STORE_HEADERS }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Vui lòng đăng nhập." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const params = parseQueryParams(req);
  if (!params) {
    return NextResponse.json(
      { error: "Tham số testSlug hoặc modeKey không hợp lệ." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const rate = await checkRateLimit(
    `test-draft-del:${getRequestClientKey(req, user.id)}`,
    30,
    60_000
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
      },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  try {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      if (!supabase) {
        return NextResponse.json(
          { ok: true, deleted: false, tableReady: false },
          { headers: NO_STORE_HEADERS }
        );
      }
      const { error } = await supabase
        .from("test_session_drafts")
        .delete()
        .eq("user_id", user.id)
        .eq("test_slug", params.testSlug)
        .eq("mode_key", params.modeKey);

      if (error && !isMissingDraftTableError(error)) {
        return NextResponse.json(
          { error: "Không thể xóa bản nháp bài làm." },
          { status: 500, headers: NO_STORE_HEADERS }
        );
      }

      return NextResponse.json(
        { ok: true, deleted: true, tableReady: !error },
        { headers: NO_STORE_HEADERS }
      );
    }

    updateStore((draft) => {
      if (!Array.isArray(draft.test_session_drafts)) return;
      draft.test_session_drafts = draft.test_session_drafts.filter(
        (d) =>
          !(
            d.userId === user.id &&
            d.testSlug === params.testSlug &&
            d.modeKey === params.modeKey
          )
      );
    });

    return NextResponse.json(
      { ok: true, deleted: true, tableReady: true },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { error: "Lỗi xóa bản nháp bài làm." },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
