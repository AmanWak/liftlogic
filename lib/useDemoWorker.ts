"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SensorFrame } from "./types";
import type { LiftAnalysis, WorkerFormError } from "./types-worker";

const LIFT_INTERVAL_MS = 4000;
const TOTAL_LIFTS = 3;
const FRAME_HZ = 30;

interface ScriptedLift {
  errors: WorkerFormError[];
  base: Omit<LiftAnalysis, "liftNumber" | "errorsDetected" | "durationMs">;
  durationMs: number;
  torsoPeak: number;    // deepest s1 pitch (negative)
  thighPeak: number;    // deepest (s3+s4)/2 pitch (negative)
  lumbarPeak: number;   // max |s2 - baseline| at bottom (positive magnitude)
  legRollSplit: number; // peak s3-s4 roll split (positive puts more on s3)
  torsoRollSplit: number; // peak s1-s2 roll split
}

// 3 scripted lifts: clean hip-hinge, back-rounded, stiff-leg.
const SCRIPT: ScriptedLift[] = [
  {
    // Clean hip-hinge lift — legs drive, back stays near neutral.
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
  {
    // Back-rounded lift — lumbar spikes 35° at the bottom.
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
  {
    // Stiff-leg lift — torso folds hard, thighs barely move.
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
];

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
  // Lumbar baseline is 0; drift grows with depth on back_rounded lifts.
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

function buildAnalysis(index: number, script: ScriptedLift): LiftAnalysis {
  const { base, errors, durationMs } = script;
  return {
    liftNumber: index + 1,
    maxTorsoFlexion: round(Math.max(0, base.maxTorsoFlexion + jitter(2))),
    maxLumbarDelta: round(Math.max(0, base.maxLumbarDelta + jitter(2))),
    avgThighFlexion: round(Math.max(0, base.avgThighFlexion + jitter(2))),
    maxLegAsymmetry: round(Math.max(0, base.maxLegAsymmetry + jitter(1))),
    maxTorsoSideBend: round(Math.max(0, base.maxTorsoSideBend + jitter(1))),
    errorsDetected: errors,
    durationMs: Math.round(durationMs + jitter(150)),
  };
}

export interface UseDemoWorkerResult {
  isPlaying: boolean;
  completed: boolean;
  frame: SensorFrame | null;
  replay: () => void;
}

export function useDemoWorker(
  active: boolean,
  injectLift: (analysis: LiftAnalysis) => void,
): UseDemoWorkerResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [frame, setFrame] = useState<SensorFrame | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const injectRef = useRef(injectLift);
  const runIdRef = useRef(0);

  useEffect(() => {
    injectRef.current = injectLift;
  }, [injectLift]);

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

  const animateLift = useCallback(
    (script: ScriptedLift) => {
      stopFrames();
      const startMs = Date.now();
      const durationMs = script.durationMs;
      frameIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startMs;
        const t = Math.min(elapsed / durationMs, 1);
        setFrame(makeFrame(t, script));
        if (t >= 1) stopFrames();
      }, 1000 / FRAME_HZ);
    },
    [stopFrames],
  );

  const run = useCallback(() => {
    stop();
    runIdRef.current += 1;
    const thisRun = runIdRef.current;
    setIsPlaying(true);
    setCompleted(false);
    setFrame(makeFrame(0, SCRIPT[0]));

    const fire = (i: number) => {
      if (thisRun !== runIdRef.current) return;
      if (i >= TOTAL_LIFTS) {
        setIsPlaying(false);
        setCompleted(true);
        setFrame(makeFrame(0, SCRIPT[0]));
        return;
      }
      injectRef.current(buildAnalysis(i, SCRIPT[i]));
      animateLift(SCRIPT[i]);
      timerRef.current = setTimeout(() => fire(i + 1), LIFT_INTERVAL_MS);
    };

    timerRef.current = setTimeout(() => fire(0), 400);
  }, [stop, animateLift]);

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
