"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormAnalysis, FormError, SensorFrame } from "./types";

export type DemoErrorKind =
  | "clean"
  | "knee_valgus"
  | "insufficient_depth"
  | "excessive_forward_lean"
  | "hip_shift"
  | "lumbar_flexion";

const FRAME_HZ = 30;

interface ScriptedRep {
  errors: FormError[];
  base: Omit<FormAnalysis, "repNumber" | "errorsDetected" | "durationMs">;
  durationMs: number;
}

const SCRIPT_BY_KIND: Record<DemoErrorKind, ScriptedRep> = {
  clean: {
    errors: [],
    base: { depthDegrees: -3, maxForwardLean: 32, lumbarFlexionDelta: 7, kneeValgusAsymmetry: 4, hipShiftMax: 3 },
    durationMs: 2800,
  },
  knee_valgus: {
    errors: ["knee_valgus"],
    base: { depthDegrees: -1, maxForwardLean: 35, lumbarFlexionDelta: 8, kneeValgusAsymmetry: 16, hipShiftMax: 4 },
    durationMs: 2600,
  },
  insufficient_depth: {
    errors: ["insufficient_depth"],
    base: { depthDegrees: 14, maxForwardLean: 34, lumbarFlexionDelta: 6, kneeValgusAsymmetry: 4, hipShiftMax: 3 },
    durationMs: 2100,
  },
  excessive_forward_lean: {
    errors: ["excessive_forward_lean"],
    base: { depthDegrees: -2, maxForwardLean: 52, lumbarFlexionDelta: 9, kneeValgusAsymmetry: 5, hipShiftMax: 3 },
    durationMs: 2700,
  },
  hip_shift: {
    errors: ["hip_shift"],
    base: { depthDegrees: -2, maxForwardLean: 36, lumbarFlexionDelta: 7, kneeValgusAsymmetry: 6, hipShiftMax: 12 },
    durationMs: 2550,
  },
  lumbar_flexion: {
    errors: ["lumbar_flexion"],
    base: { depthDegrees: -2, maxForwardLean: 38, lumbarFlexionDelta: 22, kneeValgusAsymmetry: 4, hipShiftMax: 3 },
    durationMs: 2700,
  },
};

const jitter = (range: number) => (Math.random() * 2 - 1) * range;
const round = (n: number) => Math.round(n * 10) / 10;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function squatDepthT(t: number): number {
  if (t < 0.42) return easeCubic(t / 0.42);
  if (t < 0.56) return 1;
  return 1 - easeCubic((t - 0.56) / 0.44);
}

function makeFrame(t: number, script: ScriptedRep): SensorFrame {
  const d = squatDepthT(t);
  const errors = script.errors;

  const targetPitch = errors.includes("insufficient_depth") ? -52 : -90;
  const thighBase = lerp(0, targetPitch, d);

  const hipShiftPeak = errors.includes("hip_shift") ? 13 : 0;
  const s3Pitch = thighBase - lerp(0, hipShiftPeak / 2, d);
  const s4Pitch = thighBase + lerp(0, hipShiftPeak / 2, d);

  const valgusRoll = errors.includes("knee_valgus") ? lerp(0, 17, d) : 0;

  const leanPeak = errors.includes("excessive_forward_lean") ? 52 : 31;
  const leanAtDepth = leanPeak * (0.5 + 0.5 * d);
  const lumbarDelta = errors.includes("lumbar_flexion") ? lerp(0, 22, d) : 0;

  const s1Pitch = -leanAtDepth;
  const s2Pitch = errors.includes("lumbar_flexion") ? -lumbarDelta : 0;

  return {
    t: Date.now(),
    s1: { roll: 0, pitch: s1Pitch },
    s2: { roll: 0, pitch: s2Pitch },
    s3: { roll: valgusRoll, pitch: s3Pitch },
    s4: { roll: -valgusRoll, pitch: s4Pitch },
  };
}

function buildAnalysis(repNumber: number, script: ScriptedRep): FormAnalysis {
  const { base, errors, durationMs } = script;
  return {
    repNumber,
    depthDegrees: round(base.depthDegrees + jitter(2)),
    maxForwardLean: round(Math.max(0, base.maxForwardLean + jitter(2))),
    lumbarFlexionDelta: round(Math.max(0, base.lumbarFlexionDelta + jitter(2))),
    kneeValgusAsymmetry: round(Math.max(0, base.kneeValgusAsymmetry + jitter(2))),
    hipShiftMax: round(Math.max(0, base.hipShiftMax + jitter(2))),
    errorsDetected: errors,
    durationMs: Math.round(durationMs + jitter(150)),
  };
}

