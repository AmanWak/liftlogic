import type { SensorFrame, RepWindow } from "./types";
import { THRESHOLDS } from "./config";

type State = "idle" | "descending" | "ascending";

export interface RepDetector {
  onFrame(frame: SensorFrame): RepWindow | null;
  reset(): void;
  readonly state: State;
}

export function createRepDetector(): RepDetector {
  let state: State = "idle";
  let frames: SensorFrame[] = [];
  let repNumber = 0;
  let baselineS2Pitch = 0;
  let startT = 0;
  let bottomT = 0;
  let bottomPitch = 0;

  return {
    get state() {
      return state;
    },
    reset() {
      state = "idle";
      frames = [];
      repNumber = 0;
    },
    onFrame(frame: SensorFrame): RepWindow | null {
      const avgThighPitch = (frame.s3.pitch + frame.s4.pitch) / 2;

      if (state === "idle") {
        baselineS2Pitch = frame.s2.pitch;
        if (avgThighPitch < THRESHOLDS.DESCENT_PITCH) {
          state = "descending";
          frames = [frame];
          startT = frame.t;
          bottomT = frame.t;
          bottomPitch = avgThighPitch;
        }
        return null;
      }

      frames.push(frame);

      if (state === "descending") {
        if (avgThighPitch < bottomPitch) {
          bottomPitch = avgThighPitch;
          bottomT = frame.t;
        } else if (avgThighPitch > bottomPitch + THRESHOLDS.BOTTOM_REVERSAL_MARGIN) {
          state = "ascending";
        }
        return null;
      }

      if (state === "ascending") {
        if (avgThighPitch > THRESHOLDS.ASCENT_PITCH) {
          repNumber++;
          const rep: RepWindow = {
            repNumber,
            startT,
            endT: frame.t,
            bottomT,
            frames: [...frames],
            baseline: { s2Pitch: baselineS2Pitch },
          };
          state = "idle";
          frames = [];
          return rep;
        }
        return null;
      }

      return null;
    },
  };
}
