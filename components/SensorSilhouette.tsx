"use client";
import { animate, AnimatePresence, motion, useAnimation, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SensorFrame } from "@/lib/types";
import { THRESHOLDS } from "@/lib/config";

interface Props {
  frame: SensorFrame | null;
  baselineS2Pitch: number | null;
  flashTrigger?: number;
  fallActive?: boolean;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const BONE_WIDTH = 2.75;
const JOINT_R = 3;
const EASE = [0.16, 1, 0.3, 1] as const;

// Shared segment lengths (SVG units). Both views use identical proportions
// so the hip drops in sync across the panel.
const L_SHIN = 68;
const L_THIGH = 68;
const L_TORSO = 62;
const L_NECK = 10;
const HEAD_R = 9;
const FOOT_Y = 336;

// Left panel — side profile, figure faces right (+X = forward).
const SIDE_FOOT_X = 52;

// Right panel — front view.
const FRONT_CENTER_X = 172;
const FRONT_FOOT_SEP = 34;
const FRONT_LEFT_FOOT_X = FRONT_CENTER_X - FRONT_FOOT_SEP / 2;
const FRONT_RIGHT_FOOT_X = FRONT_CENTER_X + FRONT_FOOT_SEP / 2;
const FRONT_HIP_SPAN = 22;
const FRONT_SHOULDER_SPAN = 30;

// Thigh angle (from vertical) given sensor pitch in degrees.
function thetaFromPitch(pitchDeg: number) {
  return (clamp(-pitchDeg, 0, 110) * Math.PI) / 180;
}

// Sagittal pose: shin angle ≈ half the thigh angle (balanced squat
// approximating Escamilla's trunk-tibia parallelism).
function solveSagittal(thighPitch: number) {
  const theta = thetaFromPitch(thighPitch);
  const phi = theta * 0.5;
  const kneeX = SIDE_FOOT_X + L_SHIN * Math.sin(phi);
  const kneeY = FOOT_Y - L_SHIN * Math.cos(phi);
  const hipX = kneeX - L_THIGH * Math.sin(theta);
  const hipY = kneeY - L_THIGH * Math.cos(theta);
  return { kneeX, kneeY, hipX, hipY };
}

// Frontal pose: sagittal-plane rotation is into the screen, so thigh/shin
// visible lengths foreshorten by cos(angle). Hip Y stays in sync with the
// sagittal figure because both reduce by the same vertical components.
interface FrontalPose {
  hipCenterX: number;
  hipY: number;
  leftHipX: number;
  rightHipX: number;
  leftKneeX: number;
  rightKneeX: number;
  kneeY: number;
  leftShoulderX: number;
  rightShoulderX: number;
  shoulderY: number;
  neckX: number;
  neckY: number;
  headX: number;
  headY: number;
}

function solveFrontal(
  leftPitch: number,
  rightPitch: number,
  leftRoll: number,
  rightRoll: number,
): FrontalPose {
  const thetaL = thetaFromPitch(leftPitch);
  const thetaR = thetaFromPitch(rightPitch);
  const thetaAvg = (thetaL + thetaR) / 2;
  const phiAvg = thetaAvg * 0.5;

  const visibleShin = L_SHIN * Math.cos(phiAvg);
  const visibleThigh = L_THIGH * Math.cos(thetaAvg);
  const kneeY = FOOT_Y - visibleShin;
  const hipY = kneeY - visibleThigh;

  // Hip shift: signed lateral pelvis drift. Proxy from thigh-pitch asymmetry.
  const hipShiftDeg = leftPitch - rightPitch; // >0 means left dropped faster → shift toward right foot
  const hipShiftPx = clamp(hipShiftDeg, -20, 20) * 0.6;
  const hipCenterX = FRONT_CENTER_X + hipShiftPx;
  const leftHipX = hipCenterX - FRONT_HIP_SPAN / 2;
  const rightHipX = hipCenterX + FRONT_HIP_SPAN / 2;

  // Knee valgus: each knee caves toward centerline based on its own roll,
  // only when the roll points inward (positive for left, negative for right).
  const leftInward = Math.max(0, leftRoll);
  const rightInward = Math.max(0, -rightRoll);
  const valgusScale = 1.1; // pixels per degree
  const leftKneeX = FRONT_LEFT_FOOT_X + leftInward * valgusScale;
  const rightKneeX = FRONT_RIGHT_FOOT_X - rightInward * valgusScale;

  const shoulderY = hipY - L_TORSO;
  const leftShoulderX = hipCenterX - FRONT_SHOULDER_SPAN / 2;
  const rightShoulderX = hipCenterX + FRONT_SHOULDER_SPAN / 2;
  const neckX = hipCenterX;
  const neckY = shoulderY - L_NECK;
  const headX = neckX;
  const headY = neckY - HEAD_R;

  return {
    hipCenterX,
    hipY,
    leftHipX,
    rightHipX,
    leftKneeX,
    rightKneeX,
    kneeY,
    leftShoulderX,
    rightShoulderX,
    shoulderY,
    neckX,
    neckY,
    headX,
    headY,
  };
}

export function SensorSilhouette({ frame, baselineS2Pitch, flashTrigger = 0, fallActive = false }: Props) {
  const flashControls = useAnimation();

  // SVG rotation for the "fall forward" animation. `style={{ transformOrigin }}`
  // is unreliable on SVG <g> across browsers (CSS px vs viewBox units), so we
  // drive the native SVG `transform="rotate(deg cx cy)"` attribute via a
  // motion value instead.
  const fallAngle = useMotionValue(0);
  useEffect(() => {
    const controls = animate(fallAngle, fallActive ? 90 : 0, {
      type: "spring",
      stiffness: 85,
      damping: 14,
    });
    return () => controls.stop();
  }, [fallActive, fallAngle]);
  const sagittalTransform = useTransform(
    fallAngle,
    (a) => `rotate(${a} ${SIDE_FOOT_X} ${FOOT_Y})`,
  );
  useEffect(() => {
    if (flashTrigger === 0) return;
    void flashControls.start({ opacity: [0.28, 0], transition: { duration: 0.22, ease: "easeOut" } });
  }, [flashTrigger, flashControls]);

  // "Lock acquired" sweep — a single scan line traverses the panel the first
  // time real telemetry arrives. Reinforces that the IMUs just handshook.
  const reducedMotion = useReducedMotion();
  const [sweepActive, setSweepActive] = useState(false);
  const armedRef = useRef(false);
  useEffect(() => {
    if (!frame || armedRef.current || reducedMotion) return;
    armedRef.current = true;
    setSweepActive(true);
    const t = setTimeout(() => setSweepActive(false), 900);
    return () => clearTimeout(t);
  }, [frame, reducedMotion]);
  const d = useMemo(() => {
    if (!frame) {
      return {
        depth: 0,
        torsoTilt: 0,
        torsoLean: 0,
        valgus: 0,
        hipShift: 0,
        lumbarDelta: 0,
        activeErrors: new Set<string>(),
        minThigh: 0,
      };
    }
    const avgThigh = (frame.s3.pitch + frame.s4.pitch) / 2;
    const depth = clamp(-avgThigh / 90, 0, 1.1);
    // Signed forward tilt of the upper torso from vertical. Sensor convention:
    // negative s1.pitch = forward flexion (matches thigh pitch). Flipping the
    // sign here makes positive = "shoulders in front of hip" for rendering.
    const torsoTilt = -frame.s1.pitch;
    // Spinal curvature between upper back and lumbar — independent of tilt.
    const torsoLean = frame.s1.pitch - frame.s2.pitch;
    const valgus = Math.abs(frame.s3.roll - frame.s4.roll);
    const hipShift = Math.abs(frame.s3.pitch - frame.s4.pitch);
    const lumbarDelta =
      baselineS2Pitch !== null ? Math.abs(frame.s2.pitch - baselineS2Pitch) : 0;
    const minThigh = Math.min(frame.s3.pitch, frame.s4.pitch);

    const activeErrors = new Set<string>();
    if (Math.abs(torsoLean) > THRESHOLDS.FORWARD_LEAN) activeErrors.add("torso");
    if (lumbarDelta > THRESHOLDS.LUMBAR_FLEXION) activeErrors.add("lumbar");
    if (valgus > THRESHOLDS.KNEE_VALGUS) activeErrors.add("knees");
    if (hipShift > THRESHOLDS.HIP_SHIFT) activeErrors.add("hips");

    return { depth, torsoTilt, torsoLean, valgus, hipShift, lumbarDelta, activeErrors, minThigh };
  }, [frame, baselineS2Pitch]);

  const { depth, torsoTilt, valgus, hipShift, activeErrors } = d;

  // --- Sagittal (left panel) ---
  const avgThighPitch = frame ? (frame.s3.pitch + frame.s4.pitch) / 2 : 0;
  const sag = solveSagittal(avgThighPitch);
  const leanRad = (torsoTilt * Math.PI) / 180;
  const sagShoulderX = sag.hipX + Math.sin(leanRad) * L_TORSO;
  const sagShoulderY = sag.hipY - Math.cos(leanRad) * L_TORSO;
  const sagNeckX = sagShoulderX + Math.sin(leanRad) * L_NECK;
  const sagNeckY = sagShoulderY - Math.cos(leanRad) * L_NECK;
  const sagHeadX = sagNeckX + Math.sin(leanRad) * HEAD_R;
  const sagHeadY = sagNeckY - Math.cos(leanRad) * HEAD_R;

  // --- Frontal (right panel) ---
  const front = solveFrontal(
    frame ? frame.s3.pitch : 0,
    frame ? frame.s4.pitch : 0,
    frame ? frame.s3.roll : 0,
    frame ? frame.s4.roll : 0,
  );

  // --- Color mapping (shared across views) ---
  const shinColor = activeErrors.has("knees") ? "var(--danger)" : "var(--accent)";
  const thighColor = activeErrors.has("knees") || activeErrors.has("hips")
    ? "var(--danger)"
    : "var(--accent)";
  const spineColor = activeErrors.has("torso") || activeErrors.has("lumbar")
    ? "var(--danger)"
    : "var(--accent)";
  const pelvisColor = activeErrors.has("hips") || activeErrors.has("lumbar")
    ? "var(--danger)"
    : "var(--accent)";

  const springT = { duration: 0.22, ease: EASE };

  return (
    <section
      aria-label="live biomechanics"
      className="relative border border-border bg-surface"
    >
      <Reticle className="top-0 left-0" />
      <Reticle className="top-0 right-0 rotate-90" />
      <Reticle className="bottom-0 right-0 rotate-180" />
      <Reticle className="bottom-0 left-0 -rotate-90" />

      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        <span>telemetry</span>
        <span className="flex items-center gap-3">
          <span className={activeErrors.has("torso") ? "text-danger" : "text-muted-strong"}>
            lean {frame ? `${torsoTilt >= 0 ? "+" : ""}${torsoTilt.toFixed(0)}°` : "—"}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${frame ? "bg-accent" : "bg-muted"}`} />
            <span className="text-muted-strong">{frame ? "50hz" : "idle"}</span>
          </span>
        </span>
      </div>

      <div className="relative">
        <div className="panel-grid absolute inset-0 opacity-60" />
        <div className="panel-vignette absolute inset-0" />

        <AnimatePresence>
          {sweepActive && (
            <motion.div
              key="lock-sweep"
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, var(--accent) 50%, transparent)",
                boxShadow: "0 0 12px color-mix(in oklch, var(--accent) 60%, transparent)",
              }}
              initial={{ y: 0, opacity: 0 }}
              animate={{ y: 340, opacity: [0, 0.9, 0.9, 0] }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], times: [0, 0.15, 0.85, 1] }}
            />
          )}
        </AnimatePresence>

        <svg
          viewBox="0 0 240 372"
          className="relative block w-full h-[340px]"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Ground line spans both panels */}
          <line x1="14" y1={FOOT_Y + 4} x2="215" y2={FOOT_Y + 4} stroke="var(--border-strong)" strokeWidth="1" />

          {/* Subtle divider between sagittal and frontal panels */}
          <line x1="120" y1="28" x2="120" y2={FOOT_Y + 10} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" />

          {/* Panel labels */}
          <text x="14" y="22" fontSize="7" fill="var(--muted)" fontFamily="var(--font-mono)" letterSpacing="1.4">
            SAGITTAL
          </text>
          <text x="126" y="22" fontSize="7" fill="var(--muted)" fontFamily="var(--font-mono)" letterSpacing="1.4">
            FRONTAL
          </text>

          {/* ===== SAGITTAL ===== */}
          {/* Plumb line from ankle — reveals lean and hip drift */}
          <line
            x1={SIDE_FOOT_X}
            y1="32"
            x2={SIDE_FOOT_X}
            y2={FOOT_Y + 4}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />

          {/* Sagittal skeleton — rotates forward on fall via SVG transform attr */}
          <motion.g transform={sagittalTransform}>
            {/* Foot bracket */}
            <Bone x1={SIDE_FOOT_X - 5} y1={FOOT_Y} x2={SIDE_FOOT_X + 14} y2={FOOT_Y} color={shinColor} t={springT} width={2} />

            <Bone x1={SIDE_FOOT_X} y1={FOOT_Y} x2={sag.kneeX} y2={sag.kneeY} color={shinColor} t={springT} />
            <Bone x1={sag.kneeX} y1={sag.kneeY} x2={sag.hipX} y2={sag.hipY} color={thighColor} t={springT} />

            {/* Pelvis tick */}
            <Bone x1={sag.hipX - 4} y1={sag.hipY} x2={sag.hipX + 8} y2={sag.hipY} color={pelvisColor} t={springT} width={3.5} />

            {/* Spine, neck, head */}
            <Bone x1={sag.hipX} y1={sag.hipY} x2={sagShoulderX} y2={sagShoulderY} color={spineColor} t={springT} width={3.5} />
            <Bone x1={sagShoulderX} y1={sagShoulderY} x2={sagNeckX} y2={sagNeckY} color={spineColor} t={springT} />
            <motion.circle
              cx={sagHeadX}
              cy={sagHeadY}
              r={HEAD_R}
              fill="none"
              stroke={spineColor}
              strokeWidth="2.25"
              animate={{ cx: sagHeadX, cy: sagHeadY }}
              transition={springT}
            />

            <Joint x={SIDE_FOOT_X} y={FOOT_Y} />
            <Joint x={sag.kneeX} y={sag.kneeY} t={springT} />
            <Joint x={sag.hipX} y={sag.hipY} t={springT} />
            <Joint x={sagShoulderX} y={sagShoulderY} t={springT} />
          </motion.g>

          {/* ===== FRONTAL ===== */}
          {/* Plumb line from centerline */}
          <line
            x1={FRONT_CENTER_X}
            y1="32"
            x2={FRONT_CENTER_X}
            y2={FOOT_Y + 4}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />

          {/* Foot brackets */}
          <Bone x1={FRONT_LEFT_FOOT_X - 6} y1={FOOT_Y} x2={FRONT_LEFT_FOOT_X + 6} y2={FOOT_Y} color={shinColor} t={springT} width={2} />
          <Bone x1={FRONT_RIGHT_FOOT_X - 6} y1={FOOT_Y} x2={FRONT_RIGHT_FOOT_X + 6} y2={FOOT_Y} color={shinColor} t={springT} width={2} />

          {/* Shins */}
          <Bone x1={FRONT_LEFT_FOOT_X} y1={FOOT_Y} x2={front.leftKneeX} y2={front.kneeY} color={shinColor} t={springT} />
          <Bone x1={FRONT_RIGHT_FOOT_X} y1={FOOT_Y} x2={front.rightKneeX} y2={front.kneeY} color={shinColor} t={springT} />

          {/* Thighs */}
          <Bone x1={front.leftKneeX} y1={front.kneeY} x2={front.leftHipX} y2={front.hipY} color={thighColor} t={springT} />
          <Bone x1={front.rightKneeX} y1={front.kneeY} x2={front.rightHipX} y2={front.hipY} color={thighColor} t={springT} />

          {/* Pelvis bar */}
          <Bone x1={front.leftHipX} y1={front.hipY} x2={front.rightHipX} y2={front.hipY} color={pelvisColor} t={springT} width={3.5} />

          {/* Spine + shoulder bar */}
          <Bone x1={front.hipCenterX} y1={front.hipY} x2={front.neckX} y2={front.shoulderY} color={spineColor} t={springT} width={3.5} />
          <Bone x1={front.leftShoulderX} y1={front.shoulderY} x2={front.rightShoulderX} y2={front.shoulderY} color={spineColor} t={springT} width={2.5} />

          {/* Neck + head */}
          <Bone x1={front.neckX} y1={front.shoulderY} x2={front.neckX} y2={front.neckY} color={spineColor} t={springT} />
          <motion.circle
            cx={front.headX}
            cy={front.headY}
            r={HEAD_R}
            fill="none"
            stroke={spineColor}
            strokeWidth="2.25"
            animate={{ cx: front.headX, cy: front.headY }}
            transition={springT}
          />

          {/* Front-view joint dots */}
          <Joint x={FRONT_LEFT_FOOT_X} y={FOOT_Y} />
          <Joint x={FRONT_RIGHT_FOOT_X} y={FOOT_Y} />
          <Joint x={front.leftKneeX} y={front.kneeY} t={springT} />
          <Joint x={front.rightKneeX} y={front.kneeY} t={springT} />
          <Joint x={front.leftHipX} y={front.hipY} t={springT} />
          <Joint x={front.rightHipX} y={front.hipY} t={springT} />

          {/* Depth rail — far right */}
          <g transform="translate(228, 0)">
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
              <g key={i}>
                <line
                  x1={p === 0.5 || p === 1 ? -7 : -3}
                  y1={92 + p * (FOOT_Y - 92)}
                  x2="0"
                  y2={92 + p * (FOOT_Y - 92)}
                  stroke={p === 1 ? "var(--accent)" : "var(--border-strong)"}
                  strokeWidth="1"
                />
                {p === 1 && (
                  <text
                    x="-9"
                    y={94 + p * (FOOT_Y - 92)}
                    textAnchor="end"
                    fontSize="7"
                    fill="var(--accent)"
                    fontFamily="var(--font-mono)"
                    letterSpacing="1.2"
                  >
                    PAR
                  </text>
                )}
              </g>
            ))}
            <line x1="0" y1="92" x2="0" y2={FOOT_Y} stroke="var(--border)" strokeWidth="1" />
            <motion.circle
              cx="0"
              cy={92 + depth * (FOOT_Y - 92)}
              r="3"
              fill={depth >= 1 ? "var(--accent)" : "var(--warn)"}
              animate={{ cy: 92 + depth * (FOOT_Y - 92) }}
              transition={{ duration: 0.25, ease: EASE }}
            />
          </g>
        </svg>
      </div>

      <div className="grid grid-cols-4 border-t border-border/80 divide-x divide-border/80 [&>*]:min-w-0">
        <Readout label="depth" value={frame ? `${d.minThigh.toFixed(0)}°` : "—"} target={`≤${THRESHOLDS.DEPTH_PARALLEL}°`} warn={frame ? d.minThigh > 0 : false} />
        <Readout label="lumbar" value={frame ? `${d.lumbarDelta.toFixed(0)}°` : "—"} target={`≤${THRESHOLDS.LUMBAR_FLEXION}°`} warn={activeErrors.has("lumbar")} />
        <Readout label="valgus" value={`${valgus.toFixed(0)}°`} target={`≤${THRESHOLDS.KNEE_VALGUS}°`} warn={activeErrors.has("knees")} />
        <Readout label="shift" value={`${hipShift.toFixed(0)}°`} target={`≤${THRESHOLDS.HIP_SHIFT}°`} warn={activeErrors.has("hips")} />
      </div>

      {/* Red flash on newly-detected form error */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-20 bg-danger"
        initial={{ opacity: 0 }}
        animate={flashControls}
      />
    </section>
  );
}

function Bone({
  x1, y1, x2, y2, color, t, width = BONE_WIDTH,
}: {
  x1: number; y1: number; x2: number; y2: number; color: string; t: { duration: number; ease: readonly [number, number, number, number] }; width?: number;
}) {
  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      animate={{ x1, y1, x2, y2 }}
      transition={t}
    />
  );
}

function Joint({ x, y, t }: { x: number; y: number; t?: { duration: number; ease: readonly [number, number, number, number] } }) {
  const props = {
    cx: x,
    cy: y,
    r: JOINT_R,
    fill: "var(--background)",
    stroke: "var(--accent)",
    strokeWidth: 1.5,
  };
  if (!t) return <circle {...props} />;
  return <motion.circle {...props} animate={{ cx: x, cy: y }} transition={t} />;
}

function Reticle({ className = "" }: { className?: string }) {
  return (
    <span className={`pointer-events-none absolute h-3 w-3 ${className}`}>
      <span className="absolute left-0 top-0 h-[1.5px] w-full bg-accent" />
      <span className="absolute left-0 top-0 h-full w-[1.5px] bg-accent" />
    </span>
  );
}

function Readout({
  label, value, target, warn,
}: {
  label: string; value: string; target: string; warn: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-0.5 px-2.5 py-2.5 ${
        warn ? "bg-danger/10" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
          {label}
        </span>
        <span className="font-mono text-[9px] text-muted">{target}</span>
      </div>
      <div
        className={`num font-display text-lg font-medium leading-none ${
          warn ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
