"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { Settings } from "@/lib/useSettings";
import type { SensorFrame, SensorId, SensorHealthMap, SensorHealthStatus } from "@/lib/types";
import {
  DEFAULT_CALIBRATION,
  MAX_SMOOTHING_ALPHA,
  cloneCalibration,
  flippedReading,
  type SensorCalibration,
} from "@/lib/sensorCalibration";

interface Props {
  open: boolean;
  currentUrl: string;
  settings: Settings;
  showWorkoutRepTarget?: boolean;
  activeFrame?: SensorFrame | null;
  rawFrame?: SensorFrame | null;
  sensorHealth?: SensorHealthMap;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onSave: (url: string) => void;
  onReset: () => void;
}

const SENSORS: SensorId[] = ["s1", "s2", "s3", "s4", "s5"];
const SENSOR_LABELS: Record<SensorId, string> = {
  s1: "chest",
  s2: "lumbar",
  s3: "L thigh",
  s4: "R thigh",
  s5: "mid-back",
};

function healthDotClass(status: SensorHealthStatus | undefined): string {
  if (status === "online") return "bg-accent";
  if (status === "warming") return "bg-warn";
  return "bg-danger";
}

const EASE = [0.16, 1, 0.3, 1] as const;

interface ToggleProps {
  label: string;
  hint: string;
  enabled: boolean;
  onChange: (next: boolean) => void;
}

interface CalibrationSectionProps {
  activeFrame: SensorFrame | null;
  rawFrame: SensorFrame | null;
  health: SensorHealthMap | undefined;
  calibration: SensorCalibration;
  onChange: (next: SensorCalibration) => void;
}

function fmtDeg(v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(1);
}

