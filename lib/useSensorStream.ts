"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { SensorFrame, FormAnalysis, SensorHealthMap } from "./types";
import { createRepDetector, type RepDetector } from "./repDetector";
import { analyzeRep } from "./formAnalyzer";
import {
  applyCalibration,
  createSmoothState,
  resetSmoothState,
  DEFAULT_CALIBRATION,
  type SensorCalibration,
} from "./sensorCalibration";
import { createHealthTracker, type HealthTracker } from "./sensorHealth";

const SHALLOW_REP_COACHING = "Not deep enough — try again.";

function clientFallback(analysis: FormAnalysis): string {
  const error = analysis.errorsDetected[0];
  if (!error) return "Solid rep — keep that up.";
  const cues: Record<typeof error, string> = {
    excessive_forward_lean: "Too much forward lean — chest up, stay tall.",
    lumbar_flexion:         "Lower back rounding — brace your core.",
    knee_valgus:            "Knees caving — drive them out next rep.",
    hip_shift:              "Hips shifting — stay centered through the rep.",
    insufficient_depth:     SHALLOW_REP_COACHING,
    torso_twist:            "Torso twisting — keep chest square.",
  };
  return cues[error];
}

export type ConnStatus = "idle" | "connecting" | "live" | "mock" | "demo" | "disconnected" | "error";

export interface RepResult {
  analysis: FormAnalysis;
  coaching?: string;
  coachingPending: boolean;
  coachingError?: string;
}

export interface UseSensorStreamResult {
  frame: SensorFrame | null;
  rawFrame: SensorFrame | null;
  reps: RepResult[];
  status: ConnStatus;
  repCount: number;
  cleanReps: number;
  health: SensorHealthMap;
  reset: () => void;
  injectRep: (analysis: FormAnalysis) => void;
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

export interface UseSensorStreamOptions {
  onCoaching?: (text: string) => void;
  /** Skip Gemini and use instant fallback cues (demo mode) */
  skipGemini?: boolean;
  /** Calibration + smoothing config. Read live via ref so toggling doesn't reset stream. */
  calibration?: SensorCalibration;
}

export function useSensorStream(
  url: string | null,
  options: UseSensorStreamOptions = {},
): UseSensorStreamResult {
  const [frame, setFrame] = useState<SensorFrame | null>(null);
  const [rawFrame, setRawFrame] = useState<SensorFrame | null>(null);
  const [reps, setReps] = useState<RepResult[]>([]);
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [health, setHealth] = useState<SensorHealthMap>(WARMING_HEALTH);
  const detectorRef = useRef<RepDetector>(createRepDetector());
  const smoothRef = useRef(createSmoothState());
  const healthRef = useRef<HealthTracker>(createHealthTracker());
  const calibrationRef = useRef<SensorCalibration>(options.calibration ?? DEFAULT_CALIBRATION);
  const onCoachingRef = useRef(options.onCoaching);
  const skipGeminiRef = useRef(options.skipGemini ?? false);
  useEffect(() => {
    onCoachingRef.current = options.onCoaching;
    skipGeminiRef.current = options.skipGemini ?? false;
    if (options.calibration) calibrationRef.current = options.calibration;
  }, [options.onCoaching, options.skipGemini, options.calibration]);

  const updateRep = useCallback(
    (repNumber: number, patch: Partial<RepResult>) => {
      setReps((prev) =>
        prev.map((r) => (r.analysis.repNumber === repNumber ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const fetchCoaching = useCallback(
    async (analysis: FormAnalysis) => {
      const attempt = async () => {
        const res = await fetch("/api/coach", {
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
        updateRep(analysis.repNumber, { coaching, coachingPending: false });
        onCoachingRef.current?.(coaching);
      } catch {
        const coaching = clientFallback(analysis);
        updateRep(analysis.repNumber, { coaching, coachingPending: false });
        onCoachingRef.current?.(coaching);
      }
    },
    [updateRep],
  );

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let thighsOnlinePrev = false;

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

        const thighsOnline = nextHealth.s3 === "online" && nextHealth.s4 === "online";
        if (!thighsOnline) {
          if (thighsOnlinePrev) detectorRef.current.reset();
          thighsOnlinePrev = false;
          return;
        }
        thighsOnlinePrev = true;

        const completed = detectorRef.current.onFrame(calibrated);
        if (completed) {
          const analysis = analyzeRep(completed, nextHealth);
          if (analysis.errorsDetected.includes("insufficient_depth") || skipGeminiRef.current) {
            const coaching = analysis.errorsDetected.includes("insufficient_depth")
              ? SHALLOW_REP_COACHING
              : clientFallback(analysis);
            setReps((prev) => [{ analysis, coaching, coachingPending: false }, ...prev]);
            onCoachingRef.current?.(coaching);
          } else {
            setReps((prev) => [{ analysis, coachingPending: true }, ...prev]);
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
    setReps([]);
    setHealth(WARMING_HEALTH);
  }, []);

  const injectRep = useCallback(
    (analysis: FormAnalysis) => {
      if (analysis.errorsDetected.includes("insufficient_depth") || skipGeminiRef.current) {
        const coaching = analysis.errorsDetected.includes("insufficient_depth")
          ? SHALLOW_REP_COACHING
          : clientFallback(analysis);
        setReps((prev) => [{ analysis, coaching, coachingPending: false }, ...prev]);
        onCoachingRef.current?.(coaching);
      } else {
        setReps((prev) => [{ analysis, coachingPending: true }, ...prev]);
        void fetchCoaching(analysis);
      }
    },
    [fetchCoaching],
  );

  const repCount = reps.length;
  const cleanReps = reps.filter((r) => r.analysis.errorsDetected.length === 0).length;

  return { frame, rawFrame, reps, status, repCount, cleanReps, health, reset, injectRep, setStatus };
}