// Upright neutral frame (shown between reps and while idle)
function neutralFrame(): SensorFrame {
  return {
    t: Date.now(),
    s1: { roll: 0, pitch: 0 },
    s2: { roll: 0, pitch: 0 },
    s3: { roll: 0, pitch: 0 },
    s4: { roll: 0, pitch: 0 },
  };
}

export interface UseDemoModeResult {
  frame: SensorFrame | null;
  isAnimating: boolean;
  isFalling: boolean;
  triggerRep: (kind: DemoErrorKind) => void;
  triggerFall: () => void;
}

export function useDemoMode(
  active: boolean,
  injectRep: (analysis: FormAnalysis) => void,
): UseDemoModeResult {
  const [frame, setFrame] = useState<SensorFrame | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFalling, setIsFalling] = useState(false);

  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animRunIdRef = useRef(0);
  const repCounterRef = useRef(0);
  const injectRef = useRef(injectRep);
  useEffect(() => { injectRef.current = injectRep; }, [injectRep]);

  const stopAnimation = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  const triggerRep = useCallback((kind: DemoErrorKind) => {
    if (!active) return;

    stopAnimation();
    animRunIdRef.current += 1;
    const thisRun = animRunIdRef.current;

    const script = SCRIPT_BY_KIND[kind];
    const repNumber = ++repCounterRef.current;

    setIsAnimating(true);
    setIsFalling(false);

    // Inject analysis immediately so the rep card appears as the animation starts
    injectRef.current(buildAnalysis(repNumber, script));

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
  }, [active, stopAnimation]);

  const triggerFall = useCallback(() => {
    if (!active) return;

    stopAnimation();
    animRunIdRef.current += 1;
    const thisRun = animRunIdRef.current;

    setIsAnimating(true);
    setIsFalling(true);

    // Phase durations (ms)
    const UPRIGHT_MS = 150;
    const IMPACT_MS = 350;
    const STILLNESS_MS = 1600; // > FALL.STILLNESS_MS (1200) to ensure detector fires

    const totalMs = UPRIGHT_MS + IMPACT_MS + STILLNESS_MS;
    const startMs = Date.now();

    frameIntervalRef.current = setInterval(() => {
      if (thisRun !== animRunIdRef.current) return;
      const elapsed = Date.now() - startMs;
      const t = Math.min(elapsed / totalMs, 1);
      const now = Date.now();

      let s1Pitch: number;
      if (elapsed < UPRIGHT_MS) {
        // Phase 1: stay upright so detector buffer has a recent low-pitch baseline
        s1Pitch = 0;
      } else if (elapsed < UPRIGHT_MS + IMPACT_MS) {
        // Phase 2: rapid sweep 0 → -90° (impact delta triggers detector)
        const impactT = (elapsed - UPRIGHT_MS) / IMPACT_MS;
        s1Pitch = lerp(0, -90, easeCubic(impactT));
      } else {
        // Phase 3: sustained horizontal stillness (< 4° spread triggers confirmation)
        s1Pitch = -90 + (Math.random() * 2 - 1) * 0.4; // tiny jitter, well under 4°
      }

      setFrame({
        t: now,
        s1: { roll: 0, pitch: s1Pitch },
        s2: { roll: 0, pitch: s1Pitch * 0.5 },
        s3: { roll: 0, pitch: -20 },
        s4: { roll: 0, pitch: -20 },
      });

      if (t >= 1) {
        stopAnimation();
        setIsAnimating(false);
        setIsFalling(false);
        setFrame(neutralFrame());
      }
    }, 1000 / FRAME_HZ);
  }, [active, stopAnimation]);

  // When demo mode is toggled off, reset everything
  useEffect(() => {
    if (!active) {
      stopAnimation();
      animRunIdRef.current += 1;
      repCounterRef.current = 0;
      setFrame(null);
      setIsAnimating(false);
      setIsFalling(false);
    } else {
      // Show neutral pose on entry
      setFrame(neutralFrame());
    }
    return stopAnimation;
  }, [active, stopAnimation]);

  return { frame, isAnimating, isFalling, triggerRep, triggerFall };
}
