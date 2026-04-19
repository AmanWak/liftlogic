"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SensorFrame } from "./types";
import type { LiftAnalysis, WorkerFormError } from "./types-worker";

const FRAME_HZ = 30;

export type DemoLiftKind =
  | "clean"
  | "back_rounded"
  | "stiff_leg_lift"
  | "overloaded_lean"
  | "asymmetric_load";

interface ScriptedLift {
  errors: WorkerFormError[];
  base: Omit<LiftAnalysis, "liftNumber" | "errorsDetected" | "durationMs">;
  durationMs: number;
  torsoPeak: number;      // deepest s1 pitch (negative)
  thighPeak: number;      // deepest (s3+s4)/2 pitch (negative)
  lumbarPeak: number;     // max |s2 - baseline| at bottom (positive magnitude)
  legRollSplit: number;   // peak s3-s4 roll split
  torsoRollSplit: number; // peak s1-s2 roll split
}

const SCRIPT_BY_KIND: Record<DemoLiftKind, ScriptedLift> = {
  clean: {
    errors: [],
    base: {
      maxTorsoFlexion: 58,
      maxLumbarDelta: 8,
      avgThighFlexion: 26,
      maxLegAsymmetry: 3,
      maxTorsoSideBend: 4,
    },
    durationMs: 3200,
    torsoPeak: -60,
    thighPeak: -40,
    lumbarPeak: 8,
    legRollSplit: 0,
    torsoRollSplit: 0,
  },
  back_rounded: {
    errors: ["back_rounded"],
    base: {
      maxTorsoFlexion: 62,
      maxLumbarDelta: 32,
      avgThighFlexion: 24,
      maxLegAsymmetry: 4,
      maxTorsoSideBend: 5,
    },
    durationMs: 3300,
    torsoPeak: -62,
    thighPeak: -34,
    lumbarPeak: 35,
    legRollSplit: 0,
    torsoRollSplit: 0,
  },
  stiff_leg_lift: {
    errors: ["stiff_leg_lift"],
    base: {
      maxTorsoFlexion: 72,
      maxLumbarDelta: 14,
      avgThighFlexion: 10,
      maxLegAsymmetry: 4,
      maxTorsoSideBend: 4,
    },
    durationMs: 3400,
    torsoPeak: -72,
    thighPeak: -12,
    lumbarPeak: 14,
    legRollSplit: 0,
    torsoRollSplit: 0,
  },
  overloaded_lean: {
    errors: ["overloaded_lean"],
    base: {
      maxTorsoFlexion: 82,
      maxLumbarDelta: 18,
      avgThighFlexion: 22,
      maxLegAsymmetry: 4,
      maxTorsoSideBend: 5,
    },
    durationMs: 3500,
    torsoPeak: -82,
    thighPeak: -30,
    lumbarPeak: 18,
    legRollSplit: 0,
    torsoRollSplit: 0,
  },
  asymmetric_load: {
    errors: ["asymmetric_load"],
    base: {
      maxTorsoFlexion: 60,
      maxLumbarDelta: 10,
      avgThighFlexion: 25,
      maxLegAsymmetry: 16,
      maxTorsoSideBend: 14,
    },
    durationMs: 3300,
    torsoPeak: -60,
    thighPeak: -38,
    lumbarPeak: 10,
    legRollSplit: 18,
    torsoRollSplit: 14,
  },
};

const jitter = (range: number) => (Math.random() * 2 - 1) * range;
const round = (n: number) => Math.round(n * 10) / 10;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function liftDepthT(t: number): number {
  if (t < 0.42) return easeCubic(t / 0.42);
  if (t < 0.56) return 1;
  return 1 - easeCubic((t - 0.56) / 0.44);
}

function makeFrame(t: number, script: ScriptedLift): SensorFrame {
  const d = liftDepthT(t);

  const s1Pitch = lerp(0, script.torsoPeak, d);
  const s2Pitch = lerp(0, script.torsoPeak * 0.3, d) - lerp(0, script.lumbarPeak, d);

  const thighBase = lerp(0, script.thighPeak, d);
  const s3Pitch = thighBase - lerp(0, script.legRollSplit / 2, d);
  const s4Pitch = thighBase + lerp(0, script.legRollSplit / 2, d);

  const legRoll = lerp(0, script.legRollSplit, d);
  const torsoRoll = lerp(0, script.torsoRollSplit, d);

  return {
    t: Date.now(),
    s1: { roll: torsoRoll, pitch: s1Pitch },
    s2: { roll: 0, pitch: s2Pitch },
    s3: { roll: legRoll, pitch: s3Pitch },
    s4: { roll: -legRoll, pitch: s4Pitch },
  };
}

