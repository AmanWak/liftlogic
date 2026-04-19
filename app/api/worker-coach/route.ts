import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { coachLift } from "@/lib/purdue";
import { WORKER_ERROR_LABEL, type LiftAnalysis } from "@/lib/types-worker";

function demoCoaching(a: LiftAnalysis): string {
  if (a.errorsDetected.length === 0) {
    return `Clean lift — flexion ${a.maxTorsoFlexion}°, lumbar drift only ${a.maxLumbarDelta}°. Stay tight on lift ${a.liftNumber + 1}.`;
  }
  const first = a.errorsDetected[0];
  const label = WORKER_ERROR_LABEL[first];
  return `${label} flagged on lift ${a.liftNumber}. [Demo mode — set PURDUE_GENAISTUDIO_API_KEY in .env.local for AI coaching.]`;
}

export const runtime = "nodejs";

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 15;
const rateBuckets = new Map<string, number[]>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const hits = (rateBuckets.get(ip) ?? []).filter((t) => t > cutoff);
  if (hits.length >= RATE_MAX_REQUESTS) {
    rateBuckets.set(ip, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(ip, hits);
  if (rateBuckets.size > 1000) {
    for (const [k, v] of rateBuckets) {
      if (v.every((t) => t <= cutoff)) rateBuckets.delete(k);
    }
  }
  return true;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

const workerErrorSchema = z.enum([
  "back_rounded",
  "stiff_leg_lift",
  "overloaded_lean",
  "asymmetric_load",
]);

const analysisSchema = z.object({
  liftNumber: z.number().int().min(0).max(10_000),
  maxTorsoFlexion: z.number().min(0).max(180),
  maxLumbarDelta: z.number().min(0).max(180),
  avgThighFlexion: z.number().min(0).max(180),
  maxLegAsymmetry: z.number().min(0).max(180),
  maxTorsoSideBend: z.number().min(0).max(180),
  errorsDetected: z.array(workerErrorSchema).max(4),
  durationMs: z.number().min(0).max(60_000),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(clientIp(req))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "10" } },
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
    const coaching = await coachLift(parsed.data);
    return NextResponse.json({
      coaching,
      model: "mistral:latest",
      latencyMs: Date.now() - start,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[/api/worker-coach]", message);

    if (process.env.NODE_ENV !== "production" && message.includes("PURDUE_GENAISTUDIO_API_KEY")) {
      return NextResponse.json({
        coaching: demoCoaching(parsed.data),
        model: "demo-mode",
        latencyMs: Date.now() - start,
      });
    }

    return NextResponse.json(
      { error: "Coaching request failed" },
      { status: 500 },
    );
  }
}
