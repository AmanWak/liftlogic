"use client";
import { useEffect, useRef, useState } from "react";
import type { SensorFrame } from "./types";
import { FALL } from "./config";

interface BufferedFrame {
  t: number;
  s1Pitch: number;
  s2Pitch: number;
}

type DetectorState = "armed" | "confirming" | "latched";

interface DetectorRuntime {
  state: DetectorState;
  buffer: BufferedFrame[];
  confirmStart: number;
  confirmS1Min: number;
  confirmS1Max: number;
  confirmS2Min: number;
  confirmS2Max: number;
  latchUntil: number;
}

function makeRuntime(): DetectorRuntime {
  return {
    state: "armed",
    buffer: [],
    confirmStart: 0,
    confirmS1Min: 0,
    confirmS1Max: 0,
    confirmS2Min: 0,
    confirmS2Max: 0,
    latchUntil: 0,
  };
}

export interface UseFallDetectorResult {
  fallTrigger: number;
}

/**
 * Pitch-only fall detector. MPU-6050 frames expose filtered {roll, pitch} only —
 * we infer a fall from (1) a sudden collapse in torso pitch, (2) near-horizontal
 * posture, and (3) prolonged stillness. Returns a counter that increments each
 * time a fall is confirmed, matching the flashTrigger pattern in useLiveErrors.
 */
export function useFallDetector(
  frame: SensorFrame | null,
  enabled: boolean,
): UseFallDetectorResult {
  const runtimeRef = useRef<DetectorRuntime>(makeRuntime());
  const [fallTrigger, setFallTrigger] = useState(0);

  useEffect(() => {
    if (!enabled) {
      runtimeRef.current = makeRuntime();
      return;
    }
    if (!frame) return;

    const r = runtimeRef.current;
    const now = frame.t;
    const s1p = frame.s1.pitch;
    const s2p = frame.s2.pitch;

    r.buffer.push({ t: now, s1Pitch: s1p, s2Pitch: s2p });
    const cutoff = now - FALL.BUFFER_MS;
    while (r.buffer.length > 0 && r.buffer[0].t < cutoff) r.buffer.shift();

    if (r.state === "latched") {
      if (now >= r.latchUntil) r.state = "armed";
      return;
    }

    if (r.state === "armed") {
      const windowCutoff = now - FALL.IMPACT_WINDOW_MS;
      const past = r.buffer.find((b) => b.t >= windowCutoff);
      if (!past) return;
      const delta = Math.abs(s1p) - Math.abs(past.s1Pitch);
      if (
        delta >= FALL.IMPACT_DELTA_DEG &&
        Math.abs(s1p) >= FALL.HORIZONTAL_PITCH_DEG
      ) {
        r.state = "confirming";
        r.confirmStart = now;
        r.confirmS1Min = s1p;
        r.confirmS1Max = s1p;
        r.confirmS2Min = s2p;
        r.confirmS2Max = s2p;
      }
      return;
    }

    if (s1p < r.confirmS1Min) r.confirmS1Min = s1p;
    if (s1p > r.confirmS1Max) r.confirmS1Max = s1p;
    if (s2p < r.confirmS2Min) r.confirmS2Min = s2p;
    if (s2p > r.confirmS2Max) r.confirmS2Max = s2p;

    const s1Spread = r.confirmS1Max - r.confirmS1Min;
    const s2Spread = r.confirmS2Max - r.confirmS2Min;

    if (
      s1Spread > FALL.STILLNESS_SPREAD_DEG ||
      s2Spread > FALL.STILLNESS_SPREAD_DEG
    ) {
      r.state = "armed";
      return;
    }

    if (now - r.confirmStart >= FALL.STILLNESS_MS) {
      r.state = "latched";
      r.latchUntil = now + FALL.LATCH_MS;
      setFallTrigger((n) => n + 1);
    }
  }, [frame, enabled]);

  return { fallTrigger };
}
