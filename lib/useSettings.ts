"use client";
import { useCallback, useEffect, useState } from "react";

export interface Settings {
  voiceEnabled: boolean;
  premiumVoice: boolean;
  demoMode: boolean;
  streamEnabled: boolean;
  setGapSeconds: number;
}

const STORAGE_KEY = "liftlogic:settings";
const DEFAULTS: Settings = {
  voiceEnabled: true,
  premiumVoice: false,
  demoMode: false,
  streamEnabled: true,
  setGapSeconds: 20,
};

function load(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      voiceEnabled: typeof parsed.voiceEnabled === "boolean" ? parsed.voiceEnabled : DEFAULTS.voiceEnabled,
      premiumVoice: typeof parsed.premiumVoice === "boolean" ? parsed.premiumVoice : DEFAULTS.premiumVoice,
      demoMode: typeof parsed.demoMode === "boolean" ? parsed.demoMode : DEFAULTS.demoMode,
      streamEnabled: typeof parsed.streamEnabled === "boolean" ? parsed.streamEnabled : DEFAULTS.streamEnabled,
      setGapSeconds: typeof parsed.setGapSeconds === "number" && parsed.setGapSeconds > 0
        ? parsed.setGapSeconds
        : DEFAULTS.setGapSeconds,
    };
  } catch {
    return DEFAULTS;
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
