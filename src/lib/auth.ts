import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { SupabaseClient, User as SupabaseAuthUser } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { readStore, updateStore } from "./store";
import { getVietnamDateString } from "./utils";
import type { AuthResolutionStatus, SessionUser, UserProfile } from "./types";

export const DEMO_USER_COOKIE = "onielts_demo_user";
export const REFERRAL_COOKIE = "onielts_ref";

export interface AuthState {
  status: AuthResolutionStatus;
  user: SessionUser | null;
  authUserId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface PostgrestLikeError {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message: string;
}

/**
 * Local demo auth (demo account switcher + fixed 123456 OTP) is STRICTLY
 * disabled in production and whenever Supabase Auth is configured.
 */
export function isDemoAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (isSupabaseConfigured()) return false;
  return true;
}

export function isProfilePremium(
  profile: Pick<UserProfile, "premium_expires_at" | "role">
): boolean {
  if (profile.role === "admin") return true;
  if (!profile.premium_expires_at) return false;
  return new Date(profile.premium_expires_at).getTime() > Date.now();
}

export function toSessionUser(
  profile: UserProfile,
  authMode: "supabase" | "demo"
): SessionUser {
  return {
    ...profile,
    isPremium: isProfilePremium(profile),
    authMode,
  };
}

function generateReferralCode(email: string, id: string): string {
  const prefix =
    email
      .split("@")[0]
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 6) || "IELTS";
  const suffix = id.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 4) || "2026";
  return `${prefix}${suffix}`;
}

function generateCollisionFreeReferralCode(id: string): string {
  const cleanId = id.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return `U${cleanId.slice(0, 11) || Date.now().toString(36).toUpperCase()}`;
}

function isRlsOrPermissionError(error: PostgrestLikeError | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  if (code === "42501" || code === "PGRST301" || code === "PGRST302") {
    return true;
  }
  const msg = error.message.toLowerCase();
  return msg.includes("row-level security") || msg.includes("permission denied");
}

function logProfileError(
  stage: string,
  userId: string,
  error: PostgrestLikeError
): void {
  console.error(`[auth] ${stage}`, {
    userId,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    message: error.message,
  });
}

function buildSafeProfilePayload(
  authUser: SupabaseAuthUser,
  refCode: string | null,
  overrideReferralCode?: string
) {
  const email = authUser.email ?? "";
  const metaName =
    (authUser.user_metadata?.full_name as string | undefined) ||
    (authUser.user_metadata?.name as string | undefined) ||
    email.split("@")[0] ||
    "Học viên Ôn IELTS";

  // Safe defaults ONLY: always learner, never auto-grant admin or premium.
  return {
    id: authUser.id,
    email,
    full_name: metaName,
    avatar_url: (authUser.user_metadata?.avatar_url as string | undefined) ?? null,
    role: "learner" as const,
    target_band: 6.5,
    current_band: null,
    locale: "vi" as const,
    premium_expires_at: null,
    referral_code: overrideReferralCode ?? generateReferralCode(email, authUser.id),
    referred_by: refCode,
    email_verified: Boolean(authUser.email_confirmed_at),
    streak_count: 1,
    last_active_date: getVietnamDateString(),
  };
}

