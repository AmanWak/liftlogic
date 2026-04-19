"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { SensorFrame } from "./types";
import type { LiftAnalysis } from "./types-worker";
import { createLiftDetector, type LiftDetector } from "./liftDetector";
import { analyzeLift } from "./liftAnalyzer";

function clientFallback(analysis: LiftAnalysis): string {
  const error = analysis.errorsDetected[0];
  if (!error) return "Clean lift — stay tight on the next one.";
  const cues: Record<typeof error, string> = {
    back_rounded: "Back's rounding — bend the knees, keep the spine flat.",
    stiff_leg_lift: "Too much back, not enough legs — hinge and drive through the floor.",
    overloaded_lean: "Folded too deep — get closer to the load before you lift.",
    asymmetric_load: "Loaded uneven — square your stance and use both hands.",
  };
  return cues[error];
}

export type ConnStatus = "idle" | "connecting" | "live" | "mock" | "demo" | "disconnected" | "error";

export interface LiftResult {
  analysis: LiftAnalysis;
  coaching?: string;
  coachingPending: boolean;
  coachingError?: string;
}

export interface UseWorkerStreamResult {
  frame: SensorFrame | null;
  lifts: LiftResult[];
  status: ConnStatus;
  liftCount: number;
  safeLifts: number;
  reset: () => void;
  injectLift: (analysis: LiftAnalysis) => void;
  setStatus: (status: ConnStatus) => void;
}

function isMockUrl(url: string) {
  return /localhost|127\.0\.0\.1|8181/.test(url);
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isReading(v: unknown): v is { roll: number; pitch: number } {
  return !!v && typeof v === "object" && isFiniteNum((v as { roll: unknown }).roll) && isFiniteNum((v as { pitch: unknown }).pitch);
}

function parseFrame(raw: unknown): SensorFrame | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as Record<string, unknown>;
  if (!isFiniteNum(f.t)) return null;
  if (!isReading(f.s1) || !isReading(f.s2) || !isReading(f.s3) || !isReading(f.s4)) return null;
  if (f.s5 !== undefined && !isReading(f.s5)) return null;
  return f as unknown as SensorFrame;
}

export interface UseWorkerStreamOptions {
  onCoaching?: (text: string) => void;
  /** Skip Purdue and use instant fallback cues (demo mode) */
  skipCoach?: boolean;
}

export function useWorkerStream(
  url: string | null,
  options: UseWorkerStreamOptions = {},
): UseWorkerStreamResult {
  const [frame, setFrame] = useState<SensorFrame | null>(null);
  const [lifts, setLifts] = useState<LiftResult[]>([]);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const detectorRef = useRef<LiftDetector>(createLiftDetector());
  const onCoachingRef = useRef(options.onCoaching);
  const skipCoachRef = useRef(options.skipCoach ?? false);
  useEffect(() => {
    onCoachingRef.current = options.onCoaching;
    skipCoachRef.current = options.skipCoach ?? false;
  }, [options.onCoaching, options.skipCoach]);

  const updateLift = useCallback(
    (liftNumber: number, patch: Partial<LiftResult>) => {
      setLifts((prev) =>
        prev.map((r) => (r.analysis.liftNumber === liftNumber ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const fetchCoaching = useCallback(
    async (analysis: LiftAnalysis) => {
      const attempt = async () => {
        const res = await fetch("/api/worker-coach", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(analysis),
        });
        if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
        return res;
      };

      try {
        let res: Response;
        try {
          res = await attempt();
        } catch {
          await new Promise((r) => setTimeout(r, 800));
          res = await attempt();
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { coaching?: string; error?: string };
        const coaching = data.coaching ?? clientFallback(analysis);
        updateLift(analysis.liftNumber, { coaching, coachingPending: false });
        onCoachingRef.current?.(coaching);
      } catch {
        const coaching = clientFallback(analysis);
        updateLift(analysis.liftNumber, { coaching, coachingPending: false });
        onCoachingRef.current?.(coaching);
      }
    },
    [updateLift],
  );

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      setStatus("connecting");
      try {
        ws = new WebSocket(url);
      } catch {
        setStatus("error");
        retryTimer = setTimeout(connect, 2000);
        return;
      }

      ws.onopen = () => {
        if (cancelled) return;
        setStatus(isMockUrl(url) ? "mock" : "live");
      };
      ws.onclose = () => {
        if (cancelled) return;
        setStatus("disconnected");
        retryTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        if (cancelled) return;
        setStatus("error");
      };
      ws.onmessage = (evt) => {
        if (cancelled) return;
        let raw: unknown;
        try {
          raw = JSON.parse(evt.data);
        } catch {
          return;
        }
        const f = parseFrame(raw);
        if (!f) return;
        setFrame(f);
        const completed = detectorRef.current.onFrame(f);
        if (completed) {
          const analysis = analyzeLift(completed);
          if (skipCoachRef.current) {
            const coaching = clientFallback(analysis);
            setLifts((prev) => [{ analysis, coaching, coachingPending: false }, ...prev]);
            onCoachingRef.current?.(coaching);
          } else {
            setLifts((prev) => [{ analysis, coachingPending: true }, ...prev]);
            void fetchCoaching(analysis);
          }
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [url, fetchCoaching]);

  const reset = useCallback(() => {
    detectorRef.current.reset();
    setLifts([]);
  }, []);

  const injectLift = useCallback(
    (analysis: LiftAnalysis) => {
      if (skipCoachRef.current) {
        const coaching = clientFallback(analysis);
        setLifts((prev) => [{ analysis, coaching, coachingPending: false }, ...prev]);
        onCoachingRef.current?.(coaching);
      } else {
        setLifts((prev) => [{ analysis, coachingPending: true }, ...prev]);
        void fetchCoaching(analysis);
      }
    },
    [fetchCoaching],
  );

  const liftCount = lifts.length;
  const safeLifts = lifts.filter((r) => r.analysis.errorsDetected.length === 0).length;

  return { frame, lifts, status, liftCount, safeLifts, reset, injectLift, setStatus };
}
