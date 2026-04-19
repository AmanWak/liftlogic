"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { SensorFrame, SensorHealthMap } from "./types";
import type { LiftAnalysis } from "./types-worker";
import { createLiftDetector, type LiftDetector } from "./liftDetector";
import { analyzeLift } from "./liftAnalyzer";
import {
  applyCalibration,
  createSmoothState,
  resetSmoothState,
  DEFAULT_CALIBRATION,
  type SensorCalibration,
} from "./sensorCalibration";
import { createHealthTracker, type HealthTracker } from "./sensorHealth";

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
  rawFrame: SensorFrame | null;
  lifts: LiftResult[];
  status: ConnStatus;
  liftCount: number;
  safeLifts: number;
  health: SensorHealthMap;
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

const WARMING_HEALTH: SensorHealthMap = {
  s1: "warming", s2: "warming", s3: "warming", s4: "warming", s5: "warming",
};

export interface UseWorkerStreamOptions {
  onCoaching?: (text: string) => void;
  /** Skip Purdue and use instant fallback cues (demo mode) */
  skipCoach?: boolean;
  /** Calibration + smoothing config. Read live via ref so toggling doesn't reset stream. */
  calibration?: SensorCalibration;
}

export function useWorkerStream(
  url: string | null,
  options: UseWorkerStreamOptions = {},
): UseWorkerStreamResult {
  const [frame, setFrame] = useState<SensorFrame | null>(null);
  const [rawFrame, setRawFrame] = useState<SensorFrame | null>(null);
  const [lifts, setLifts] = useState<LiftResult[]>([]);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [health, setHealth] = useState<SensorHealthMap>(WARMING_HEALTH);
  const detectorRef = useRef<LiftDetector>(createLiftDetector());
  const smoothRef = useRef(createSmoothState());
  const healthRef = useRef<HealthTracker>(createHealthTracker());
  const calibrationRef = useRef<SensorCalibration>(options.calibration ?? DEFAULT_CALIBRATION);
  const onCoachingRef = useRef(options.onCoaching);
  const skipCoachRef = useRef(options.skipCoach ?? false);
  useEffect(() => {
    onCoachingRef.current = options.onCoaching;
    skipCoachRef.current = options.skipCoach ?? false;
    if (options.calibration) calibrationRef.current = options.calibration;
  }, [options.onCoaching, options.skipCoach, options.calibration]);

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
    let torsoOnlinePrev = false;

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
        const rawFrame = parseFrame(raw);
        if (!rawFrame) return;
        const calibrated = applyCalibration(rawFrame, calibrationRef.current, smoothRef.current);
        const nextHealth = healthRef.current.update(rawFrame);
        setFrame(calibrated);
        setRawFrame(rawFrame);
        setHealth(nextHealth);

        const torsoOnline = nextHealth.s1 === "online" && nextHealth.s2 === "online";
        if (!torsoOnline) {
          if (torsoOnlinePrev) detectorRef.current.reset();
          torsoOnlinePrev = false;
          return;
        }
        torsoOnlinePrev = true;

        const completed = detectorRef.current.onFrame(calibrated);
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
    resetSmoothState(smoothRef.current);
    healthRef.current.reset();
    setLifts([]);
    setHealth(WARMING_HEALTH);
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

  return { frame, rawFrame, lifts, status, liftCount, safeLifts, health, reset, injectLift, setStatus };
}