async function readReferralCookieSafe(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(REFERRAL_COOKIE)?.value?.trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

async function recordReferralAttribution(
  userId: string,
  refCode: string | null,
  adminClient?: SupabaseClient | null
): Promise<void> {
  if (!refCode) return;
  const admin = adminClient ?? createSupabaseAdminClient();
  if (!admin) return;
  try {
    const { data: referrer } = await admin
      .from("profiles")
      .select("id, referral_code")
      .eq("referral_code", refCode)
      .neq("id", userId)
      .maybeSingle();
    if (referrer) {
      await admin.from("referrals").upsert(
        {
          referrer_id: referrer.id,
          referred_user_id: userId,
          referral_code: referrer.referral_code,
          status: "signed_up",
        },
        { onConflict: "referred_user_id", ignoreDuplicates: true }
      );
    }
  } catch (err) {
    console.error("[auth] referral attribution failed", {
      userId,
      message: err instanceof Error ? err.message : "unknown_error",
    });
  }
}

/**
 * Loads or safely provisions a `public.profiles` row for an authenticated
 * Supabase user. Accepts optional explicit `adminClient` for unit testing.
 * Never auto-grants `admin` or `premium`.
 */
export async function ensureProfileForAuthUser(
  supabase: SupabaseClient,
  authUser: SupabaseAuthUser,
  options?: {
    adminClient?: SupabaseClient | null;
    refCode?: string | null;
  }
): Promise<AuthState> {
  let lastErrorCode: string | null = null;
  let lastErrorMessage: string | null = null;
  let encounteredRlsBlock = false;

  // 1. Try user-scoped SELECT
  const { data: existingProfile, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (selectError) {
    logProfileError("profile select failed", authUser.id, selectError);
    lastErrorCode = selectError.code ?? "profile_select_failed";
    lastErrorMessage = selectError.message;
    if (isRlsOrPermissionError(selectError)) {
      encounteredRlsBlock = true;
    }
  }

  if (existingProfile) {
    return {
      status: "authenticated",
      user: toSessionUser(existingProfile as UserProfile, "supabase"),
      authUserId: authUser.id,
      errorCode: null,
      errorMessage: null,
    };
  }

  const refCode =
    options?.refCode !== undefined
      ? options.refCode
      : await readReferralCookieSafe();

  // 2. Select returned no row without a blocking select error -> try user-scoped INSERT
  if (!selectError) {
    const payload = buildSafeProfilePayload(authUser, refCode);
    const { data: createdProfile, error: insertError } = await supabase
      .from("profiles")
      .insert(payload)
      .select("*")
      .maybeSingle();

    if (createdProfile) {
      await recordReferralAttribution(authUser.id, refCode, options?.adminClient);
      return {
        status: "authenticated",
        user: toSessionUser(createdProfile as UserProfile, "supabase"),
        authUserId: authUser.id,
        errorCode: null,
        errorMessage: null,
      };
    }

    if (insertError) {
      logProfileError("profile insert failed", authUser.id, insertError);
      lastErrorCode = insertError.code ?? "profile_insert_failed";
      lastErrorMessage = insertError.message;

      if (isRlsOrPermissionError(insertError)) {
        encounteredRlsBlock = true;
      }

      // 2a. Conflict (trigger or concurrent request created row, or referral_code collision)
      if (insertError.code === "23505") {
        const { data: reselectedProfile, error: reselectError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (reselectError) {
          logProfileError(
            "profile re-select after conflict failed",
            authUser.id,
            reselectError
          );
          lastErrorCode = reselectError.code ?? "profile_reselect_failed";
          lastErrorMessage = reselectError.message;
          if (isRlsOrPermissionError(reselectError)) {
            encounteredRlsBlock = true;
          }
        }

        if (reselectedProfile) {
          return {
            status: "authenticated",
            user: toSessionUser(reselectedProfile as UserProfile, "supabase"),
            authUserId: authUser.id,
            errorCode: null,
            errorMessage: null,
          };
        }

        // Row still not found by id -> likely referral_code unique collision; retry once
        const retryPayload = buildSafeProfilePayload(
          authUser,
          refCode,
          generateCollisionFreeReferralCode(authUser.id)
        );
        const { data: retriedProfile, error: retryError } = await supabase
          .from("profiles")
          .insert(retryPayload)
          .select("*")
          .maybeSingle();

        if (retriedProfile) {
          await recordReferralAttribution(authUser.id, refCode, options?.adminClient);
          return {
            status: "authenticated",
            user: toSessionUser(retriedProfile as UserProfile, "supabase"),
            authUserId: authUser.id,
            errorCode: null,
            errorMessage: null,
          };
        }

        if (retryError) {
          logProfileError("profile retry insert failed", authUser.id, retryError);
          lastErrorCode = retryError.code ?? "profile_retry_insert_failed";
          lastErrorMessage = retryError.message;
          if (isRlsOrPermissionError(retryError)) {
            encounteredRlsBlock = true;
          }
        }
      }
    }
  }

  // 3. RLS fallback via service-role client (only if configured)
  const admin =
    options?.adminClient !== undefined
      ? options.adminClient
      : createSupabaseAdminClient();

  if (admin && (encounteredRlsBlock || selectError)) {
    const { data: adminExisting, error: adminSelectError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (adminSelectError) {
      logProfileError(
        "service-role profile select failed",
        authUser.id,
        adminSelectError
      );
      lastErrorCode = adminSelectError.code ?? lastErrorCode;
      lastErrorMessage = adminSelectError.message;
    }

    if (adminExisting) {
      console.error(
        "[auth] user-scoped profile access failed; loaded existing row via service-role fallback",
        { userId: authUser.id, originalCode: lastErrorCode }
      );
      return {
        status: "authenticated",
        user: toSessionUser(adminExisting as UserProfile, "supabase"),
        authUserId: authUser.id,
        errorCode: null,
        errorMessage: null,
      };
    }

    // Provision missing row with safe defaults ONLY (role='learner', premium null)
    const safePayload = buildSafeProfilePayload(authUser, refCode);
    const { data: adminCreated, error: adminInsertError } = await admin
      .from("profiles")
      .insert(safePayload)
      .select("*")
      .maybeSingle();

    if (adminCreated) {
      await recordReferralAttribution(authUser.id, refCode, admin);
      return {
        status: "authenticated",
        user: toSessionUser(adminCreated as UserProfile, "supabase"),
        authUserId: authUser.id,
        errorCode: null,
        errorMessage: null,
      };
    }

    if (adminInsertError) {
      logProfileError(
        "service-role profile insert failed",
        authUser.id,
        adminInsertError
      );
      lastErrorCode = adminInsertError.code ?? lastErrorCode;
      lastErrorMessage = adminInsertError.message;

      if (adminInsertError.code === "23505") {
        const { data: adminReselected } = await admin
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();
        if (adminReselected) {
          return {
            status: "authenticated",
            user: toSessionUser(adminReselected as UserProfile, "supabase"),
            authUserId: authUser.id,
            errorCode: null,
            errorMessage: null,
          };
        }

        const retryAdminPayload = buildSafeProfilePayload(
          authUser,
          refCode,
          generateCollisionFreeReferralCode(authUser.id)
        );
        const { data: adminRetried, error: adminRetryErr } = await admin
          .from("profiles")
          .insert(retryAdminPayload)
          .select("*")
          .maybeSingle();
        if (adminRetried) {
          await recordReferralAttribution(authUser.id, refCode, admin);
          return {
            status: "authenticated",
            user: toSessionUser(adminRetried as UserProfile, "supabase"),
            authUserId: authUser.id,
            errorCode: null,
            errorMessage: null,
          };
        }
        if (adminRetryErr) {
          logProfileError(
            "service-role profile retry insert failed",
            authUser.id,
            adminRetryErr
          );
          lastErrorCode = adminRetryErr.code ?? lastErrorCode;
          lastErrorMessage = adminRetryErr.message;
        }
      }
    }
  }

  return {
    status: "profile_error",
    user: null,
    authUserId: authUser.id,
    errorCode: lastErrorCode ?? "profile_unavailable",
    errorMessage:
      lastErrorMessage ??
      "Authenticated in Supabase, but public.profiles row could not be loaded.",
  };
}

async function resolveAuthState(): Promise<AuthState> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      console.error("[auth.getCurrentUser] createSupabaseServerClient returned null");
      return {
        status: "unauthenticated",
        user: null,
        authUserId: null,
        errorCode: "supabase_client_unavailable",
        errorMessage: "Supabase client could not be initialized.",
      };
    }

    const {
      data: { user: authUser },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError) {
      if (getUserError.name !== "AuthSessionMissingError") {
        console.error("[auth.getCurrentUser] supabase.auth.getUser failed", {
          errorName: getUserError.name,
          status: getUserError.status ?? null,
          code: getUserError.code ?? null,
          message: getUserError.message,
        });
      }
      return {
        status: "unauthenticated",
        user: null,
        authUserId: null,
        errorCode:
          getUserError.name === "AuthSessionMissingError"
            ? null
            : (getUserError.code ?? getUserError.name),
        errorMessage:
          getUserError.name === "AuthSessionMissingError"
            ? null
            : getUserError.message,
      };
    }

    if (!authUser) {
      return {
        status: "unauthenticated",
        user: null,
        authUserId: null,
        errorCode: null,
        errorMessage: null,
      };
    }

    return ensureProfileForAuthUser(supabase, authUser);
  }

  // Strictly block demo cookie auth outside local dev
  if (!isDemoAuthEnabled()) {
    return {
      status: "unauthenticated",
      user: null,
      authUserId: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  const cookieStore = await cookies();
  const demoUserId = cookieStore.get(DEMO_USER_COOKIE)?.value;
  if (!demoUserId || demoUserId === "logged_out") {
    return {
      status: "unauthenticated",
      user: null,
      authUserId: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  const store = readStore();
  const found = store.profiles.find((p) => p.id === demoUserId);
  if (!found) {
    return {
      status: "unauthenticated",
      user: null,
      authUserId: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  return {
    status: "authenticated",
    user: toSessionUser(found, "demo"),
    authUserId: found.id,
    errorCode: null,
    errorMessage: null,
  };
}

/**
 * Request-memoized canonical auth resolver so RootLayout (SiteHeader),
 * /profile, /admin, and API routes read the exact same session state.
 */
export const getAuthState = cache(resolveAuthState);

export async function getCurrentUser(): Promise<SessionUser | null> {
  const state = await getAuthState();
  return state.user;
}

export function createOrFindDemoEmailUser(
  email: string,
  referralCode?: string | null
): UserProfile {
  if (!isDemoAuthEnabled()) {
    throw new Error("Demo auth is disabled.");
  }
  const normalized = email.trim().toLowerCase();
  return updateStore((store) => {
    const existing = store.profiles.find((p) => p.email.toLowerCase() === normalized);
    if (existing) {
      return existing;
    }
    const baseName = normalized.split("@")[0].replace(/[._-]+/g, " ");
    const displayName = baseName
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0].toUpperCase() + s.slice(1))
      .join(" ");
    const id = `user-${Date.now()}`;
    const newCode = `${baseName.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6) || "IELTS"}${Math.floor(10 + Math.random() * 89)}`;
    const newUser: UserProfile = {
      id,
      email: normalized,
      full_name: displayName || "Học viên Ôn IELTS",
      role: "learner",
      target_band: 6.5,
      current_band: null,
      locale: "vi",
      premium_expires_at: null,
      referral_code: newCode,
      referred_by: referralCode || null,
      email_verified: true,
      streak_count: 1,
      last_active_date: getVietnamDateString(),
      created_at: new Date().toISOString(),
    };
    store.profiles.push(newUser);

    if (referralCode) {
      const referrer = store.profiles.find(
        (p) =>
          p.referral_code.toUpperCase() === referralCode.toUpperCase() &&
          p.id !== newUser.id
      );
      if (referrer) {
        store.referrals.push({
          id: `ref-${Date.now()}`,
          referrer_id: referrer.id,
          referred_user_id: newUser.id,
          referred_email: newUser.email,
          referral_code: referrer.referral_code,
          status: "signed_up",
          created_at: new Date().toISOString(),
        });
      }
    }
    return newUser;
  });
}
