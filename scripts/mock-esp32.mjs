// Mock ESP32: simulates the WebSocket stream at ws://localhost:8181
// Run: node scripts/mock-esp32.mjs
// Emits scripted squat reps (clean, shallow, valgus, forward lean, butt wink) at 50Hz.

import { WebSocketServer } from "ws";

const PORT = 8181;
const FRAME_INTERVAL_MS = 20; // 50Hz

const REP_SCRIPT = [
  { quality: "clean", depth: -2 },
  { quality: "shallow", depth: 12 },
  { quality: "knee_valgus", depth: -4 },
  { quality: "clean", depth: -1 },
  { quality: "forward_lean", depth: -3 },
  { quality: "butt_wink", depth: -5 },
  { quality: "clean", depth: 0 },
  { quality: "hip_shift", depth: -3 },
];

function jitter(scale = 1) {
  return (Math.random() - 0.5) * 2 * scale;
}

function makeFrame(rep, t, thighPitch, phase) {
  let s1Pitch = -10 + jitter();
  let s2Pitch = -8 + jitter();
  let s1Roll = jitter();
  let s2Roll = jitter();
  let s3Pitch = thighPitch + jitter();
  let s4Pitch = thighPitch + jitter();
  let s3Roll = jitter();
  let s4Roll = jitter();

  if (rep.quality === "forward_lean" && phase !== "idle") {
    s1Pitch = -60 + jitter(2);
    s2Pitch = -10 + jitter();
  }
  if (rep.quality === "knee_valgus" && (phase === "bottom" || phase === "ascent")) {
    s3Roll = 14 + jitter(2);
    s4Roll = -14 + jitter(2);
  }
  if (rep.quality === "butt_wink" && phase === "bottom") {
    s2Pitch = -30 + jitter(2);
  }
  if (rep.quality === "hip_shift" && phase !== "idle") {
    s4Pitch = thighPitch + 12 + jitter();
  }

  return {
    t,
    s1: { roll: s1Roll, pitch: s1Pitch },
    s2: { roll: s2Roll, pitch: s2Pitch },
    s3: { roll: s3Roll, pitch: s3Pitch },
    s4: { roll: s4Roll, pitch: s4Pitch },
  };
}

function generateRepFrames(rep, startT) {
  const frames = [];
  const descentSamples = 40;
  const bottomSamples = 10;
  const ascentSamples = 40;
  const restSamples = 25;
  const TOP = -5;

  for (let i = 0; i < descentSamples; i++) {
    const p = i / descentSamples;
    const thighPitch = TOP + (rep.depth - TOP) * p;
    frames.push(makeFrame(rep, startT + i * FRAME_INTERVAL_MS, thighPitch, "descent"));
  }
  for (let i = 0; i < bottomSamples; i++) {
    frames.push(
      makeFrame(
        rep,
        startT + (descentSamples + i) * FRAME_INTERVAL_MS,
        rep.depth,
        "bottom",
      ),
    );
  }
  for (let i = 0; i < ascentSamples; i++) {
    const p = i / ascentSamples;
    const thighPitch = rep.depth + (TOP - rep.depth) * p;
    frames.push(
      makeFrame(
        rep,
        startT + (descentSamples + bottomSamples + i) * FRAME_INTERVAL_MS,
        thighPitch,
        "ascent",
      ),
    );
  }
  for (let i = 0; i < restSamples; i++) {
    frames.push(
      makeFrame(
        rep,
        startT + (descentSamples + bottomSamples + ascentSamples + i) * FRAME_INTERVAL_MS,
        TOP,
        "idle",
      ),
    );
  }
  return frames;
}

const wss = new WebSocketServer({ port: PORT });
console.log(`mock-esp32: listening on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  console.log("mock-esp32: client connected");
  let repIndex = 0;
  let frameIndex = 0;
  let currentFrames = generateRepFrames(REP_SCRIPT[0], Date.now());

  const interval = setInterval(() => {
    if (frameIndex >= currentFrames.length) {
      repIndex = (repIndex + 1) % REP_SCRIPT.length;
      currentFrames = generateRepFrames(REP_SCRIPT[repIndex], Date.now());
      frameIndex = 0;
      console.log(`mock-esp32: starting rep #${repIndex + 1} — ${REP_SCRIPT[repIndex].quality}`);
    }
    try {
      ws.send(JSON.stringify(currentFrames[frameIndex]));
    } catch {
      /* client went away */
    }
    frameIndex++;
  }, FRAME_INTERVAL_MS);

  ws.on("close", () => {
    clearInterval(interval);
    console.log("mock-esp32: client disconnected");
  });
});
