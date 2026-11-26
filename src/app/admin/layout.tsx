import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  KeyRound,
  Lock,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { getLocale } from "next-intl/server";
import { getAuthState } from "@/lib/auth";
import { isStaffRole } from "@/lib/admin-auth";
import {
  isServiceRoleConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { AuthErrorActions } from "@/components/auth-error-actions";
import { ToastProvider } from "@/components/admin/toast-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: {
    default: "Bảng điều khiển Quản trị CMS — Ôn IELTS",
    template: "%s | CMS Ôn IELTS",
  },
  robots: { index: false, follow: false },
};

function GrantAdminSqlNote({
  isEn,
  currentUserId,
}: {
  isEn: boolean;
  currentUserId?: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-800 dark:bg-slate-900/70 space-y-2.5">
      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
        {isEn
          ? "How to grant Admin / Editor access"
          : "Hướng dẫn cấp quyền Admin / Editor"}
      </p>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {isEn
          ? "Option 1 — Supabase SQL Editor (using the exact UUID from Supabase Authentication -> Users):"
          : "Cách 1 — Chạy lệnh SQL trong Supabase SQL Editor với đúng UUID trong Supabase Authentication → Users:"}
      </p>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-300">
        <code>
          {"update public.profiles set role='admin' where id='<auth user uuid>';"}
        </code>
      </pre>
      {currentUserId && (
        <div className="pt-0.5 space-y-1">
          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
            {isEn
              ? "Your currently signed-in auth user UUID:"
              : "UUID tài khoản bạn đang đăng nhập hiện tại:"}
          </p>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-[11px] text-amber-300">
            <code>{`update public.profiles set role='admin' where id='${currentUserId}';`}</code>
          </pre>
        </div>
      )}
      <p className="text-[11px] text-slate-600 dark:text-slate-400">
        {isEn
          ? "Option 2 — Seed script via environment variable (no hardcoded credentials):"
          : "Cách 2 — Dùng seed script qua biến môi trường (không hard-code mật khẩu):"}
      </p>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 p-2.5 text-[11px] text-sky-300">
        <code>{"ADMIN_SEED_EMAIL=<your-email> npm run seed:admin"}</code>
      </pre>
    </div>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, authState] = await Promise.all([getLocale(), getAuthState()]);
  const isEn = locale === "en";
  const supabaseConfigured = isSupabaseConfigured();
  const serviceRoleConfigured = isServiceRoleConfigured();

  // Case 1: Authenticated in Supabase, but public.profiles row failed to load
  if (authState.status === "profile_error") {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Card className="p-8 space-y-5">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEn
                ? "Admin access denied — Profile could not be loaded"
                : "Không thể vào trang Admin — Lỗi tải hồ sơ người dùng"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isEn
                ? "You are signed in to Supabase Auth, but the server could not read or create your row in public.profiles. Check migrations (0001–0005) and RLS policies."
                : "Bạn đã đăng nhập Supabase Auth, nhưng máy chủ chưa thể đọc hoặc tạo dòng tương ứng trong bảng public.profiles. Hãy kiểm tra các file migration và RLS policy trên Supabase."}
            </p>
            {authState.errorCode && (
              <p className="text-xs text-slate-500">
                {isEn ? "Error code: " : "Mã lỗi: "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono dark:bg-slate-800">
                  {authState.errorCode}
                </code>
              </p>
            )}
          </div>
          <AuthErrorActions isEn={isEn} showLogout />
          <GrantAdminSqlNote isEn={isEn} currentUserId={authState.authUserId} />
        </Card>
      </div>
    );
  }

  const user = authState.user;

  // Case 2: Not logged in
  if (!user) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Card className="p-8 space-y-5">
          <Shield className="mx-auto h-10 w-10 text-emerald-600" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEn
                ? "Admin access denied — Not signed in"
                : "Từ chối truy cập Admin — Bạn chưa đăng nhập"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isEn
                ? "No active session was found. Please sign in with an account whose public.profiles role is 'admin' or 'editor'."
                : "Hệ thống chưa tìm thấy phiên đăng nhập. Vui lòng đăng nhập bằng tài khoản đã được cấp quyền admin hoặc editor trong bảng public.profiles."}
            </p>
          </div>
          <div>
            <Link href="/auth?next=/admin">
              <Button>{isEn ? "Go to Sign in" : "Đi tới trang Đăng nhập"}</Button>
            </Link>
          </div>
          <GrantAdminSqlNote isEn={isEn} />
        </Card>
      </div>
    );
  }

  // Case 3: Account is locked
  if (user.is_locked) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Card className="p-8 space-y-5">
          <Lock className="mx-auto h-10 w-10 text-red-500" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEn
                ? "Admin access denied — Account is locked"
                : "Tài khoản quản trị đang bị khóa"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isEn
                ? "Your account has been locked by an administrator and cannot access the CMS."
                : "Tài khoản của bạn hiện đang bị khóa (is_locked = true). Vui lòng liên hệ quản trị viên để mở khóa."}
            </p>
          </div>
          <AuthErrorActions isEn={isEn} showLogout />
        </Card>
      </div>
    );
  }

  // Case 4: Logged in, but role is neither admin nor editor
  if (!isStaffRole(user.role)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Card className="p-8 space-y-5">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-500" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEn
                ? "Admin access denied — Account role is not admin or editor"
                : "Từ chối truy cập Admin — Tài khoản chưa có quyền Admin/Editor"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isEn
                ? `You are signed in as a '${user.role}' account. Admin CMS access requires role = 'admin' or 'editor' in public.profiles for this exact user UUID.`
                : `Bạn đang đăng nhập với quyền '${user.role}'. Để vào trang quản trị CMS, dòng tương ứng trong bảng public.profiles phải có role = 'admin' hoặc 'editor'.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <AuthErrorActions
              isEn={isEn}
              showLogout
              retryLabel={
                isEn ? "Refresh after updating SQL" : "Tải lại sau khi chạy SQL"
              }
            />
          </div>
          <GrantAdminSqlNote isEn={isEn} currentUserId={user.id} />
        </Card>
      </div>
    );
  }

  // Case 5: Logged in as staff, but SUPABASE_SERVICE_ROLE_KEY is missing in Supabase mode
  if (supabaseConfigured && !serviceRoleConfigured) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Card className="p-8 space-y-5">
          <KeyRound className="mx-auto h-10 w-10 text-amber-500" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {isEn
                ? "Admin access denied — SUPABASE_SERVICE_ROLE_KEY is missing"
                : "Không thể mở Admin — Thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isEn
                ? `Your account has role = '${user.role}', but the server is missing SUPABASE_SERVICE_ROLE_KEY. Without it, admin CMS reads and mutations cannot run securely against Supabase.`
                : `Tài khoản của bạn đã có quyền '${user.role}', nhưng máy chủ đang thiếu biến môi trường SUPABASE_SERVICE_ROLE_KEY nên không thể thực hiện thao tác quản trị trên Supabase.`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isEn
                ? "Add SUPABASE_SERVICE_ROLE_KEY (server-only, never NEXT_PUBLIC_) in Vercel -> Project Settings -> Environment Variables, then redeploy."
                : "Hãy thêm SUPABASE_SERVICE_ROLE_KEY (chỉ trên server, tuyệt đối không gắn tiền tố NEXT_PUBLIC_) vào Vercel → Project Settings → Environment Variables rồi Redeploy."}
            </p>
          </div>
          <AuthErrorActions isEn={isEn} />
          <GrantAdminSqlNote isEn={isEn} currentUserId={user.id} />
        </Card>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AdminShell user={user}>{children}</AdminShell>
    </ToastProvider>
  );
}
