import type { SensorFrame } from "./types";
import type { LiftWindow } from "./types-worker";
import { WORKER_THRESHOLDS } from "./config";

type State = "idle" | "flexing" | "extending";

export interface LiftDetector {
  onFrame(frame: SensorFrame): LiftWindow | null;
  reset(): void;
  readonly state: State;
}

export function createLiftDetector(): LiftDetector {
  let state: State = "idle";
  let frames: SensorFrame[] = [];
  let liftNumber = 0;
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
      liftNumber = 0;
    },
    onFrame(frame: SensorFrame): LiftWindow | null {
      const torsoPitch = frame.s1.pitch;

      if (state === "idle") {
        baselineS2Pitch = frame.s2.pitch;
        if (torsoPitch < WORKER_THRESHOLDS.TORSO_DESCENT_PITCH) {
          state = "flexing";
          frames = [frame];
          startT = frame.t;
          bottomT = frame.t;
          bottomPitch = torsoPitch;
        }
        return null;
      }

      frames.push(frame);

      if (state === "flexing") {
        if (torsoPitch < bottomPitch) {
          bottomPitch = torsoPitch;
          bottomT = frame.t;
        } else if (torsoPitch > bottomPitch + WORKER_THRESHOLDS.BOTTOM_REVERSAL_MARGIN) {
          state = "extending";
        }
        return null;
      }

      if (state === "extending") {
        if (torsoPitch > WORKER_THRESHOLDS.TORSO_ASCENT_PITCH) {
          liftNumber++;
          const lift: LiftWindow = {
            liftNumber,
            startT,
            endT: frame.t,
            bottomT,
            frames: [...frames],
            baseline: { s2Pitch: baselineS2Pitch },
          };
          state = "idle";
          frames = [];
          return lift;
        }
        return null;
      }

      return null;
    },
  };
}
