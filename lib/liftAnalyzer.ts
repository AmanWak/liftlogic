import type { LiftWindow, LiftAnalysis, WorkerFormError } from "./types-worker";
import { WORKER_THRESHOLDS } from "./config";

const round = (n: number) => Math.round(n * 10) / 10;

export function analyzeLift(lift: LiftWindow): LiftAnalysis {
  const { frames, baseline } = lift;

  let maxTorsoFlexion = 0;
  let maxLumbarDelta = 0;
  let maxLegAsymmetry = 0;
  let maxTorsoSideBend = 0;
  let thighFlexionSum = 0;
  let thighFlexionCount = 0;

  for (const f of frames) {
    const torsoFlexion = Math.abs(f.s1.pitch);
    if (torsoFlexion > maxTorsoFlexion) maxTorsoFlexion = torsoFlexion;

    const lumbarDelta = Math.abs(f.s2.pitch - baseline.s2Pitch);
    if (lumbarDelta > maxLumbarDelta) maxLumbarDelta = lumbarDelta;

    const legAsym = Math.abs(f.s3.roll - f.s4.roll);
    if (legAsym > maxLegAsymmetry) maxLegAsymmetry = legAsym;

    const sideBend = Math.abs(f.s1.roll - f.s2.roll);
    if (sideBend > maxTorsoSideBend) maxTorsoSideBend = sideBend;

    const thighFlexion = Math.abs((f.s3.pitch + f.s4.pitch) / 2);
    thighFlexionSum += thighFlexion;
    thighFlexionCount++;
  }

  const avgThighFlexion = thighFlexionCount > 0 ? thighFlexionSum / thighFlexionCount : 0;

  const errors: WorkerFormError[] = [];
  if (maxLumbarDelta > WORKER_THRESHOLDS.BACK_ROUNDED_DELTA) {
    errors.push("back_rounded");
  }
  if (
    maxTorsoFlexion > WORKER_THRESHOLDS.STIFF_LEG_TORSO_MIN &&
    avgThighFlexion < WORKER_THRESHOLDS.STIFF_LEG_THIGH_MAX
  ) {
    errors.push("stiff_leg_lift");
  }
  if (maxTorsoFlexion > WORKER_THRESHOLDS.OVERLOADED_LEAN) {
    errors.push("overloaded_lean");
  }
  if (
    maxLegAsymmetry > WORKER_THRESHOLDS.LEG_ASYMMETRY ||
    maxTorsoSideBend > WORKER_THRESHOLDS.TORSO_SIDE_BEND
  ) {
    errors.push("asymmetric_load");
  }

  return {
    liftNumber: lift.liftNumber,
    maxTorsoFlexion: round(maxTorsoFlexion),
    maxLumbarDelta: round(maxLumbarDelta),
    avgThighFlexion: round(avgThighFlexion),
    maxLegAsymmetry: round(maxLegAsymmetry),
    maxTorsoSideBend: round(maxTorsoSideBend),
    errorsDetected: errors,
    durationMs: lift.endT - lift.startT,
  };
}
