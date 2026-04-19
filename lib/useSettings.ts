"use client";
import { useCallback, useEffect, useState } from "react";
import type { SensorId } from "./types";
import {
  DEFAULT_CALIBRATION,
  MAX_SMOOTHING_ALPHA,
  type SensorCalibration,
  type AxisOffset,
  type AxisFlip,
  cloneCalibration,
} from "./sensorCalibration";

export interface Settings {
  voiceEnabled: boolean;
  premiumVoice: boolean;
  demoMode: boolean;
  streamEnabled: boolean;
  setGapSeconds: number;
  repsPerSetTarget: number;
  fallDetectionEnabled: boolean;
  sensorCalibration: SensorCalibration;
}

const STORAGE_KEY = "liftlogic:settings";
const SENSORS: SensorId[] = ["s1", "s2", "s3", "s4", "s5"];

const DEFAULTS: Settings = {
  voiceEnabled: true,
  premiumVoice: false,
  demoMode: false,
  streamEnabled: false,
  setGapSeconds: 20,
  repsPerSetTarget: 10,
  fallDetectionEnabled: true,
  sensorCalibration: cloneCalibration(DEFAULT_CALIBRATION),
};

function parseOffset(value: unknown): AxisOffset | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.roll !== "number" || typeof v.pitch !== "number") return null;
  if (!Number.isFinite(v.roll) || !Number.isFinite(v.pitch)) return null;
  return { roll: v.roll, pitch: v.pitch };
}

function parseFlip(value: unknown): AxisFlip | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const roll = v.roll === -1 ? -1 : v.roll === 1 ? 1 : null;
  const pitch = v.pitch === -1 ? -1 : v.pitch === 1 ? 1 : null;
  if (roll === null || pitch === null) return null;
  return { roll, pitch };
}

function parseCalibration(value: unknown): SensorCalibration {
  const base = cloneCalibration(DEFAULT_CALIBRATION);
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;

  const offsetsRaw = (v.offsets && typeof v.offsets === "object" ? v.offsets : {}) as Record<string, unknown>;
  const flipsRaw = (v.flips && typeof v.flips === "object" ? v.flips : {}) as Record<string, unknown>;
  for (const id of SENSORS) {
    const off = parseOffset(offsetsRaw[id]);
    if (off) base.offsets[id] = off;
    const flip = parseFlip(flipsRaw[id]);
    if (flip) base.flips[id] = flip;
  }

  if (typeof v.smoothingAlpha === "number" && Number.isFinite(v.smoothingAlpha)) {
    base.smoothingAlpha = Math.min(Math.max(v.smoothingAlpha, 0), MAX_SMOOTHING_ALPHA);
  }
  return base;
}

function load(): Settings {
  if (typeof window === "undefined") return { ...DEFAULTS, sensorCalibration: cloneCalibration(DEFAULT_CALIBRATION) };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, sensorCalibration: cloneCalibration(DEFAULT_CALIBRATION) };
    const parsed = JSON.parse(raw) as Partial<Settings> & { sensorCalibration?: unknown };
    return {
      voiceEnabled: typeof parsed.voiceEnabled === "boolean" ? parsed.voiceEnabled : DEFAULTS.voiceEnabled,
      premiumVoice: typeof parsed.premiumVoice === "boolean" ? parsed.premiumVoice : DEFAULTS.premiumVoice,
      demoMode: typeof parsed.demoMode === "boolean" ? parsed.demoMode : DEFAULTS.demoMode,
      streamEnabled: typeof parsed.streamEnabled === "boolean" ? parsed.streamEnabled : DEFAULTS.streamEnabled,
      setGapSeconds: typeof parsed.setGapSeconds === "number" && parsed.setGapSeconds > 0
        ? parsed.setGapSeconds
        : DEFAULTS.setGapSeconds,
      repsPerSetTarget:
        typeof parsed.repsPerSetTarget === "number" && parsed.repsPerSetTarget >= 1 && parsed.repsPerSetTarget <= 50
          ? parsed.repsPerSetTarget
          : DEFAULTS.repsPerSetTarget,
      fallDetectionEnabled:
        typeof parsed.fallDetectionEnabled === "boolean"
          ? parsed.fallDetectionEnabled
          : DEFAULTS.fallDetectionEnabled,
      sensorCalibration: parseCalibration(parsed.sensorCalibration),
    };
  } catch {
    return { ...DEFAULTS, sensorCalibration: cloneCalibration(DEFAULT_CALIBRATION) };
  }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only hydration from localStorage
    setSettings(load());
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore quota / disabled storage
        }
      }
      return next;
    });
  }, []);

  return [settings, update];
}
