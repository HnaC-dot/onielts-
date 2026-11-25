import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase/server";
import { readStore, updateStore } from "./store";
import type { SessionUser, UserProfile } from "./types";

export const DEMO_USER_COOKIE = "onielts_demo_user";
export const REFERRAL_COOKIE = "onielts_ref";

export function isProfilePremium(profile: Pick<UserProfile, "premium_expires_at" | "role">): boolean {
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

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (profile) {
          return toSessionUser(profile as UserProfile, "supabase");
        }
      }
      return null;
    }
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

export function createOrFindDemoEmailUser(email: string, referralCode?: string | null): UserProfile {
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
      last_active_date: new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    };
    store.profiles.push(newUser);

    if (referralCode) {
      const referrer = store.profiles.find(
        (p) => p.referral_code.toUpperCase() === referralCode.toUpperCase() && p.id !== newUser.id
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
