import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recapSet } from "@/lib/purdue";

export const runtime = "nodejs";

const formErrorSchema = z.enum([
  "excessive_forward_lean",
  "lumbar_flexion",
  "knee_valgus",
  "hip_shift",
  "insufficient_depth",
  "bar_path_deviation",
]);

const repSchema = z.object({
  errorsDetected: z.array(formErrorSchema).max(6),
  durationMs: z.number().min(0).max(60_000),
});

const bodySchema = z.object({
  reps: z.array(repSchema).min(1).max(200),
  durationMs: z.number().min(0).max(3_600_000),
  formScore: z.number().min(0).max(100),
});

export async function POST(req: NextRequest) {
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
    const recap = await recapSet(parsed.data.reps, parsed.data.durationMs, parsed.data.formScore);
    return NextResponse.json({ recap, model: "llama3.1:latest", latencyMs: Date.now() - start });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[/api/recap]", message);
    return NextResponse.json({ error: "Recap failed", detail: message }, { status: 500 });
  }
}
