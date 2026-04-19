"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useSensorStream } from "@/lib/useSensorStream";
import { useSettings } from "@/lib/useSettings";
import { useVoice } from "@/lib/useVoice";
import { useDemoMode } from "@/lib/useDemoMode";
import type { DemoErrorKind } from "@/lib/useDemoMode";
import { useLiveErrors } from "@/lib/useLiveErrors";
import { useFallDetector } from "@/lib/useFallDetector";
import { useConsoleSignature } from "@/lib/useConsoleSignature";
import { DEFAULT_MOCK_URL } from "@/lib/config";
import { ConnectionPill } from "@/components/ConnectionPill";
import { StatusBand } from "@/components/StatusBand";
import { SensorSilhouette } from "@/components/SensorSilhouette";
import { RepCard } from "@/components/RepCard";
import { SettingsSheet } from "@/components/SettingsSheet";
import { SessionSummary } from "@/components/SessionSummary";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { DemoPanel } from "@/components/DemoPanel";
import { FallAlertOverlay } from "@/components/FallAlertOverlay";

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

// Weighted form score: 0 errors → 100, each error costs 30 pts, floor 10.
function computeFormScore(reps: { analysis: { errorsDetected: string[] } }[]): number | null {
  if (reps.length === 0) return null;
  const total = reps.reduce(
    (sum, r) => sum + Math.max(10, 100 - r.analysis.errorsDetected.length * 30),
    0,
  );
  return Math.round(total / reps.length);
}

