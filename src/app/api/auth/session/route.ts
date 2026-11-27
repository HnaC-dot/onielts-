import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  createOrFindDemoEmailUser,
  DEMO_USER_COOKIE,
  ensureProfileForAuthUser,
  getAuthState,
  isDemoAuthEnabled,
  REFERRAL_COOKIE,
} from "@/lib/auth";
import {
  createSupabaseRouteClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { verifySameOrigin } from "@/lib/admin-auth";
import { verifyBotProtection } from "@/lib/bot-protection";
import {
  checkRateLimit,
  getRequestClientKey,
  getRequestIp,
} from "@/lib/rate-limit";
import { readStore } from "@/lib/store";
import { readJsonBody } from "@/lib/request-json";

const authActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("demo_switch"),
    userId: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal("send_otp"),
    email: z.string().email().max(200),
    turnstileToken: z.string().optional(),
    honeypot: z.string().optional(),
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
  const authState = await getAuthState();
  return NextResponse.json(
    {
      user: authState.user,
      authStatus: authState.status,
      supabaseConfigured: isSupabaseConfigured(),
      demoEnabled: isDemoAuthEnabled(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json(
      { error: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 }
    );
  }

  try {
    const jsonResult = await readJsonBody(req);
    if (!jsonResult.ok) return jsonResult.response;
    const parsed = authActionSchema.safeParse(jsonResult.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.action !== "logout") {
      const rate = await checkRateLimit(
        `auth:${getRequestClientKey(req)}`,
        15,
        60_000
      );
      if (!rate.allowed) {
        return NextResponse.json(
          {
            error: `Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
          },
          { status: 429 }
        );
      }
    }

    const supabaseActive = isSupabaseConfigured();
    const demoAllowed = isDemoAuthEnabled();

    if (data.action === "logout") {
      const routeClient = supabaseActive
        ? await createSupabaseRouteClient()
        : null;
      if (routeClient) {
        const { error } = await routeClient.supabase.auth.signOut();
        if (error) {
          console.error("[auth.session] signOut failed", {
            errorName: error.name,
            status: error.status ?? null,
            message: error.message,
          });
        }
      }
      const res = NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } }
      );
      res.cookies.set(DEMO_USER_COOKIE, "", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 0,
      });
      return routeClient ? routeClient.applyCookies(res) : res;
    }

    if (data.action === "demo_switch") {
      if (!demoAllowed) {
        return NextResponse.json(
          { error: "Chế độ tài khoản dùng thử đã bị khóa trên môi trường này." },
          { status: 403 }
        );
      }
      const store = readStore();
      const target = store.profiles.find((p) => p.id === data.userId);
      if (!target) {
        return NextResponse.json(
          { error: "Không tìm thấy tài khoản mẫu" },
          { status: 404 }
        );
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
      const botCheck = await verifyBotProtection({
        turnstileToken: data.turnstileToken,
        honeypot: data.honeypot,
        remoteIp: getRequestIp(req),
      });
      if (!botCheck.passed) {
        return NextResponse.json(
          { error: botCheck.reason || "Xác minh chống bot không thành công." },
          { status: 400 }
        );
      }

      if (supabaseActive) {
        const routeClient = await createSupabaseRouteClient();
        if (!routeClient) {
          return NextResponse.json(
            { error: "Không thể kết nối máy chủ xác thực." },
            { status: 503 }
          );
        }
        const origin =
          process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
          process.env.NEXT_PUBLIC_APP_URL?.trim() ||
          new URL(req.url).origin;
        const { error } = await routeClient.supabase.auth.signInWithOtp({
          email: data.email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${origin.replace(/\/+$/, "")}/auth/callback?next=/`,
            ...(data.turnstileToken ? { captchaToken: data.turnstileToken } : {}),
          },
        });
        if (error) {
          console.error("[auth.session] signInWithOtp failed", {
            errorName: error.name,
            status: error.status ?? null,
            message: error.message,
          });
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        const res = NextResponse.json({
          ok: true,
          mode: "supabase",
          message:
            "Đã gửi email đăng nhập! Bạn chỉ cần mở Gmail và bấm nút 'Sign in' trong thư (hoặc nhập mã 6 số nếu có).",
        });
        return routeClient.applyCookies(res);
      }

      if (!demoAllowed) {
        return NextResponse.json(
          { error: "Hệ thống đăng nhập chưa được cấu hình Supabase Auth." },
          { status: 503 }
        );
      }

      return NextResponse.json({
        ok: true,
        mode: "demo",
        message: "Chế độ phát triển cục bộ: nhập mã OTP 123456 để đăng nhập.",
      });
    }

    if (data.action === "verify_otp") {
      if (supabaseActive) {
        const routeClient = await createSupabaseRouteClient();
        if (!routeClient) {
          return NextResponse.json(
            { error: "Không thể kết nối máy chủ xác thực." },
            { status: 503 }
          );
        }
        const { data: verifyData, error } =
          await routeClient.supabase.auth.verifyOtp({
            email: data.email,
            token: data.code,
            type: "email",
          });
        if (error) {
          console.error("[auth.session] verifyOtp failed", {
            errorName: error.name,
            status: error.status ?? null,
            message: error.message,
          });
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (verifyData.user) {
          await ensureProfileForAuthUser(routeClient.supabase, verifyData.user);
        }
        const res = NextResponse.json(
          { ok: true, mode: "supabase" },
          { headers: { "Cache-Control": "no-store" } }
        );
        return routeClient.applyCookies(res);
      }

      if (!demoAllowed) {
        return NextResponse.json(
          { error: "Hệ thống đăng nhập chưa được cấu hình Supabase Auth." },
          { status: 503 }
        );
      }

      if (data.code !== "123456") {
        return NextResponse.json(
          { error: "Mã OTP không đúng (chế độ dev cục bộ: 123456)" },
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
  } catch (err) {
    console.error("[auth.session] unexpected error", {
      message: err instanceof Error ? err.message : "unknown_error",
    });
    return NextResponse.json({ error: "Lỗi xử lý yêu cầu" }, { status: 500 });
  }
}
