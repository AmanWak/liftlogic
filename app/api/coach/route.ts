import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { coachRep } from "@/lib/gemini";
import { coachRep as coachRepPurdue, PURDUE_MODEL } from "@/lib/purdue";
import { aiRateLimit } from "@/lib/aiRateLimit";
import { GEMINI_MODEL } from "@/lib/config";
import { FORM_ERROR_LABEL, type FormAnalysis } from "@/lib/types";

function demoCoaching(a: FormAnalysis): string {
  if (a.errorsDetected.length === 0) {
    return `Clean rep — depth ${a.depthDegrees}°, lean only ${a.maxForwardLean}°. Keep that tempo on rep ${a.repNumber + 1}.`;
  }
  const first = a.errorsDetected[0];
  const label = FORM_ERROR_LABEL[first];
  return `${label} flagged on rep ${a.repNumber}. [Demo mode — set GEMINI_API_KEY in .env.local for AI coaching.]`;
}

function isGeminiQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("429") || lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("rate limit");
}

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const formErrorSchema = z.enum([
  "excessive_forward_lean",
  "lumbar_flexion",
  "knee_valgus",
  "hip_shift",
  "insufficient_depth",
  "torso_twist",
]);

const analysisSchema = z.object({
  repNumber: z.number().int().min(0).max(10_000),
  depthDegrees: z.number().min(-180).max(180),
  maxForwardLean: z.number().min(0).max(180),
  lumbarFlexionDelta: z.number().min(0).max(180),
  kneeValgusAsymmetry: z.number().min(0).max(180),
  hipShiftMax: z.number().min(0).max(180),
  torsoTwistMax: z.number().min(0).max(180),
  errorsDetected: z.array(formErrorSchema).max(6),
  durationMs: z.number().min(0).max(60_000),
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

  const parsed = analysisSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid analysis shape", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const start = Date.now();
  try {
    const coaching = await coachRep(parsed.data);
    return NextResponse.json({
      coaching,
      model: GEMINI_MODEL,
      latencyMs: Date.now() - start,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[/api/coach]", message);

    if (process.env.NODE_ENV !== "production" && message.includes("GEMINI_API_KEY")) {
      return NextResponse.json({
        coaching: demoCoaching(parsed.data),
        model: "demo-mode",
        latencyMs: Date.now() - start,
      });
    }

    if (isGeminiQuotaError(message)) {
      try {
        const coaching = await coachRepPurdue(parsed.data);
        return NextResponse.json({
          coaching,
          model: PURDUE_MODEL,
          latencyMs: Date.now() - start,
        });
      } catch (fallbackErr) {
        const fallbackMessage =
          fallbackErr instanceof Error ? fallbackErr.message : "Unknown error";
        console.error("[/api/coach] purdue fallback failed:", fallbackMessage);
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      }
    }

    return NextResponse.json(
      { error: "Coaching request failed" },
      { status: 500 },
    );
  }
}
