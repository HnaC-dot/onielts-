import "server-only";
import { cookies } from "next/headers";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "./supabase/server";
import { readStore, updateStore } from "./store";
import { getVietnamDateString } from "./utils";
import type { SessionUser, UserProfile } from "./types";

export const DEMO_USER_COOKIE = "onielts_demo_user";
export const REFERRAL_COOKIE = "onielts_ref";

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

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (!supabase) return null;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (existingProfile) {
      return toSessionUser(existingProfile as UserProfile, "supabase");
    }

    // Auto-provision profile row if trigger hasn't created one yet (safe defaults only)
    const cookieStore = await cookies();
    const refCode = cookieStore.get(REFERRAL_COOKIE)?.value?.trim().toUpperCase() || null;
    const email = user.email ?? "";
    const metaName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      email.split("@")[0] ||
      "Học viên Ôn IELTS";

    const newProfilePayload = {
      id: user.id,
      email,
      full_name: metaName,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      role: "learner" as const,
      target_band: 6.5,
      current_band: null,
      locale: "vi" as const,
      premium_expires_at: null,
      referral_code: generateReferralCode(email, user.id),
      referred_by: refCode,
      email_verified: Boolean(user.email_confirmed_at),
      streak_count: 1,
      last_active_date: getVietnamDateString(),
    };

    const { data: createdProfile } = await supabase
      .from("profiles")
      .insert(newProfilePayload)
      .select("*")
      .maybeSingle();

    if (createdProfile) {
      // Track referral attribution if valid referral cookie exists
      if (refCode) {
        const admin = createSupabaseAdminClient();
        if (admin) {
          const { data: referrer } = await admin
            .from("profiles")
            .select("id, referral_code")
            .eq("referral_code", refCode)
            .neq("id", user.id)
            .maybeSingle();
          if (referrer) {
            await admin.from("referrals").upsert(
              {
                referrer_id: referrer.id,
                referred_user_id: user.id,
                referral_code: referrer.referral_code,
                status: "signed_up",
              },
              { onConflict: "referred_user_id", ignoreDuplicates: true }
            );
          }
        }
      }
      return toSessionUser(createdProfile as UserProfile, "supabase");
    }

    return null;
  }

  // Strictly block demo cookie auth outside local dev
  if (!isDemoAuthEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  const demoUserId = cookieStore.get(DEMO_USER_COOKIE)?.value;
  if (!demoUserId || demoUserId === "logged_out") {
    return null;
  }

  const store = readStore();
  const found = store.profiles.find((p) => p.id === demoUserId);
  if (!found) {
    return null;
  }
  return toSessionUser(found, "demo");
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