export default function Home() {
  const [url, setUrl] = useState<string>(DEFAULT_MOCK_URL);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [fallAlertOpen, setFallAlertOpen] = useState(false);
  const summaryFiredRef = useRef(false);
  const lastRepTimeRef = useRef<number | null>(null);
  const formScoreRef = useRef<number | null>(null);

  useEffect(() => {
    const initial = loadInitialUrl();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only hydration from localStorage/URL
    setUrl(initial);
    setReady(true);
  }, []);

  const [settings, updateSettings] = useSettings();
  const voice = useVoice(settings.voiceEnabled, settings.premiumVoice);
  useConsoleSignature("workout");

  const handleCoaching = useCallback(
    (text: string) => {
      voice.speak(text);
    },
    [voice],
  );

  const { frame, rawFrame, reps, status, repCount, health, reset, injectRep, setStatus } = useSensorStream(
    ready && !settings.demoMode && settings.streamEnabled ? url : null,
    {
      onCoaching: handleCoaching,
      skipGemini: settings.demoMode,
      calibration: settings.sensorCalibration,
    },
  );

  const demo = useDemoMode(settings.demoMode, injectRep);

  // Track time of last rep for gap detection
  useEffect(() => {
    if (repCount > 0) lastRepTimeRef.current = Date.now();
  }, [repCount]);

  // Gap timer: trigger summary when no new rep for setGapSeconds.
  // Skip in demo mode — button-driven demo has no natural "session ended" moment.
  useEffect(() => {
    if (settings.demoMode) return;
    if (repCount === 0 || summaryFiredRef.current) return;
    const interval = setInterval(() => {
      if (!lastRepTimeRef.current || summaryFiredRef.current) return;
      const gap = (Date.now() - lastRepTimeRef.current) / 1000;
      if (gap >= settings.setGapSeconds) {
        summaryFiredRef.current = true;
        const score = formScoreRef.current ?? 0;
        setStreak((prev) => (score >= 85 ? prev + 1 : 0));
        setSummaryOpen(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [repCount, settings.setGapSeconds, settings.demoMode]);

  useEffect(() => {
    if (settings.demoMode) setStatus("demo");
  }, [settings.demoMode, setStatus]);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: clear session on demo-mode toggle
    setSessionStart(null);
    voice.cancel();
    summaryFiredRef.current = false;
    lastRepTimeRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on demo toggle, not when deps recompute
  }, [settings.demoMode]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capture session start when the first rep lands
    if (repCount > 0 && !sessionStart) setSessionStart(Date.now());
  }, [repCount, sessionStart]);

  const lastRep = reps[0];
  const lastRepWasClean = lastRep ? lastRep.analysis.errorsDetected.length === 0 : null;
  const activeFrame = settings.demoMode ? demo.frame : frame;

  // Snapshot lumbar baseline from the first upright frame and hold it, so that
  // lumbar_flexion errors trigger when the rep bends s2.pitch away from neutral.
  // Using the live frame as its own baseline would always produce delta = 0.
  const [baselineS2Pitch, setBaselineS2Pitch] = useState<number | null>(null);
  const baselineLockedRef = useRef(false);
  useEffect(() => {
    if (!activeFrame || baselineLockedRef.current) return;
    baselineLockedRef.current = true;
    setBaselineS2Pitch(activeFrame.s2.pitch);
  }, [activeFrame]);
  useEffect(() => {
    // Reset baseline capture on demo toggle
    baselineLockedRef.current = false;
    setBaselineS2Pitch(null);
  }, [settings.demoMode]);
  const { flashTrigger } = useLiveErrors(activeFrame, baselineS2Pitch);
  const { fallTrigger } = useFallDetector(activeFrame, settings.fallDetectionEnabled);

  // `voice` returns a fresh object each render, so a naive [fallTrigger, voice]
  // dep list re-runs every render and keeps re-opening the overlay after the
  // user dismisses it. Track the last-handled trigger value via a ref so we
  // only respond to new detector events, not to voice identity churn.
  const lastHandledFallRef = useRef(0);
  useEffect(() => {
    if (fallTrigger === lastHandledFallRef.current) return;
    lastHandledFallRef.current = fallTrigger;
    voice.cancel();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: open alert modal in response to detector event
    setFallAlertOpen(true);
  }, [fallTrigger, voice]);

  // Shallow reps (insufficient_depth) don't count toward rep count or form score
  const countedReps = reps.filter((r) => !r.analysis.errorsDetected.includes("insufficient_depth"));
  const effectiveRepCount = countedReps.length;
  const effectiveCleanReps = countedReps.filter((r) => r.analysis.errorsDetected.length === 0).length;
  const formScore = computeFormScore(countedReps);
  useEffect(() => { formScoreRef.current = formScore; }, [formScore]);

  // Assign display numbers only to non-shallow reps (shallow reps show "—")
  const displayMap = (() => {
    const map = new Map<number, number | null>();
    const reversed = [...reps].reverse();
    let counter = 0;
    for (const r of reversed) {
      const voided = r.analysis.errorsDetected.includes("insufficient_depth");
      map.set(r.analysis.repNumber, voided ? null : ++counter);
    }
    return map;
  })();
  const now = Date.now(); // eslint-disable-line react-hooks/purity -- snapshot used only by SessionSummary on open
  const sessionDurationMs = sessionStart ? now - sessionStart : 0;

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
    voice.cancel();
    setSettingsOpen(false);
    setSummaryOpen(false);
    setFallAlertOpen(false);
    summaryFiredRef.current = false;
    lastRepTimeRef.current = null;
  };

  return (
    <main
      className="mx-auto w-full max-w-[420px] px-3"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: settings.demoMode ? "10rem" : "2.5rem",
      }}
    >
      <header className="mb-3 flex items-center justify-between gap-3 border border-border bg-surface px-3 py-2">
        <span
          className="font-display text-base font-semibold tracking-tight text-foreground"
          style={{ letterSpacing: "-0.01em" }}
        >
          KINEMATECH
        </span>
        <div className="flex flex-none items-center gap-1.5">
          <ModeSwitcher active="workout" />
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
        {!settings.demoMode && settings.streamEnabled && (status === "live" || status === "mock") && (
          <SensorOfflineBanner health={health} />
        )}

        <StatusBand
          repCount={effectiveRepCount}
          cleanReps={effectiveCleanReps}
          formScore={formScore}
          startedAt={sessionStart}
          lastRepWasClean={lastRepWasClean}
          streak={streak}
          repTarget={settings.repsPerSetTarget}
        />

        <SensorSilhouette
          frame={activeFrame}
          baselineS2Pitch={baselineS2Pitch}
          flashTrigger={flashTrigger}
          fallActive={settings.demoMode && demo.isFalling}
        />

        <section aria-label="coaching event log" className="pt-2">
          <div className="flex items-baseline justify-between px-1 pb-2">
            <div className="flex items-baseline gap-2">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                event log
              </h2>
              <span className="font-mono text-[10px] text-muted">
                · {String(reps.length).padStart(2, "0")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {reps.length > 0 && !settings.demoMode && (
                <button
                  onClick={handleReset}
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted hover:text-foreground"
                >
                  clear
                </button>
              )}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {reps.length === 0 ? (
              <div className="border border-dashed border-border px-5 py-10 text-center">
                <div className="mx-auto mb-3 h-px w-10 bg-border-strong" />
                <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  {settings.demoMode ? "demo · ready" : "awaiting first rep"}
                </div>
                <div className="mt-2 text-sm text-muted-strong text-balance">
                  {settings.demoMode
                    ? "Tap a button below to inject an error into the log."
                    : "Start your workout — each rep drops into the log with AI-generated coaching."}
                </div>
              </div>
            ) : (
              <div className="border-t border-border">
                {reps.map((rep) => (
                  <RepCard
                    key={rep.analysis.repNumber}
                    rep={rep}
                    displayNumber={displayMap.get(rep.analysis.repNumber) ?? null}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <DemoPanel
        open={settings.demoMode}
        isAnimating={demo.isAnimating}
        onTrigger={(kind: DemoErrorKind) => demo.triggerRep(kind)}
        onFall={demo.triggerFall}
        onReset={handleReset}
      />

      <FallAlertOverlay open={fallAlertOpen} onDismiss={() => setFallAlertOpen(false)} />

      <SettingsSheet
        open={settingsOpen}
        currentUrl={url}
        settings={settings}
        showWorkoutRepTarget
        activeFrame={frame}
        rawFrame={rawFrame}
        sensorHealth={status === "live" || status === "mock" ? health : undefined}
        onSettingsChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSave}
        onReset={handleReset}
      />

      <SessionSummary
        open={summaryOpen}
        reps={countedReps}
        formScore={formScore}
        durationMs={sessionDurationMs}
        streak={streak}
        onClose={() => setSummaryOpen(false)}
        onNewSet={handleReset}
      />
    </main>
  );
}

const SENSOR_LABELS: Record<string, string> = {
  s1: "chest",
  s2: "lumbar",
  s3: "left thigh",
  s4: "right thigh",
  s5: "mid-back",
};

function SensorOfflineBanner({ health }: { health: import("@/lib/types").SensorHealthMap }) {
  const thighsDown = health.s3 === "offline" || health.s4 === "offline";
  const offline = (["s1", "s2", "s3", "s4", "s5"] as const).filter((id) => health[id] === "offline");
  if (offline.length === 0) return null;

  const names = offline.map((id) => SENSOR_LABELS[id]).join(", ");
  const message = thighsDown
    ? `${names} offline — rep detection paused. Check the IMU.`
    : `${names} offline — some form checks skipped.`;
  return (
    <div className="border border-danger/50 bg-danger/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-danger">
      {message}
    </div>
  );
}
