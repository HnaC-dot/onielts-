import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { checkUsageLimit } from "@/lib/usage-limits";
import { getGeneralAiTool } from "@/lib/ai-tools-config";
import {
  buildGeneralToolMock,
  generateStructuredAi,
  generalToolOutputSchema,
  sanitizeUserDataForPrompt,
} from "@/lib/ai";

export const maxDuration = 60;

const requestSchema = z.object({
  input: z.string().trim().min(3, "Vui lòng nhập ít nhất 3 ký tự.").max(5000),
  options: z.record(z.string(), z.string()).optional().default({}),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const tool = getGeneralAiTool(slug);
  if (!tool) {
    return NextResponse.json({ error: "Không tìm thấy công cụ AI." }, { status: 404 });
  }

  const user = await getCurrentUser();
  const clientKey = getRequestClientKey(req, user?.id);
  const rate = checkRateLimit(clientKey, 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${rate.retryAfterSec} giây.`,
      },
      { status: 429 }
    );
  }

  const usage = await checkUsageLimit(user, "general_tool", clientKey);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: "Bạn đã dùng hết lượt miễn phí trong ngày cho công cụ AI. Nâng cấp Premium để dùng không giới hạn.",
        limitReached: true,
        usage,
      },
      { status: 402 }
    );
  }

  try {
    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dữ liệu đầu vào không hợp lệ." },
        { status: 400 }
      );
    }

    if (parsed.data.input.length > tool.maxChars) {
      return NextResponse.json(
        { error: `Văn bản vượt quá giới hạn ${tool.maxChars} ký tự.` },
        { status: 400 }
      );
    }

    const safeInput = sanitizeUserDataForPrompt(parsed.data.input, tool.maxChars);
    const optionsSummary = Object.entries(parsed.data.options)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const aiRes = await generateStructuredAi({
      feature: `tool:${tool.slug}`,
      skill: "general_tool",
      userId: user?.id ?? clientKey,
      systemPrompt: tool.systemPrompt,
      userPrompt: `Selected options: ${optionsSummary || "default"}\n\nLearner text:\n${safeInput}`,
      schema: generalToolOutputSchema,
      jsonSchemaHint: `{
  "resultText": "string (main processed output)",
  "notesVi": "string (concise explanation in Vietnamese)",
  "highlights": [{ "before": "string", "after": "string", "reasonVi": "string" }]
}`,
      cacheTtlMs: 10 * 60 * 1000,
      mockFallback: () => buildGeneralToolMock(tool.slug, parsed.data.input, parsed.data.options),
    });

    return NextResponse.json({
      ok: true,
      tool: tool.slug,
      output: aiRes.data,
      model: aiRes.model,
      cached: aiRes.cached,
      mocked: aiRes.mocked,
    });
  } catch {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xử lý yêu cầu AI." },
      { status: 500 }
    );
  }
}
