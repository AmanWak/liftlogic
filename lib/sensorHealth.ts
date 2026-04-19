import type { SensorFrame, SensorId, SensorHealthMap, SensorHealthStatus } from "./types";

const WINDOW_MS = 2000;
const WARMING_MS = 1500;
// A live MPU-6050 shows well over 0.05° of spread over 2 s from noise alone.
// A disconnected sensor sits at exactly 0.0, 0.0 (firmware default).
const MIN_SPAN_DEG = 0.05;

const SENSORS: SensorId[] = ["s1", "s2", "s3", "s4", "s5"];

interface Sample {
  t: number;
  roll: number;
  pitch: number;
}

export interface HealthTracker {
  update(frame: SensorFrame): SensorHealthMap;
  reset(): void;
  snapshot(): SensorHealthMap;
}

function emptyHealth(): SensorHealthMap {
  return { s1: "warming", s2: "warming", s3: "warming", s4: "warming", s5: "warming" };
}

export function createHealthTracker(): HealthTracker {
  const buffers: Record<SensorId, Sample[]> = {
    s1: [], s2: [], s3: [], s4: [], s5: [],
  };
  let health: SensorHealthMap = emptyHealth();

  const compute = (samples: Sample[], now: number): SensorHealthStatus => {
    if (samples.length === 0) return "warming";
    const oldest = samples[0].t;
    const age = now - oldest;

    let minR = Infinity, maxR = -Infinity, minP = Infinity, maxP = -Infinity;
    for (const s of samples) {
      if (s.roll < minR) minR = s.roll;
      if (s.roll > maxR) maxR = s.roll;
      if (s.pitch < minP) minP = s.pitch;
      if (s.pitch > maxP) maxP = s.pitch;
    }
    const spanR = maxR - minR;
    const spanP = maxP - minP;
    const moving = spanR > MIN_SPAN_DEG || spanP > MIN_SPAN_DEG;

    if (moving) return "online";
    if (age < WARMING_MS) return "warming";
    return "offline";
  };

  return {
    update(frame) {
      const now = frame.t;
      const cutoff = now - WINDOW_MS;
      const next: SensorHealthMap = { ...health };
      for (const id of SENSORS) {
        const reading = frame[id];
        if (!reading) continue;
        const buf = buffers[id];
        buf.push({ t: now, roll: reading.roll, pitch: reading.pitch });
        while (buf.length > 0 && buf[0].t < cutoff) buf.shift();
        next[id] = compute(buf, now);
      }
      health = next;
      return health;
    },
    reset() {
      for (const id of SENSORS) buffers[id].length = 0;
      health = emptyHealth();
    },
    snapshot() {
      return health;
    },
  };
}