function buildAnalysis(liftNumber: number, script: ScriptedLift): LiftAnalysis {
  const { base, errors, durationMs } = script;
  return {
    liftNumber,
    maxTorsoFlexion: round(Math.max(0, base.maxTorsoFlexion + jitter(2))),
    maxLumbarDelta: round(Math.max(0, base.maxLumbarDelta + jitter(2))),
    avgThighFlexion: round(Math.max(0, base.avgThighFlexion + jitter(2))),
    maxLegAsymmetry: round(Math.max(0, base.maxLegAsymmetry + jitter(1))),
    maxTorsoSideBend: round(Math.max(0, base.maxTorsoSideBend + jitter(1))),
    errorsDetected: errors,
    durationMs: Math.round(durationMs + jitter(150)),
  };
}

function neutralFrame(): SensorFrame {
  return {
    t: Date.now(),
    s1: { roll: 0, pitch: 0 },
    s2: { roll: 0, pitch: 0 },
    s3: { roll: 0, pitch: 0 },
    s4: { roll: 0, pitch: 0 },
  };
}

// Synthetic fall profile: upright baseline → rapid pitch collapse → stillness.
const FALL_BASELINE_MS = 700;
const FALL_RAMP_MS = 400;
const FALL_HOLD_MS = 2200;
const FALL_PEAK_PITCH = 85;

function makeFallFrame(elapsedMs: number): SensorFrame {
  let s1Pitch: number;
  if (elapsedMs < FALL_BASELINE_MS) {
    s1Pitch = 0;
  } else if (elapsedMs < FALL_BASELINE_MS + FALL_RAMP_MS) {
    const t = (elapsedMs - FALL_BASELINE_MS) / FALL_RAMP_MS;
    s1Pitch = easeCubic(t) * FALL_PEAK_PITCH;
  } else {
    s1Pitch = FALL_PEAK_PITCH + jitter(0.6);
  }
  return {
    t: Date.now(),
    s1: { roll: 0, pitch: s1Pitch },
    s2: { roll: 0, pitch: s1Pitch * 0.9 },
    s3: { roll: 0, pitch: s1Pitch * 0.4 },
    s4: { roll: 0, pitch: s1Pitch * 0.4 },
  };
}

export interface UseDemoWorkerResult {
  frame: SensorFrame | null;
  isAnimating: boolean;
  isFalling: boolean;
  triggerLift: (kind: DemoLiftKind) => void;
  triggerFall: () => void;
}

export function useDemoWorker(
  active: boolean,
  injectLift: (analysis: LiftAnalysis) => void,
): UseDemoWorkerResult {
  const [frame, setFrame] = useState<SensorFrame | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFalling, setIsFalling] = useState(false);

  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRunIdRef = useRef(0);
  const liftCounterRef = useRef(0);
  const injectRef = useRef(injectLift);
  useEffect(() => {
    injectRef.current = injectLift;
  }, [injectLift]);

  const stopAnimation = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  const triggerLift = useCallback(
    (kind: DemoLiftKind) => {
      if (!active) return;

      stopAnimation();
      animRunIdRef.current += 1;
      const thisRun = animRunIdRef.current;

      const script = SCRIPT_BY_KIND[kind];
      const liftNumber = ++liftCounterRef.current;

      setIsAnimating(true);
      setIsFalling(false);

      injectRef.current(buildAnalysis(liftNumber, script));

      const startMs = Date.now();
      frameIntervalRef.current = setInterval(() => {
        if (thisRun !== animRunIdRef.current) return;
        const elapsed = Date.now() - startMs;
        const t = Math.min(elapsed / script.durationMs, 1);
        setFrame(makeFrame(t, script));
        if (t >= 1) {
          stopAnimation();
          setFrame(neutralFrame());
          setIsAnimating(false);
        }
      }, 1000 / FRAME_HZ);
    },
    [active, stopAnimation],
  );

  const triggerFall = useCallback(() => {
    if (!active) return;

    stopAnimation();
    animRunIdRef.current += 1;
    const thisRun = animRunIdRef.current;

    setIsAnimating(true);
    setIsFalling(true);
    const startMs = Date.now();
    const totalMs = FALL_BASELINE_MS + FALL_RAMP_MS + FALL_HOLD_MS;

    frameIntervalRef.current = setInterval(() => {
      if (thisRun !== animRunIdRef.current) return;
      const elapsed = Date.now() - startMs;
      setFrame(makeFallFrame(elapsed));
      if (elapsed >= totalMs) {
        stopAnimation();
        setIsAnimating(false);
        setIsFalling(false);
        setFrame(neutralFrame());
      }
    }, 1000 / FRAME_HZ);
  }, [active, stopAnimation]);

  useEffect(() => {
    if (!active) {
      stopAnimation();
      animRunIdRef.current += 1;
      liftCounterRef.current = 0;
      setFrame(null);
      setIsAnimating(false);
      setIsFalling(false);
    } else {
      setFrame(neutralFrame());
    }
    return stopAnimation;
  }, [active, stopAnimation]);

  return { frame, isAnimating, isFalling, triggerLift, triggerFall };
}
