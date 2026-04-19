// Thresholds that *trigger* a form error. Permissive enough for a realistic
// demo — for the research-backed "ideal" values they're guarding, see
// `IDEAL_SQUAT` below and `IDEAL_SQUAT.md` at the repo root.
export const THRESHOLDS = {
  DESCENT_PITCH: -30,
  ASCENT_PITCH: -10,
  BOTTOM_REVERSAL_MARGIN: 5,
  FORWARD_LEAN: 45,
  LUMBAR_FLEXION: 15,
  KNEE_VALGUS: 8,
  HIP_SHIFT: 8,
  DEPTH_PARALLEL: 0,
  TORSO_TWIST: 8,
} as const;

// Research-backed "ideal" values. Not used as runtime thresholds — those live
// in THRESHOLDS above and are deliberately looser. These are what we compare
// against in UI copy and what coaching nudges toward. Citations in
// IDEAL_SQUAT.md.
export const IDEAL_SQUAT = {
  // Escamilla 2001; Straub 2024. Knee flexion at bottom.
  DEPTH_KNEE_FLEXION_PARALLEL_DEG: [90, 110] as const,
  DEPTH_KNEE_FLEXION_DEEP_DEG: [110, 135] as const,
  // Stiehl 2023. Spine stays in its neutral zone — 0° deviation is ideal.
  LUMBAR_NEUTRAL_DEG: 0,
  // Mistry 2005; Meeusen 2020. Knees track over toes; >5°–10° is undesirable.
  KNEE_VALGUS_IDEAL_DEG: 0,
  KNEE_VALGUS_UNDESIRABLE_ABOVE_DEG: 5,
  // Straub 2024. Hips stay centered.
  HIP_LATERAL_SHIFT_IDEAL_CM: 0,
  // Escamilla 2001. Trunk and tibia stay within ~10° of each other.
  // Future work — needs shin IMUs which the current garment doesn't have.
  TRUNK_TIBIA_ALIGNMENT_DEG: 10,
} as const;

// Worker mode — grounded in CDC/NIOSH ergonomics guidance. See IDEAL_LIFT.md.
export const WORKER_THRESHOLDS = {
  // Trigger the lift state machine (torso pitch, more permissive than squat thigh).
  TORSO_DESCENT_PITCH: -30,
  TORSO_ASCENT_PITCH: -10,
  BOTTOM_REVERSAL_MARGIN: 5,
  // Error detection thresholds.
  BACK_ROUNDED_DELTA: 20,         // lumbar (s2) deviation from upright baseline
  STIFF_LEG_TORSO_MIN: 45,        // torso must flex at least this much to evaluate
  STIFF_LEG_THIGH_MAX: 20,        // ...while avg thigh flexion stays below this
  OVERLOADED_LEAN: 70,            // extreme fold-over torso pitch
  LEG_ASYMMETRY: 10,              // |s3.roll − s4.roll|
  TORSO_SIDE_BEND: 15,            // |s1.roll − s2.roll|
} as const;

export const IDEAL_LIFT = {
  // CDC/NIOSH "ergonomic guidelines for manual material handling" (2007).
  TRUNK_FLEXION_NEUTRAL_DEG: 0,
  TRUNK_FLEXION_HIGH_RISK_ABOVE_DEG: 20,
  // "Lift with the legs" — healthy squat-lifts show knee flexion > 60°.
  LEG_DRIVE_IDEAL_KNEE_FLEXION_DEG: 60,
  // Asymmetry — research calls out side-bending + asymmetric loads.
  TRUNK_SIDE_BEND_IDEAL_DEG: 0,
  LEG_LOAD_ASYMMETRY_IDEAL_DEG: 0,
} as const;

// Fall detection — pitch-only heuristic since MPU-6050 frames carry filtered
// roll/pitch (no raw accel). Tuned for the demo's 30Hz stream and live 50Hz.
export const FALL = {
  IMPACT_DELTA_DEG: 60,     // |s1.pitch| must jump by at least this...
  IMPACT_WINDOW_MS: 400,    // ...within this window (recent-past comparison)
  HORIZONTAL_PITCH_DEG: 60, // post-impact |s1.pitch| must exceed this
  STILLNESS_MS: 1200,       // confirm stillness for this long before firing
  STILLNESS_SPREAD_DEG: 4,  // max-min pitch spread allowed during stillness
  BUFFER_MS: 1600,          // ring buffer spans impact window + margin
  LATCH_MS: 10_000,         // ignore further triggers for this long after a fire
} as const;

export const DEFAULT_MOCK_URL = "ws://localhost:8181";

export const GEMINI_MODEL = "gemini-2.5-flash-lite";
export const GEMINI_RECAP_MODEL = "gemini-2.0-flash";
export const GEMINI_TIMEOUT_MS = 5000;
export const GEMINI_RECAP_TIMEOUT_MS = 12_000;

export const BUFFER_DURATION_MS = 10_000;
