import type { RepWindow, FormAnalysis, FormError } from "./types";
import { THRESHOLDS } from "./config";

const round = (n: number) => Math.round(n * 10) / 10;

export function analyzeRep(rep: RepWindow): FormAnalysis {
  const { frames, baseline } = rep;

  let maxForwardLean = 0;
  let maxLumbarDelta = 0;
  let maxKneeValgus = 0;
  let maxHipShift = 0;
  let depthDegrees = Infinity;
  let maxBarPath = 0;
  let hasBar = false;

  for (const f of frames) {
    const lean = Math.abs(f.s1.pitch - f.s2.pitch);
    if (lean > maxForwardLean) maxForwardLean = lean;

    const lumbarDelta = Math.abs(f.s2.pitch - baseline.s2Pitch);
    if (lumbarDelta > maxLumbarDelta) maxLumbarDelta = lumbarDelta;

    const valgus = Math.abs(f.s3.roll - f.s4.roll);
    if (valgus > maxKneeValgus) maxKneeValgus = valgus;

    const hipShift = Math.abs(f.s3.pitch - f.s4.pitch);
    if (hipShift > maxHipShift) maxHipShift = hipShift;

    const minThigh = Math.min(f.s3.pitch, f.s4.pitch);
    if (minThigh < depthDegrees) depthDegrees = minThigh;

    if (f.s5) {
      hasBar = true;
      const barDev = Math.abs(f.s5.roll);
      if (barDev > maxBarPath) maxBarPath = barDev;
    }
  }

  const errors: FormError[] = [];
  if (maxForwardLean > THRESHOLDS.FORWARD_LEAN) errors.push("excessive_forward_lean");
  if (maxLumbarDelta > THRESHOLDS.LUMBAR_FLEXION) errors.push("lumbar_flexion");
  if (maxKneeValgus > THRESHOLDS.KNEE_VALGUS) errors.push("knee_valgus");
  if (maxHipShift > THRESHOLDS.HIP_SHIFT) errors.push("hip_shift");
  if (depthDegrees > THRESHOLDS.DEPTH_PARALLEL) errors.push("insufficient_depth");
  if (hasBar && maxBarPath > THRESHOLDS.BAR_PATH) errors.push("bar_path_deviation");

  return {
    repNumber: rep.repNumber,
    depthDegrees: round(depthDegrees),
    maxForwardLean: round(maxForwardLean),
    lumbarFlexionDelta: round(maxLumbarDelta),
    kneeValgusAsymmetry: round(maxKneeValgus),
    hipShiftMax: round(maxHipShift),
    barPathDeviation: hasBar ? round(maxBarPath) : undefined,
    errorsDetected: errors,
    durationMs: rep.endT - rep.startT,
  };
}
