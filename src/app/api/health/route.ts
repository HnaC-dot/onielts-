import { NextResponse } from "next/server";
import { isTurnstileFullyConfigured } from "@/lib/bot-protection";
import { getPaymentProvider } from "@/lib/payments";
import { isUpstashRateLimitConfigured } from "@/lib/rate-limit";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight production readiness & uptime health endpoint.
 * Performs a bounded database connectivity probe when Supabase is configured.
 * Returns ONLY status flags — never secrets, tokens, emails, or stack traces.
 */
export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();
  let databaseStatus: "ok" | "local_fallback" | "error" = supabaseConfigured
    ? "error"
    : "local_fallback";
  let latencyMs: number | null = null;

  if (supabaseConfigured) {
    const started = Date.now();
    try {
      const sb = createSupabaseAdminClient() ?? (await createSupabaseServerClient());
      if (sb) {
        const probe = Promise.race([
          sb.from("pricing_plans").select("id").limit(1),
          new Promise<{ error: { message: string } }>((resolve) =>
            setTimeout(() => resolve({ error: { message: "timeout" } }), 2500)
          ),
        ]);
        const { error } = await probe;
        if (!error) {
          databaseStatus = "ok";
        }
      }
      latencyMs = Date.now() - started;
    } catch {
      databaseStatus = "error";
      latencyMs = Date.now() - started;
    }
  }

  const healthy = databaseStatus !== "error";

  return NextResponse.json(
    {
      ok: healthy,
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      latencyMs,
      checks: {
        database: databaseStatus,
        upstashRateLimit: isUpstashRateLimitConfigured(),
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        payosConfigured: getPaymentProvider("payos").isConfigured(),
        turnstileConfigured: isTurnstileFullyConfigured(),
      },
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
