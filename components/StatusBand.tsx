"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useClock } from "@/lib/useClock";

function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export function StatusBand({
  repCount,
  cleanReps,
  formScore,
  startedAt,
  frozenMs,
  lastRepWasClean,
  streak,
  unitLabel = "reps",
  scoreLabel = "form",
  cleanLabel = "clean",
}: {
  repCount: number;
  cleanReps: number;
  formScore: number | null;
  startedAt: number | null;
  frozenMs?: number | null;
  lastRepWasClean: boolean | null;
  streak: number;
  unitLabel?: string;
  scoreLabel?: string;
  cleanLabel?: string;
}) {
  const now = useClock();
  const elapsed = frozenMs ?? (startedAt ? now - startedAt : 0);
  const score = formScore;

  const scoreColor =
    score === null
      ? "text-muted"
      : score >= 80
        ? "text-accent"
        : score >= 50
          ? "text-warn"
          : "text-danger";

  return (
    <section
      aria-label="session readout"
      className="relative overflow-hidden border border-border bg-surface"
    >
      {/* top hairline: caliber + session */}
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        <span className="flex items-center gap-2">
          <span>ll · session</span>
          <AnimatePresence mode="popLayout">
            {streak >= 1 && (
              <motion.span
                key={streak}
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: [1.22, 1], opacity: 1 }}
                exit={{ scale: 0.88, opacity: 0 }}
                transition={{ duration: 0.52, times: [0, 1], ease: easeOutExpo }}
                className="inline-block origin-left text-accent"
              >
                · streak {streak}
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span className="num text-muted-strong">{formatClock(elapsed)}</span>
      </div>

      {/* radar ping on clean rep / red sweep on bad rep */}
      <AnimatePresence>
        {lastRepWasClean !== null && (
          <motion.div
            key={`${repCount}-${lastRepWasClean}`}
            initial={{ opacity: 0.9, scaleX: 0 }}
            animate={{ opacity: 0, scaleX: 1 }}
            transition={{ duration: 0.9, ease: easeOutExpo }}
            className="pointer-events-none absolute inset-x-0 top-[33px] h-px origin-left"
            style={{
              background: lastRepWasClean
                ? "linear-gradient(to right, transparent, var(--accent), transparent)"
                : "linear-gradient(to right, transparent, var(--danger), transparent)",
            }}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-[1.1fr_1fr] divide-x divide-border/80">
        <Readout label={unitLabel}>
          <AnimatePresence mode="popLayout">
            <motion.div
              key={repCount}
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -14, opacity: 0 }}
              transition={{ duration: 0.45, ease: easeOutExpo }}
              className="num font-display text-[64px] font-semibold leading-none tracking-tight text-foreground"
            >
              {String(repCount).padStart(2, "0")}
            </motion.div>
          </AnimatePresence>
          <Scale total={Math.max(10, repCount + 2)} filled={repCount} />
        </Readout>

        <Readout label={scoreLabel} align="right">
          <div className={`num font-display text-[64px] font-semibold leading-none tracking-tight ${scoreColor}`}>
            {score === null ? "—" : String(score).padStart(2, "0")}
            {score !== null && (
              <span className="align-top font-mono text-[18px] font-medium text-muted">%</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            <span>{cleanLabel}</span>
            <span className="num text-muted-strong">
              {String(cleanReps).padStart(2, "0")}
              <span className="text-muted">/</span>
              {String(repCount).padStart(2, "0")}
            </span>
          </div>
        </Readout>
      </div>
    </section>
  );
}

function Readout({
  label,
  align = "left",
  children,
}: {
  label: string;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"} gap-1 px-4 py-4`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function Scale({ total, filled }: { total: number; filled: number }) {
  const ticks = Array.from({ length: total });
  return (
    <div className="mt-3 flex h-3 items-end gap-[3px]">
      {ticks.map((_, i) => (
        <span
          key={i}
          className={`w-[3px] ${
            i < filled
              ? "h-full bg-accent"
              : i % 5 === 4
                ? "h-[9px] bg-border-strong"
                : "h-[6px] bg-border"
          }`}
        />
      ))}
    </div>
  );
}
