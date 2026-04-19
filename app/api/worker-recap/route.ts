import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recapLifts } from "@/lib/gemini";
import { recapLifts as recapLiftsPurdue, PURDUE_MODEL } from "@/lib/purdue";
import { aiRateLimit } from "@/lib/aiRateLimit";
import { GEMINI_RECAP_MODEL } from "@/lib/config";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function isGeminiQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("rate limit");
}

const workerErrorSchema = z.enum([
  "back_rounded",
  "stiff_leg_lift",
  "overloaded_lean",
  "asymmetric_load",
]);

const liftSchema = z.object({
  errorsDetected: z.array(workerErrorSchema).max(4),
  durationMs: z.number().min(0).max(60_000),
});

const bodySchema = z.object({
  reps: z.array(liftSchema).min(1).max(200),
  durationMs: z.number().min(0).max(3_600_000),
  formScore: z.number().min(0).max(100),
});

export async function POST(req: NextRequest) {
  if (!aiRateLimit(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid shape" }, { status: 400 });
  }

  const start = Date.now();
  try {
    const recap = await recapLifts(parsed.data.reps, parsed.data.durationMs, parsed.data.formScore);
    return NextResponse.json({ recap, model: GEMINI_RECAP_MODEL, latencyMs: Date.now() - start });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[/api/worker-recap]", message);
    if (isGeminiQuotaError(message)) {
      try {
        const recap = await recapLiftsPurdue(
          parsed.data.reps,
          parsed.data.durationMs,
          parsed.data.formScore,
        );
        return NextResponse.json({
          recap,
          model: PURDUE_MODEL,
          latencyMs: Date.now() - start,
        });
      } catch (fallbackErr) {
        const fallbackMessage =
          fallbackErr instanceof Error ? fallbackErr.message : "Unknown error";
        console.error("[/api/worker-recap] purdue fallback failed:", fallbackMessage);
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      }
    }
    return NextResponse.json({ error: "Recap failed", detail: message }, { status: 500 });
  }
}
