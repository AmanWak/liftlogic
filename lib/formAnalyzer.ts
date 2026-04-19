import type { RepWindow, FormAnalysis, FormError, SensorHealthMap } from "./types";
import { THRESHOLDS } from "./config";

const round = (n: number) => Math.round(n * 10) / 10;

function online(health: SensorHealthMap | undefined, ...ids: Array<keyof SensorHealthMap>): boolean {
  if (!health) return true;
  return ids.every((id) => health[id] === "online");
}

export function analyzeRep(rep: RepWindow, health?: SensorHealthMap): FormAnalysis {
  const { frames, baseline } = rep;

  let maxForwardLean = 0;
  let maxLumbarDelta = 0;
  let maxKneeValgus = 0;
  let maxHipShift = 0;
  let depthDegrees = Infinity;
  let maxTorsoTwist = 0;

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
      const twist = Math.abs(f.s5.roll - baseline.s5Roll);
      if (twist > maxTorsoTwist) maxTorsoTwist = twist;
    }
  }

  const errors: FormError[] = [];
  if (online(health, "s1", "s2") && maxForwardLean > THRESHOLDS.FORWARD_LEAN) errors.push("excessive_forward_lean");
  if (online(health, "s2") && maxLumbarDelta > THRESHOLDS.LUMBAR_FLEXION) errors.push("lumbar_flexion");
  if (online(health, "s3", "s4") && maxKneeValgus > THRESHOLDS.KNEE_VALGUS) errors.push("knee_valgus");
  if (online(health, "s3", "s4") && maxHipShift > THRESHOLDS.HIP_SHIFT) errors.push("hip_shift");
  if (online(health, "s3", "s4") && depthDegrees > THRESHOLDS.DEPTH_PARALLEL) errors.push("insufficient_depth");
  if (online(health, "s5") && maxTorsoTwist > THRESHOLDS.TORSO_TWIST) errors.push("torso_twist");

  return {
    repNumber: rep.repNumber,
    depthDegrees: round(depthDegrees),
    maxForwardLean: round(maxForwardLean),
    lumbarFlexionDelta: round(maxLumbarDelta),
    kneeValgusAsymmetry: round(maxKneeValgus),
    hipShiftMax: round(maxHipShift),
    torsoTwistMax: round(maxTorsoTwist),
    errorsDetected: errors,
    durationMs: rep.endT - rep.startT,
  };
}
