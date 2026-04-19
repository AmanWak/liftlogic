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
    s5Roll: number;
  };
}

export type FormError =
  | "excessive_forward_lean"
  | "lumbar_flexion"
  | "knee_valgus"
  | "hip_shift"
  | "insufficient_depth"
  | "torso_twist";

export interface FormAnalysis {
  repNumber: number;
  depthDegrees: number;
  maxForwardLean: number;
  lumbarFlexionDelta: number;
  kneeValgusAsymmetry: number;
  hipShiftMax: number;
  torsoTwistMax: number;
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
  torso_twist: "Torso twist",
};

export type SensorId = "s1" | "s2" | "s3" | "s4" | "s5";

export type SensorHealthStatus = "online" | "warming" | "offline";

export type SensorHealthMap = Record<SensorId, SensorHealthStatus>;