function CalibrationSection({
  activeFrame,
  rawFrame,
  health,
  calibration,
  onChange,
}: CalibrationSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  const zero = () => {
    if (!rawFrame) return;
    const next = cloneCalibration(calibration);
    for (const id of SENSORS) {
      const reading = rawFrame[id];
      if (!reading) continue;
      if (health && health[id] !== "online") continue;
      const flipped = flippedReading(reading, next.flips[id]);
      next.offsets[id] = { roll: flipped.roll, pitch: flipped.pitch };
    }
    onChange(next);
  };

  const resetCalibration = () => {
    onChange(cloneCalibration(DEFAULT_CALIBRATION));
  };

  const toggleFlip = (id: SensorId, axis: "roll" | "pitch") => {
    const next = cloneCalibration(calibration);
    next.flips[id] = {
      ...next.flips[id],
      [axis]: (next.flips[id][axis] === 1 ? -1 : 1) as 1 | -1,
    };
    onChange(next);
  };

  const setAlpha = (alpha: number) => {
    const next = cloneCalibration(calibration);
    next.smoothingAlpha = Math.min(Math.max(alpha, 0), MAX_SMOOTHING_ALPHA);
    onChange(next);
  };

  const anyOffline = health && SENSORS.some((id) => health[id] === "offline");
  const zeroDisabled = !rawFrame || !!anyOffline;

  return (
    <div className="mb-4">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          sensor calibration
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-strong">
          {collapsed ? "expand" : "collapse"}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-1.5 space-y-2 border border-border bg-surface-2 p-3">
          <div className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wider">
            <span className="text-muted">sensor</span>
            <span className="text-right text-muted">roll</span>
            <span className="text-right text-muted">pitch</span>
            <span className="text-center text-muted">flip r</span>
            <span className="text-center text-muted">flip p</span>
            {SENSORS.map((id) => {
              const reading = activeFrame?.[id];
              const status = health?.[id];
              const flips = calibration.flips[id];
              return (
                <div key={id} className="contents">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${healthDotClass(status)}`} />
                    <span>{SENSOR_LABELS[id]}</span>
                  </div>
                  <span className="num text-right text-foreground">
                    {fmtDeg(reading?.roll)}
                  </span>
                  <span className="num text-right text-foreground">
                    {fmtDeg(reading?.pitch)}
                  </span>
                  <button
                    onClick={() => toggleFlip(id, "roll")}
                    className={`border px-1.5 py-0.5 text-[9px] ${
                      flips.roll === -1
                        ? "border-accent text-accent"
                        : "border-border text-muted-strong"
                    }`}
                  >
                    {flips.roll === -1 ? "−1" : "+1"}
                  </button>
                  <button
                    onClick={() => toggleFlip(id, "pitch")}
                    className={`border px-1.5 py-0.5 text-[9px] ${
                      flips.pitch === -1
                        ? "border-accent text-accent"
                        : "border-border text-muted-strong"
                    }`}
                  >
                    {flips.pitch === -1 ? "−1" : "+1"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              disabled={zeroDisabled}
              onClick={zero}
              className="border border-accent/70 bg-accent/10 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-strong"
            >
              zero upright pose
            </button>
            <button
              onClick={resetCalibration}
              className="border border-border bg-surface py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-strong hover:border-border-strong"
            >
              reset calibration
            </button>
          </div>

          <div className="pt-1">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted">
                smoothing
              </span>
              <span className="num font-mono text-[10px] text-foreground">
                {calibration.smoothingAlpha.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_SMOOTHING_ALPHA}
              step={0.05}
              value={calibration.smoothingAlpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted-strong">
              <span>0 raw</span>
              <span>0.4 default</span>
              <span>0.9 sticky</span>
            </div>
          </div>

          {anyOffline && (
            <div className="border border-danger/40 bg-danger/10 px-2 py-1.5 font-mono text-[9px] uppercase tracking-wider text-danger">
              one or more sensors offline — zero disabled
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, hint, enabled, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className="flex items-center justify-between gap-3 border border-border bg-surface-2 px-3 py-2.5 text-left hover:border-border-strong"
    >
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground">
          {label}
        </div>
        <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
          {hint}
        </div>
      </div>
      <span
        aria-hidden
        className={`flex h-5 w-5 flex-none items-center justify-center border ${
          enabled ? "border-accent bg-accent" : "border-border-strong bg-surface"
        }`}
      >
        {enabled && (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-background"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </button>
  );
}

export function SettingsSheet({
  open,
  currentUrl,
  settings,
  showWorkoutRepTarget = false,
  activeFrame = null,
  rawFrame = null,
  sensorHealth,
  onSettingsChange,
  onClose,
  onSave,
  onReset,
}: Props) {
  const [value, setValue] = useState(currentUrl);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally sync local input value when parent prop or sheet visibility changes
    setValue(currentUrl);
  }, [currentUrl, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.38, ease: EASE }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-sheet-title"
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col border-t border-border bg-surface"
          >
            {/* header strip */}
            <div className="flex flex-none items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span
                  id="settings-sheet-title"
                  className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted"
                >
                  uplink · configure
                </span>
              </div>
              <button
                onClick={onClose}
                aria-label="close"
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted hover:text-foreground"
              >
                close
              </button>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto px-5 pt-5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            >
              <div className="mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  feedback
                </span>
                <div className="mt-1.5 space-y-2">
                  <Toggle
                    label="voice"
                    hint="speak coaching"
                    enabled={settings.voiceEnabled}
                    onChange={(v) => onSettingsChange({ voiceEnabled: v })}
                  />
                  <Toggle
                    label={settings.premiumVoice ? "premium voice · on" : "premium voice · off"}
                    hint={settings.premiumVoice ? "elevenlabs · burns quota" : "browser tts · saves quota"}
                    enabled={settings.premiumVoice}
                    onChange={(v) => onSettingsChange({ premiumVoice: v })}
                  />
                  <Toggle
                    label={settings.fallDetectionEnabled ? "fall detection · on" : "fall detection · off"}
                    hint={settings.fallDetectionEnabled ? "alerts authorities · 10s cancel" : "worker mode · safety disabled"}
                    enabled={settings.fallDetectionEnabled}
                    onChange={(v) => onSettingsChange({ fallDetectionEnabled: v })}
                  />
                </div>
              </div>

              <div className="mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  source
                </span>
                <div className="mt-1.5 space-y-2">
                  <Toggle
                    label={settings.demoMode ? "demo mode · on" : "demo mode · off"}
                    hint={settings.demoMode ? "6 scripted reps · no sensor" : "using websocket below"}
                    enabled={settings.demoMode}
                    onChange={(v) => onSettingsChange({ demoMode: v })}
                  />
                  <Toggle
                    label={settings.streamEnabled ? "live stream · on" : "live stream · off"}
                    hint={settings.streamEnabled ? "connected to websocket" : "silhouette frozen · no uplink"}
                    enabled={settings.streamEnabled}
                    onChange={(v) => onSettingsChange({ streamEnabled: v })}
                  />
                </div>
              </div>

              {settings.streamEnabled && (
                <CalibrationSection
                  activeFrame={activeFrame}
                  rawFrame={rawFrame}
                  health={sensorHealth}
                  calibration={settings.sensorCalibration}
                  onChange={(next) => onSettingsChange({ sensorCalibration: next })}
                />
              )}

              <div className="mb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  set gap · auto-summary
                </span>
                <div className="mt-1.5 flex items-center gap-3 border border-border bg-surface-2 px-3 py-2.5">
                  <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground">
                    trigger after
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={settings.setGapSeconds}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (v >= 5 && v <= 120) onSettingsChange({ setGapSeconds: v });
                    }}
                    className="w-14 border border-border bg-surface px-2 py-1 text-center font-mono text-sm text-foreground outline-none focus:border-accent"
                  />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">sec</span>
                </div>
              </div>

              {showWorkoutRepTarget && (
                <div className="mb-4">
                  <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                    set target · workout
                  </span>
                  <div className="mt-1.5 flex items-center gap-3 border border-border bg-surface-2 px-3 py-2.5">
                    <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground">
                      reps per set
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={settings.repsPerSetTarget}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (v >= 1 && v <= 50) onSettingsChange({ repsPerSetTarget: v });
                      }}
                      className="w-14 border border-border bg-surface px-2 py-1 text-center font-mono text-sm text-foreground outline-none focus:border-accent"
                    />
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted">reps</span>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  websocket endpoint
                </span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="ws://192.168.1.42:81"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1.5 block w-full border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm text-foreground outline-none transition focus:border-accent"
                />
              </label>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                <span className="text-muted-strong">tip</span> · mock at{" "}
                <code className="text-foreground">ws://localhost:8181</code> · hardware at{" "}
                <code className="text-foreground">ws://&lt;esp32&gt;:81</code>
              </div>
              <div className="mt-1 font-mono text-[10px] normal-case tracking-normal text-muted-strong">
                esp32 on <span className="text-foreground">StarkHacks-2</span>. current ip is printed on the esp32 dashboard or serial monitor — e.g. <code className="text-foreground">ws://10.10.8.42:81</code>. ip may change on reboot.
              </div>

              <div className="mt-5 grid grid-cols-[1fr_1.4fr] gap-2">
                <button
                  onClick={onReset}
                  className="border border-border bg-surface-2 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-strong hover:border-border-strong"
                >
                  reset session
                </button>
                <button
                  onClick={() => onSave(value.trim())}
                  className="bg-accent py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-background hover:brightness-95"
                >
                  connect
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                  thresholds
                </span>
                <Link
                  href="/research"
                  onClick={onClose}
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:brightness-110"
                >
                  view research basis →
                </Link>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
