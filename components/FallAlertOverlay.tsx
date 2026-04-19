"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;
const COUNTDOWN_SECONDS = 10;

interface Props {
  open: boolean;
  onDismiss: () => void;
}

type Phase = "countdown" | "alerted";

function formatClock(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/**
 * Inner component owns all countdown state so that it fully resets every time
 * the overlay opens — AnimatePresence unmounts us when `open` goes false.
 */
function FallAlertBody({ onDismiss }: { onDismiss: () => void }) {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const [alertedAt, setAlertedAt] = useState<Date | null>(null);

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (let step = 1; step <= COUNTDOWN_SECONDS; step++) {
      timeouts.push(
        setTimeout(() => setRemaining(COUNTDOWN_SECONDS - step), step * 1000),
      );
    }
    timeouts.push(
      setTimeout(() => {
        setPhase("alerted");
        setAlertedAt(new Date());
      }, COUNTDOWN_SECONDS * 1000),
    );
    return () => timeouts.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6 text-center"
      style={{
        background:
          phase === "countdown"
            ? "radial-gradient(circle at 50% 40%, rgba(220,38,38,0.55) 0%, rgba(10,0,0,0.96) 70%)"
            : "radial-gradient(circle at 50% 40%, rgba(120,30,30,0.35) 0%, rgba(10,0,0,0.98) 70%)",
      }}
    >
      {phase === "countdown" ? (
        <motion.div
          key="countdown"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0.9, 1, 0.9] }}
          transition={{ opacity: { duration: 1.1, repeat: Infinity, ease: "easeInOut" } }}
          className="flex w-full max-w-sm flex-col items-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 border border-danger/70 bg-danger/15 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-danger">
              emergency
            </span>
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            FALL DETECTED
          </h1>

          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-strong">
            alerting authorities in
          </p>

          <div
            className="my-4 font-display text-[96px] font-semibold leading-none tabular-nums text-danger"
            style={{ textShadow: "0 0 28px rgba(220,38,38,0.55)" }}
          >
            {remaining}
          </div>

          <p className="mb-6 max-w-[18rem] font-mono text-[11px] uppercase tracking-[0.2em] text-muted-strong">
            tap below if you&apos;re okay
          </p>

          <button
            onClick={onDismiss}
            className="w-full max-w-xs border-2 border-foreground bg-foreground py-3.5 font-mono text-[12px] font-semibold uppercase tracking-[0.22em] text-background hover:brightness-95"
          >
            i&apos;m ok — cancel alert
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="alerted"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="flex w-full max-w-sm flex-col items-center"
        >
          <div className="mb-5 inline-flex items-center gap-2 border border-danger/70 bg-danger/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-danger" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-danger">
              dispatched
            </span>
          </div>

          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            AUTHORITIES ALERTED
          </h1>

          <p className="mt-3 max-w-[20rem] text-[15px] leading-relaxed text-muted-strong">
            Emergency services have been notified of your location. Stay still — help is on the way.
          </p>

          <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-px border border-border bg-border">
            <div className="bg-surface px-3 py-2.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
                coords
              </div>
              <div className="mt-0.5 font-mono text-[12px] tabular-nums text-foreground">
                40.43°N
                <br />
                86.91°W
              </div>
            </div>
            <div className="bg-surface px-3 py-2.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
                dispatched
              </div>
              <div className="mt-0.5 font-mono text-[12px] tabular-nums text-foreground">
                {alertedAt ? formatClock(alertedAt) : "--:--:--"}
              </div>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="mt-7 w-full max-w-xs border border-border-strong bg-surface py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground hover:border-foreground"
          >
            dismiss
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

export function FallAlertOverlay({ open, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {open && <FallAlertBody key="fall-body" onDismiss={onDismiss} />}
    </AnimatePresence>
  );
}
