/**
 * Canonical domain resolution & 301 redirect helpers (Edge/Proxy & Node safe).
 *
 * Reads `NEXT_PUBLIC_SITE_URL` as the primary canonical domain (falling back to
 * `NEXT_PUBLIC_APP_URL` for backward compatibility). Never hardcodes any
 * `*.vercel.app` host anywhere.
 */

const DEFAULT_FALLBACK_SITE_URL = "https://onielts.vn";

const NOINDEX_PATH_PREFIXES = [
  "/admin",
  "/auth",
  "/profile",
  "/progress",
  "/referral",
  "/flashcards",
  "/api",
] as const;

function parseHttpUrl(raw: string | undefined | null): URL | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function normalizeBaseUrl(raw: string | undefined | null): string | null {
  const parsed = parseHttpUrl(raw);
  if (!parsed) return null;
  return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, "");
}

/**
 * Returns the explicitly configured primary site URL from env vars
 * (`NEXT_PUBLIC_SITE_URL` preferred, then `NEXT_PUBLIC_APP_URL`), or `null`
 * if neither env var is set.
 */
export function getConfiguredSiteUrl(
  env: Record<string, string | undefined> = process.env
): string | null {
  return (
    normalizeBaseUrl(env.NEXT_PUBLIC_SITE_URL) ||
    normalizeBaseUrl(env.NEXT_PUBLIC_APP_URL) ||
    null
  );
}

/**
 * Canonical base URL for metadata, canonical links, og:url, sitemap, robots,
 * JSON-LD, email callbacks, and absolute links.
 */
export function getEffectiveSiteBaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  return getConfiguredSiteUrl(env) || DEFAULT_FALLBACK_SITE_URL;
}

/**
 * Clean hostname (e.g. "onielts.vn") derived from `NEXT_PUBLIC_SITE_URL`.
 */
export function getCanonicalSiteHost(
  env: Record<string, string | undefined> = process.env
): string {
  try {
    return new URL(getEffectiveSiteBaseUrl(env)).host;
  } catch {
    return "onielts.vn";
  }
}

function stripPort(hostHeader: string): string {
  return hostHeader.trim().toLowerCase().replace(/:\d+$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}

function isVercelHostname(hostname: string): boolean {
  return hostname.endsWith(".vercel.app");
}

export function isNoindexRoutePath(pathname: string): boolean {
  const normalized = (pathname || "/").toLowerCase();
  return NOINDEX_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

/**
 * Computes a permanent 301 redirect URL to the primary custom domain when:
 * 1. `NEXT_PUBLIC_SITE_URL` (or `NEXT_PUBLIC_APP_URL`) is explicitly set to a
 *    real production custom domain (non-localhost, non-`*.vercel.app`).
 * 2. Incoming request is NOT localhost, NOT `/api/*`, and NOT `/_next/*`.
 * 3. Incoming host is either:
 *    - a `*.vercel.app` production alias (skips Vercel PR previews when `vercelEnv === "preview"`), OR
 *    - the alternate `www.` / apex variant of the primary domain.
 *
 * Preserves the full pathname and query string verbatim.
 */
export function computeCanonicalDomainRedirect(params: {
  requestHost: string | null | undefined;
  pathname: string;
  search: string;
  siteUrl?: string | null;
  vercelEnv?: string | null;
}): string | null {
  const targetParsed = parseHttpUrl(
    params.siteUrl !== undefined ? params.siteUrl : getConfiguredSiteUrl()
  );
  if (!targetParsed) return null;

  const targetHostname = targetParsed.hostname.toLowerCase();
  // Never redirect until a real custom domain (non-local, non-vercel.app) is configured
  if (isLocalHostname(targetHostname) || isVercelHostname(targetHostname)) {
    return null;
  }

  const incomingHostname = stripPort(params.requestHost || "");
  if (!incomingHostname || isLocalHostname(incomingHostname)) {
    return null;
  }

  if (incomingHostname === targetHostname) {
    return null;
  }

  // Never redirect internal Next assets or API/webhook endpoints
  if (
    params.pathname.startsWith("/_next/") ||
    params.pathname === "/api" ||
    params.pathname.startsWith("/api/")
  ) {
    return null;
  }

  const alternateWwwHostname = targetHostname.startsWith("www.")
    ? targetHostname.slice(4)
    : `www.${targetHostname}`;

  const isAlternateWww = incomingHostname === alternateWwwHostname;
  const isVercelAlias =
    isVercelHostname(incomingHostname) &&
    (params.vercelEnv ?? process.env.VERCEL_ENV) !== "preview";

  if (!isAlternateWww && !isVercelAlias) {
    return null;
  }

  const safePath = params.pathname.startsWith("/")
    ? params.pathname
    : `/${params.pathname}`;
  const safeSearch =
    params.search && !params.search.startsWith("?")
      ? `?${params.search}`
      : params.search || "";

  return `https://${targetParsed.host}${safePath}${safeSearch}`;
}
