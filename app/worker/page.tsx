"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWorkerStream } from "@/lib/useWorkerStream";
import { useSettings } from "@/lib/useSettings";
import { useVoice } from "@/lib/useVoice";
import { useDemoWorker } from "@/lib/useDemoWorker";
import { useLiveErrors } from "@/lib/useLiveErrors";
import { useConsoleSignature } from "@/lib/useConsoleSignature";
import { DEFAULT_MOCK_URL } from "@/lib/config";
import { ConnectionPill } from "@/components/ConnectionPill";
import { StatusBand } from "@/components/StatusBand";
import { SensorSilhouette } from "@/components/SensorSilhouette";
import { LiftCard } from "@/components/LiftCard";
import { SettingsSheet } from "@/components/SettingsSheet";
import { SessionSummary } from "@/components/SessionSummary";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { WORKER_ERROR_LABEL } from "@/lib/types-worker";

const STORAGE_KEY = "liftlogic:esp-url";

function normalizeUrl(raw: string): string {
  if (!raw) return DEFAULT_MOCK_URL;
  const trimmed = raw.trim();
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) return trimmed;
  return `ws://${trimmed}`;
}

function loadInitialUrl(): string {
  if (typeof window === "undefined") return DEFAULT_MOCK_URL;
  const params = new URLSearchParams(window.location.search);
  const espParam = params.get("esp");
  if (espParam) return normalizeUrl(espParam);
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  return DEFAULT_MOCK_URL;
}

// Weighted safety score: 0 errors → 100, each flagged error costs 30 pts, floor 10.
function computeSafetyScore(lifts: { analysis: { errorsDetected: string[] } }[]): number | null {
  if (lifts.length === 0) return null;
  const total = lifts.reduce(
    (sum, r) => sum + Math.max(10, 100 - r.analysis.errorsDetected.length * 30),
    0,
  );
  return Math.round(total / lifts.length);
}

