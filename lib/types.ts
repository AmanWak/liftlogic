export interface SensorReading {
  roll: number;
  pitch: number;
}

export interface SensorFrame {
  t: number;
  s1: SensorReading;
  s2: SensorReading;
  s3: SensorReading;
  s4: SensorReading;
  s5?: SensorReading;
}

export interface RepWindow {
  repNumber: number;
  startT: number;
  endT: number;
  bottomT: number;
  frames: SensorFrame[];
  baseline: {
    s2Pitch: number;
  };
}

export type FormError =
  | "excessive_forward_lean"
  | "lumbar_flexion"
  | "knee_valgus"
  | "hip_shift"
  | "insufficient_depth"
  | "bar_path_deviation";

export interface FormAnalysis {
  repNumber: number;
  depthDegrees: number;
  maxForwardLean: number;
  lumbarFlexionDelta: number;
  kneeValgusAsymmetry: number;
  hipShiftMax: number;
  barPathDeviation?: number;
  errorsDetected: FormError[];
  durationMs: number;
}

export interface CoachingResponse {
  coaching: string;
  model: string;
  latencyMs: number;
}

export const FORM_ERROR_LABEL: Record<FormError, string> = {
  excessive_forward_lean: "Forward lean",
  lumbar_flexion: "Butt wink",
  knee_valgus: "Knees caving",
  hip_shift: "Hip shift",
  insufficient_depth: "Shallow depth",
  bar_path_deviation: "Bar drift",
};
