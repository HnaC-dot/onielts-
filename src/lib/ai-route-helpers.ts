import "server-only";
import { NextResponse } from "next/server";
import { AiServiceUnavailableError } from "./ai";
import type { UsageReservationResult } from "./usage-limits";

export function buildQuotaDeniedResponse(
  reservation: UsageReservationResult
): NextResponse {
  return NextResponse.json(
    {
      error: reservation.error || "Bạn đã hết lượt sử dụng AI trong kỳ hiện tại.",
      limitReached: reservation.limitReached,
      premiumCapReached: reservation.premiumCapReached,
      usage: reservation.usage,
    },
    { status: reservation.httpStatus }
  );
}

export function buildAiErrorResponse(
  err: unknown,
  fallbackMessage: string
): NextResponse {
  if (err instanceof AiServiceUnavailableError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        quotaDeducted: false,
      },
      { status: err.status }
    );
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
