import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALE_COOKIE = "onielts_locale";
export type AppLocale = "vi" | "en";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = raw === "en" ? "en" : "vi";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
