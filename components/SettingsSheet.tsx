"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import type { Settings } from "@/lib/useSettings";

interface Props {
  open: boolean;
  currentUrl: string;
  settings: Settings;
  onSettingsChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onSave: (url: string) => void;
  onReset: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

interface ToggleProps {
  label: string;
  hint: string;
  enabled: boolean;
  onChange: (next: boolean) => void;
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
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            {/* header strip */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
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

            <div className="px-5 pt-5">
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
