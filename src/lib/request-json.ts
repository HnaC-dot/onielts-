import { NextResponse } from "next/server";

/**
 * Safely parses a JSON request body, returning a clean HTTP 400 response
 * on empty or malformed JSON instead of letting `req.json()` throw into a
 * generic 500 Internal Server Error handler.
 */
export async function readJsonBody<T = unknown>(
  req: Request
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Dữ liệu JSON không hợp lệ hoặc bị trống." },
        { status: 400 }
      ),
    };
  }
}