export default function WorkerPage() {
  const [url, setUrl] = useState<string>(DEFAULT_MOCK_URL);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [frozenDurationMs, setFrozenDurationMs] = useState<number | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const summaryFiredRef = useRef(false);
  const safetyScoreRef = useRef<number | null>(null);
  const shiftActive = sessionStart !== null;

  useEffect(() => {
    const initial = loadInitialUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only hydration from localStorage/URL
    setUrl(initial);
    setReady(true);
  }, []);

  const [settings, updateSettings] = useSettings();
  const voice = useVoice(settings.voiceEnabled, settings.premiumVoice);
  useConsoleSignature("worksite");

  const handleCoaching = useCallback(
    (text: string) => {
      voice.speak(text);
    },
    [voice],
  );

  const { frame, lifts, status, liftCount, reset, injectLift, setStatus } = useWorkerStream(
    ready && !settings.demoMode && settings.streamEnabled ? url : null,
    { onCoaching: handleCoaching, skipCoach: settings.demoMode },
  );

  const demo = useDemoWorker(settings.demoMode && sessionStart !== null, injectLift);

  useEffect(() => {
    if (settings.demoMode) setStatus("demo");
  }, [settings.demoMode, setStatus]);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: clear shift on demo-mode toggle
    setSessionStart(null);
    setFrozenDurationMs(null);
    voice.cancel();
    summaryFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on demo toggle
  }, [settings.demoMode]);

  const lastLift = lifts[0];
  const lastLiftWasClean = lastLift ? lastLift.analysis.errorsDetected.length === 0 : null;
  const activeFrame = settings.demoMode ? demo.frame : frame;
  const baselineS2Pitch = activeFrame?.s2.pitch ?? null;
  const { flashTrigger } = useLiveErrors(activeFrame, baselineS2Pitch);
  const safeLifts = lifts.filter((r) => r.analysis.errorsDetected.length === 0).length;
  const safetyScore = computeSafetyScore(lifts);
  useEffect(() => { safetyScoreRef.current = safetyScore; }, [safetyScore]);
  const now = Date.now(); // eslint-disable-line react-hooks/purity -- snapshot used only by SessionSummary on open
  const sessionDurationMs =
    frozenDurationMs ?? (sessionStart ? now - sessionStart : 0);

  const handleSave = (nextUrl: string) => {
    const n = normalizeUrl(nextUrl);
    setUrl(n);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, n);
      const params = new URLSearchParams(window.location.search);
      params.set("esp", n);
      window.history.replaceState(null, "", `?${params.toString()}`);
    }
    setSettingsOpen(false);
  };

  const handleReset = () => {
    reset();
    setSessionStart(null);
    setFrozenDurationMs(null);
    voice.cancel();
    setSettingsOpen(false);
    setSummaryOpen(false);
    summaryFiredRef.current = false;
    if (settings.demoMode) demo.replay();
  };

  const handleStartShift = () => {
    reset();
    voice.cancel();
    summaryFiredRef.current = false;
    setSummaryOpen(false);
    setFrozenDurationMs(null);
    setSessionStart(Date.now());
    if (settings.demoMode) demo.replay();
  };

  const handleEndShift = () => {
    if (summaryFiredRef.current || !shiftActive) return;
    summaryFiredRef.current = true;
    const duration = sessionStart ? Date.now() - sessionStart : 0;
    setFrozenDurationMs(duration);
    setSessionStart(null);
    const score = safetyScoreRef.current ?? 0;
    setStreak((prev) => (score >= 85 ? prev + 1 : 0));
    setSummaryOpen(true);
  };

  const handleNewShift = () => {
    handleStartShift();
  };

  return (
    <main
      data-mode="worksite"
      className="mx-auto w-full max-w-[420px] px-3 pb-10"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        // Re-skin the accent for worksite mode: lime (128) → hi-vis construction orange (55).
        // Set as inline CSS vars because Tailwind v4's Turbopack pipeline strips attribute-
        // selector overrides of OKLCH-backed vars at build time.
        ["--accent" as string]: "oklch(0.78 0.185 55)",
        ["--accent-dim" as string]: "oklch(0.60 0.14 55)",
      }}
    >
      <header className="mb-3 flex items-center justify-between gap-3 border border-border bg-surface px-3 py-2">
        <span
          className="font-display text-base font-semibold tracking-tight text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          liftlogic
        </span>
        <div className="flex flex-none items-center gap-1.5">
          <ModeSwitcher active="worksite" />
          <ConnectionPill status={status} onClick={() => setSettingsOpen(true)} />
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="settings"
            className="flex h-7 w-7 flex-none items-center justify-center border border-border bg-surface hover:border-border-strong"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-strong"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="space-y-3">
        <StatusBand
          repCount={liftCount}
          cleanReps={safeLifts}
          formScore={safetyScore}
          startedAt={sessionStart}
          frozenMs={frozenDurationMs}
          lastRepWasClean={lastLiftWasClean}
          streak={streak}
          unitLabel="lifts"
          scoreLabel="safe"
          cleanLabel="safe"
        />

        <SensorSilhouette frame={activeFrame} baselineS2Pitch={baselineS2Pitch} flashTrigger={flashTrigger} />

        <section aria-label="worksite event log" className="pt-2">
          <div className="flex items-baseline justify-between px-1 pb-2">
            <div className="flex items-baseline gap-2">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                lift log
              </h2>
              <span className="font-mono text-[10px] text-muted">
                · {String(lifts.length).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {shiftActive && settings.demoMode && demo.completed && (
                <button
                  onClick={demo.replay}
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:brightness-110"
                >
                  replay ↻
                </button>
              )}
              {shiftActive ? (
                <button
                  onClick={handleEndShift}
                  className="border border-danger/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-danger hover:bg-danger/10"
                >
                  end shift
                </button>
              ) : lifts.length > 0 ? (
                <button
                  onClick={handleStartShift}
                  className="border border-accent/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:bg-accent/10"
                >
                  new shift
                </button>
              ) : null}
            </div>
          </div>

          <AnimatePresence initial={false} mode="wait">
            {!shiftActive && lifts.length === 0 ? (
              <motion.div
                key="standby"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24 }}
                className="border border-dashed border-border px-5 py-8 text-center"
              >
                <div className="mx-auto mb-3 h-px w-10 bg-border-strong" />
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  shift · standby
                </div>
                <div className="mt-2 mb-5 text-sm text-muted-strong text-balance">
                  {settings.demoMode
                    ? "Start the shift to kick off the scripted demo — clean, back-rounded, stiff-leg."
                    : "Start the shift to begin logging lifts. Stop it when you clock out or take a break."}
                </div>
                <button
                  onClick={handleStartShift}
                  className="bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-background hover:brightness-95"
                >
                  start shift
                </button>
              </motion.div>
            ) : shiftActive && lifts.length === 0 ? (
              <motion.div
                key="awaiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24 }}
                className="border border-dashed border-border px-5 py-10 text-center"
              >
                <div className="mx-auto mb-3 h-px w-10 bg-border-strong" />
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  shift · live
                </div>
                <div className="mt-2 text-sm text-muted-strong text-balance">
                  {settings.demoMode
                    ? "Three scripted lifts incoming — one clean, one back-rounded, one stiff-leg."
                    : "Pick something up — each lift drops into the log with AI-generated safety coaching."}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="log"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24 }}
                className="border-t border-border"
              >
                {lifts.map((lift) => (
                  <LiftCard key={lift.analysis.liftNumber} lift={lift} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <SettingsSheet
        open={settingsOpen}
        currentUrl={url}
        settings={settings}
        onSettingsChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSave}
        onReset={handleReset}
      />

      <SessionSummary
        open={summaryOpen}
        reps={lifts}
        formScore={safetyScore}
        durationMs={sessionDurationMs}
        streak={streak}
        onClose={() => setSummaryOpen(false)}
        onNewSet={handleNewShift}
        recapEndpoint="/api/worker-recap"
        errorLabels={WORKER_ERROR_LABEL}
        unitLabel="lifts"
        headerLabel="shift recap · summary"
        newButtonLabel="new shift"
      />
    </main>
  );
}
