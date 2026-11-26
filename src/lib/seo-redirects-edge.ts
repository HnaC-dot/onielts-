import {
  isReservedRedirectSource,
  matchSeoRedirect,
  normalizeRedirectPath,
} from "./seo-cms-shared";
import type { SeoRedirectItem } from "./types";

type CachedRedirect = Pick<
  SeoRedirectItem,
  "id" | "source_path" | "destination_path" | "status_code" | "is_active"
>;

const CACHE_TTL_MS = 30_000;
let cachedRedirects: CachedRedirect[] | null = null;
let cacheExpiresAt = 0;

export function invalidateSeoRedirectCache(): void {
  cachedRedirects = null;
  cacheExpiresAt = 0;
}

async function fetchActiveRedirectsFromSupabase(): Promise<CachedRedirect[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const endpoint = `${supabaseUrl.replace(
    /\/+$/,
    ""
  )}/rest/v1/seo_redirects?select=id,source_path,destination_path,status_code,is_active&is_active=eq.true&order=created_at.desc&limit=500`;

  try {
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) return [];
    const rows = (await res.json()) as unknown;
    if (!Array.isArray(rows)) return [];

    return rows
      .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
      .map((r) => {
        const codeNum = Number(r.status_code ?? 301);
        const status_code: 301 | 302 | 307 | 308 =
          codeNum === 302 || codeNum === 307 || codeNum === 308 ? codeNum : 301;
        return {
          id: String(r.id ?? ""),
          source_path: String(r.source_path ?? ""),
          destination_path: String(r.destination_path ?? ""),
          status_code,
          is_active: r.is_active !== false,
        };
      });
  } catch {
    // Fail-open so a transient network hiccup never blocks public navigation
    return cachedRedirects ?? [];
  }
}

async function getCachedActiveRedirects(): Promise<CachedRedirect[]> {
  const now = Date.now();
  if (cachedRedirects && now < cacheExpiresAt) {
    return cachedRedirects;
  }
  const fresh = await fetchActiveRedirectsFromSupabase();
  cachedRedirects = fresh;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return fresh;
}

/**
 * Lightweight, fail-open redirect lookup designed for Next.js Proxy (`src/proxy.ts`).
 * - Immediately skips root `/`, `/admin/*`, `/api/*`, `/auth/*`, `/_next/*`, `/sitemap.xml`, `/robots.txt`
 * - Uses a 30s in-memory TTL cache backed by Supabase PostgREST (`seo_redirects_public_select`)
 * - Guarantees zero redirect loops and blocks external open redirects
 */
export async function findMatchingActiveRedirect(
  pathname: string
): Promise<CachedRedirect | null> {
  const normalized = normalizeRedirectPath(pathname);
  if (!normalized || isReservedRedirectSource(normalized)) {
    return null;
  }

  const redirects = await getCachedActiveRedirects();
  if (redirects.length === 0) return null;

  return matchSeoRedirect(normalized, redirects);
}
