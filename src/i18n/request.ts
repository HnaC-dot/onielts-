import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getAuthState } from "@/lib/auth";
import {
  APPEARANCE_PREVIEW_COOKIE,
  getEffectiveAppearance,
  getPublishedAppearance,
} from "@/lib/cms-appearance";
import { applyUiTextOverrides } from "@/lib/appearance-shared";

export const LOCALE_COOKIE = "onielts_locale";
export type AppLocale = "vi" | "en";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = raw === "en" ? "en" : "vi";
  const baseMessages = (await import(`../../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;

  let messages = baseMessages;
  try {
    const wantsPreview = cookieStore.get(APPEARANCE_PREVIEW_COOKIE)?.value === "1";
    let uiTexts: Record<string, { vi: string; en: string }> | undefined;
    if (wantsPreview) {
      const auth = await getAuthState();
      const eff = await getEffectiveAppearance(auth.user?.role === "admin");
      uiTexts = eff.config.uiTexts;
    } else {
      const pub = await getPublishedAppearance();
      uiTexts = pub.uiTexts;
    }
    messages = applyUiTextOverrides(baseMessages, uiTexts, locale);
  } catch {
    // Fallback cleanly to base JSON messages outside request context
  }

  return {
    locale,
    messages,
  };
});
