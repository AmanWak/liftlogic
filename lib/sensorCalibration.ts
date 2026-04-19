import type { SensorFrame, SensorId, SensorReading } from "./types";

export interface AxisOffset {
  roll: number;
  pitch: number;
}

export interface AxisFlip {
  roll: 1 | -1;
  pitch: 1 | -1;
}

export interface SensorCalibration {
  offsets: Record<SensorId, AxisOffset>;
  flips: Record<SensorId, AxisFlip>;
  smoothingAlpha: number;
}

// EMA is `next = alpha * prev + (1 - alpha) * incoming`, so higher alpha = more
// weight on the past = stickier signal. 0 passes raw through; 0.9 is heavy.
export const MAX_SMOOTHING_ALPHA = 0.9;

// Physically impossible step in a 20 ms frame — treat as a sensor glitch and
// hold the previous smoothed value rather than letting it pollute the EMA.
const SPIKE_CLAMP_DEG = 120;

const SENSORS: SensorId[] = ["s1", "s2", "s3", "s4", "s5"];

function zeroOffsets(): Record<SensorId, AxisOffset> {
  return {
    s1: { roll: 0, pitch: 0 },
    s2: { roll: 0, pitch: 0 },
    s3: { roll: 0, pitch: 0 },
    s4: { roll: 0, pitch: 0 },
    s5: { roll: 0, pitch: 0 },
  };
}

function identityFlips(): Record<SensorId, AxisFlip> {
  return {
    s1: { roll: 1, pitch: 1 },
    s2: { roll: 1, pitch: 1 },
    s3: { roll: 1, pitch: 1 },
    s4: { roll: 1, pitch: 1 },
    s5: { roll: 1, pitch: 1 },
  };
}

export const DEFAULT_CALIBRATION: SensorCalibration = {
  offsets: zeroOffsets(),
  flips: identityFlips(),
  smoothingAlpha: 0.4,
};

export function cloneCalibration(c: SensorCalibration): SensorCalibration {
  const offsets = {} as Record<SensorId, AxisOffset>;
  const flips = {} as Record<SensorId, AxisFlip>;
  for (const id of SENSORS) {
    offsets[id] = { ...c.offsets[id] };
    flips[id] = { ...c.flips[id] };
  }
  return { offsets, flips, smoothingAlpha: c.smoothingAlpha };
}

export type SmoothState = Record<SensorId, AxisOffset & { initialized: boolean }>;

export function createSmoothState(): SmoothState {
  return {
    s1: { roll: 0, pitch: 0, initialized: false },
    s2: { roll: 0, pitch: 0, initialized: false },
    s3: { roll: 0, pitch: 0, initialized: false },
    s4: { roll: 0, pitch: 0, initialized: false },
    s5: { roll: 0, pitch: 0, initialized: false },
  };
}

export function resetSmoothState(state: SmoothState): void {
  for (const id of SENSORS) {
    state[id].roll = 0;
    state[id].pitch = 0;
    state[id].initialized = false;
  }
}

/**
 * Computes the post-flip raw reading for a sensor. Used by the "zero upright
 * pose" capture so that the user's current pose becomes the new (0, 0).
 */
export function flippedReading(raw: SensorReading, flip: AxisFlip): AxisOffset {
  return { roll: raw.roll * flip.roll, pitch: raw.pitch * flip.pitch };
}

function calibrateAxis(
  rawVal: number,
  flip: 1 | -1,
  offset: number,
  prevSmoothed: number,
  alpha: number,
  initialized: boolean,
): number {
  const calibrated = rawVal * flip - offset;
  if (!initialized) return calibrated;
  if (Math.abs(calibrated - prevSmoothed) > SPIKE_CLAMP_DEG) return prevSmoothed;
  return alpha * prevSmoothed + (1 - alpha) * calibrated;
}

/**
 * Apply calibration + EMA smoothing to every sensor in the frame. Mutates the
 * `smooth` state in place (per-sensor last smoothed value) and returns a new
 * SensorFrame suitable for feeding into the detector. Pure with respect to
 * `raw` and `cal`.
 */
export function applyCalibration(
  raw: SensorFrame,
  cal: SensorCalibration,
  smooth: SmoothState,
): SensorFrame {
  const alpha = Math.min(Math.max(cal.smoothingAlpha, 0), MAX_SMOOTHING_ALPHA);
  const out: SensorFrame = { t: raw.t } as SensorFrame;

  for (const id of SENSORS) {
    const reading = raw[id];
    if (!reading) continue;
    const flip = cal.flips[id];
    const offset = cal.offsets[id];
    const prev = smooth[id];

    const nextRoll = calibrateAxis(reading.roll, flip.roll, offset.roll, prev.roll, alpha, prev.initialized);
    const nextPitch = calibrateAxis(reading.pitch, flip.pitch, offset.pitch, prev.pitch, alpha, prev.initialized);

    prev.roll = nextRoll;
    prev.pitch = nextPitch;
    prev.initialized = true;

    (out as unknown as Record<string, unknown>)[id] = { roll: nextRoll, pitch: nextPitch };
  }

  return out;
}
