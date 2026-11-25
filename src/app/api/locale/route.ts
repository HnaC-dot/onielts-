import { NextResponse } from "next/server";
import { z } from "zod";
import { LOCALE_COOKIE } from "@/i18n/request";

const schema = z.object({
  locale: z.enum(["vi", "en"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }
    const res = NextResponse.json({ ok: true, locale: parsed.data.locale });
    res.cookies.set(LOCALE_COOKIE, parsed.data.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
