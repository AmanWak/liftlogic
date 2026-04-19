"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormAnalysis, FormError, SensorFrame } from "./types";

const REP_INTERVAL_MS = 3500;
const TOTAL_REPS = 7;
const FRAME_HZ = 30;

interface ScriptedRep {
  errors: FormError[];
  base: Omit<FormAnalysis, "repNumber" | "errorsDetected" | "durationMs">;
  durationMs: number;
}

// 7 reps: 6 counted (alternating clean/error) + 1 shallow REDO at the end.
// Counted form score = (100+70+100+70+100+70)/6 = 85% → streak fires on first run.
const SCRIPT: ScriptedRep[] = [
  {
    errors: [],
    base: { depthDegrees: -3, maxForwardLean: 32, lumbarFlexionDelta: 7, kneeValgusAsymmetry: 4, hipShiftMax: 3 },
    durationMs: 2800,
  },
  {
    errors: ["knee_valgus"],
    base: { depthDegrees: -1, maxForwardLean: 35, lumbarFlexionDelta: 8, kneeValgusAsymmetry: 16, hipShiftMax: 4 },
    durationMs: 2600,
  },
  {
    errors: [],
    base: { depthDegrees: -4, maxForwardLean: 30, lumbarFlexionDelta: 6, kneeValgusAsymmetry: 3, hipShiftMax: 2 },
    durationMs: 2900,
  },
  {
    errors: ["excessive_forward_lean"],
    base: { depthDegrees: -2, maxForwardLean: 52, lumbarFlexionDelta: 9, kneeValgusAsymmetry: 5, hipShiftMax: 3 },
    durationMs: 2700,
  },
  {
    errors: [],
    base: { depthDegrees: -3, maxForwardLean: 31, lumbarFlexionDelta: 7, kneeValgusAsymmetry: 4, hipShiftMax: 2 },
    durationMs: 2850,
  },
  {
    errors: ["hip_shift"],
    base: { depthDegrees: -2, maxForwardLean: 36, lumbarFlexionDelta: 7, kneeValgusAsymmetry: 6, hipShiftMax: 12 },
    durationMs: 2550,
  },
  {
    // Shallow rep — does not count, demos REDO badge and instant coaching
    errors: ["insufficient_depth"],
    base: { depthDegrees: 14, maxForwardLean: 34, lumbarFlexionDelta: 6, kneeValgusAsymmetry: 4, hipShiftMax: 3 },
    durationMs: 2100,
  },
];

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
  // Sensor convention: negative pitch = forward flexion (matches thigh signs).
  // Upper torso (s1) folds forward; lumbar (s2) stays near its baseline.
  const s1Pitch = -leanAtDepth;
  const s2Pitch = 0;

  return {
    t: Date.now(),
    s1: { roll: 0, pitch: s1Pitch },
    s2: { roll: 0, pitch: s2Pitch },
    s3: { roll: valgusRoll, pitch: s3Pitch },
    s4: { roll: -valgusRoll, pitch: s4Pitch },
  };
}

function buildAnalysis(repIndex: number, script: ScriptedRep): FormAnalysis {
  const { base, errors, durationMs } = script;
  return {
    repNumber: repIndex + 1,
    depthDegrees: round(base.depthDegrees + jitter(2)),
    maxForwardLean: round(Math.max(0, base.maxForwardLean + jitter(2))),
    lumbarFlexionDelta: round(Math.max(0, base.lumbarFlexionDelta + jitter(2))),
    kneeValgusAsymmetry: round(Math.max(0, base.kneeValgusAsymmetry + jitter(2))),
    hipShiftMax: round(Math.max(0, base.hipShiftMax + jitter(2))),
    errorsDetected: errors,
    durationMs: Math.round(durationMs + jitter(150)),
  };
}

export interface UseDemoModeResult {
  isPlaying: boolean;
  completed: boolean;
  frame: SensorFrame | null;
  replay: () => void;
}

export function useDemoMode(
  active: boolean,
  injectRep: (analysis: FormAnalysis) => void,
): UseDemoModeResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [frame, setFrame] = useState<SensorFrame | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const injectRef = useRef(injectRep);
  const runIdRef = useRef(0);

  useEffect(() => {
    injectRef.current = injectRep;
  }, [injectRep]);

  const stopFrames = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    stopFrames();
  }, [stopFrames]);

  const animateRep = useCallback((script: ScriptedRep) => {
    stopFrames();
    const startMs = Date.now();
    const durationMs = script.durationMs;
    frameIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const t = Math.min(elapsed / durationMs, 1);
      setFrame(makeFrame(t, script));
      if (t >= 1) stopFrames();
    }, 1000 / FRAME_HZ);
  }, [stopFrames]);

  const run = useCallback(() => {
    stop();
    runIdRef.current += 1;
    const thisRun = runIdRef.current;
    setIsPlaying(true);
    setCompleted(false);
    setFrame(makeFrame(0, SCRIPT[0]));

    const fire = (i: number) => {
      if (thisRun !== runIdRef.current) return;
      if (i >= TOTAL_REPS) {
        setIsPlaying(false);
        setCompleted(true);
        setFrame(makeFrame(0, SCRIPT[0]));
        return;
      }
      injectRef.current(buildAnalysis(i, SCRIPT[i]));
      animateRep(SCRIPT[i]);
      timerRef.current = setTimeout(() => fire(i + 1), REP_INTERVAL_MS);
    };

    timerRef.current = setTimeout(() => fire(0), 400);
  }, [stop, animateRep]);

  useEffect(() => {
    if (active) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: sync demo player to `active` prop
      run();
    } else {
      stop();
      runIdRef.current += 1;
      setIsPlaying(false);
      setCompleted(false);
      setFrame(null);
    }
    return stop;
  }, [active, run, stop]);

  const replay = useCallback(() => {
    if (!active) return;
    run();
  }, [active, run]);

  return { isPlaying, completed, frame, replay };
}
