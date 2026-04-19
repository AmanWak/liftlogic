"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { DemoLiftKind } from "@/lib/useDemoWorker";

interface DemoWorkerPanelProps {
  open: boolean;
  isAnimating: boolean;
  shiftActive: boolean;
  onTrigger: (kind: DemoLiftKind) => void;
  onFall: () => void;
  onReset: () => void;
}

const SPRING = { type: "spring", stiffness: 400, damping: 40 } as const;

interface TriggerBtn {
  kind: DemoLiftKind;
  label: string;
}

const TRIGGERS: TriggerBtn[] = [
  { kind: "clean",           label: "Clean" },
  { kind: "back_rounded",    label: "Rounded" },
  { kind: "stiff_leg_lift",  label: "Stiff leg" },
  { kind: "overloaded_lean", label: "Overload" },
  { kind: "asymmetric_load", label: "Asym load" },
];

export function DemoWorkerPanel({
  open,
  isAnimating,
  shiftActive,
  onTrigger,
  onFall,
  onReset,
}: DemoWorkerPanelProps) {
  const disabled = isAnimating || !shiftActive;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="demo-worker-panel"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={SPRING}
          className="fixed bottom-0 left-1/2 w-full max-w-[420px] -translate-x-1/2 border-t border-border bg-surface"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              demo controls
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted/60">
              {!shiftActive ? "start shift first" : isAnimating ? "animating…" : "ready"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 px-3 pt-3 pb-1">
            {TRIGGERS.map(({ kind, label }) => (
              <button
                key={kind}
                onClick={() => onTrigger(kind)}
                disabled={disabled}
                className="border border-border bg-surface/60 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/80 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5 px-3 pt-1 pb-2">
            <button
              onClick={onFall}
              disabled={disabled}
              className="flex items-center justify-center gap-1.5 border border-danger/60 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-danger opacity-60" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-danger" />
              </span>
              Simulate fall
            </button>
            <button
              onClick={onReset}
              className="border border-border py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted transition hover:border-border-strong hover:text-foreground"
            >
              Reset log
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
