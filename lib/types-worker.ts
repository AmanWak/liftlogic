import type { SensorFrame } from "./types";

export interface LiftWindow {
  liftNumber: number;
  startT: number;
  endT: number;
  bottomT: number;
  frames: SensorFrame[];
  baseline: {
    s2Pitch: number;
  };
}

export type WorkerFormError =
  | "back_rounded"
  | "stiff_leg_lift"
  | "overloaded_lean"
  | "asymmetric_load";

export interface LiftAnalysis {
  liftNumber: number;
  maxTorsoFlexion: number;
  maxLumbarDelta: number;
  avgThighFlexion: number;
  maxLegAsymmetry: number;
  maxTorsoSideBend: number;
  errorsDetected: WorkerFormError[];
  durationMs: number;
}

export const WORKER_ERROR_LABEL: Record<WorkerFormError, string> = {
  back_rounded: "Back rounded",
  stiff_leg_lift: "Stiff-leg lift",
  overloaded_lean: "Overloaded lean",
  asymmetric_load: "Asymmetric load",
};
