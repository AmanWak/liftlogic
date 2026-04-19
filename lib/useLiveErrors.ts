"use client";
import { useEffect, useRef, useState } from "react";
import type { SensorFrame } from "./types";
import { THRESHOLDS } from "./config";

function computeErrors(frame: SensorFrame, baselinePitch: number | null): Set<string> {
  const errors = new Set<string>();
  const torsoLean = frame.s1.pitch - frame.s2.pitch;
  const valgus = Math.abs(frame.s3.roll - frame.s4.roll);
  const hipShift = Math.abs(frame.s3.pitch - frame.s4.pitch);
  const lumbarDelta = baselinePitch !== null ? Math.abs(frame.s2.pitch - baselinePitch) : 0;
  if (Math.abs(torsoLean) > THRESHOLDS.FORWARD_LEAN) errors.add("torso");
  if (lumbarDelta > THRESHOLDS.LUMBAR_FLEXION) errors.add("lumbar");
  if (valgus > THRESHOLDS.KNEE_VALGUS) errors.add("knees");
  if (hipShift > THRESHOLDS.HIP_SHIFT) errors.add("hips");
  return errors;
}

export function useLiveErrors(
  frame: SensorFrame | null,
  baselineS2Pitch: number | null,
): { flashTrigger: number } {
  const prevRef = useRef(new Set<string>());
  const [flashTrigger, setFlashTrigger] = useState(0);

  useEffect(() => {
    if (!frame) {
      prevRef.current = new Set();
      return;
    }
    const current = computeErrors(frame, baselineS2Pitch);
    const prev = prevRef.current;
    const hasNewError = [...current].some((e) => !prev.has(e));
    if (hasNewError) setFlashTrigger((n) => n + 1);
    prevRef.current = current;
  }, [frame, baselineS2Pitch]);

  return { flashTrigger };
}
