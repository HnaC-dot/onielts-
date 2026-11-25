import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  createOrFindDemoEmailUser,
  DEMO_USER_COOKIE,
  getCurrentUser,
  REFERRAL_COOKIE,
} from "@/lib/auth";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { readStore } from "@/lib/store";

const authActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("demo_switch"),
    userId: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal("send_otp"),
    email: z.string().email().max(200),
  }),
  z.object({
    action: z.literal("verify_otp"),
    email: z.string().email().max(200),
    code: z.string().min(6).max(6),
  }),
  z.object({
    action: z.literal("logout"),
  }),
]);

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    user,
    supabaseConfigured: isSupabaseConfigured(),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = authActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.action === "logout") {
      if (isSupabaseConfigured()) {
        const supabase = await createSupabaseServerClient();
        await supabase?.auth.signOut();
      }
      const res = NextResponse.json({ ok: true });
      res.cookies.set(DEMO_USER_COOKIE, "logged_out", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    if (data.action === "demo_switch") {
      const store = readStore();
      const target = store.profiles.find((p) => p.id === data.userId);
      if (!target) {
        return NextResponse.json({ error: "Không tìm thấy tài khoản mẫu" }, { status: 404 });
      }
      const res = NextResponse.json({ ok: true, user: target });
      res.cookies.set(DEMO_USER_COOKIE, target.id, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    if (data.action === "send_otp") {
      if (isSupabaseConfigured()) {
        const supabase = await createSupabaseServerClient();
        if (supabase) {
          const { error } = await supabase.auth.signInWithOtp({
            email: data.email,
            options: { shouldCreateUser: true },
          });
          if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
          return NextResponse.json({
            ok: true,
            mode: "supabase",
            message: "Đã gửi mã OTP tới email của bạn.",
          });
        }
      }
      return NextResponse.json({
        ok: true,
        mode: "demo",
        demoOtp: "123456",
        message: "Chế độ dùng thử cục bộ: nhập mã OTP 123456 để đăng nhập.",
      });
    }

    if (data.action === "verify_otp") {
      if (isSupabaseConfigured()) {
        const supabase = await createSupabaseServerClient();
        if (supabase) {
          const { error } = await supabase.auth.verifyOtp({
            email: data.email,
            token: data.code,
            type: "email",
          });
          if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
          return NextResponse.json({ ok: true, mode: "supabase" });
        }
      }

      if (data.code !== "123456") {
        return NextResponse.json(
          { error: "Mã OTP không đúng (mã dùng thử cục bộ là 123456)" },
          { status: 400 }
        );
      }

      const cookieStore = await cookies();
      const refCode = cookieStore.get(REFERRAL_COOKIE)?.value ?? null;
      const user = createOrFindDemoEmailUser(data.email, refCode);
      const res = NextResponse.json({ ok: true, user, mode: "demo" });
      res.cookies.set(DEMO_USER_COOKIE, user.id, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Lỗi xử lý yêu cầu" }, { status: 500 });
  }
}
