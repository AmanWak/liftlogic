"use client";
import { AnimatePresence, motion } from "framer-motion";
import type { DemoErrorKind } from "@/lib/useDemoMode";

interface DemoPanelProps {
  open: boolean;
  isAnimating: boolean;
  onTrigger: (kind: DemoErrorKind) => void;
  onFall: () => void;
  onReset: () => void;
}

const SPRING = { type: "spring", stiffness: 400, damping: 40 } as const;

interface TriggerBtn {
  kind: DemoErrorKind;
  label: string;
}

const TRIGGERS: TriggerBtn[] = [
  { kind: "clean",                 label: "Clean" },
  { kind: "knee_valgus",           label: "Knee cave" },
  { kind: "insufficient_depth",    label: "Shallow" },
  { kind: "excessive_forward_lean",label: "Fwd lean" },
  { kind: "hip_shift",             label: "Hip shift" },
  { kind: "lumbar_flexion",        label: "Lumbar" },
];

export function DemoPanel({ open, isAnimating, onTrigger, onFall, onReset }: DemoPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="demo-panel"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={SPRING}
          className="fixed bottom-0 left-1/2 w-full max-w-[420px] -translate-x-1/2 border-t border-border bg-surface"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              demo controls
            </span>
            <span className="font-mono text-[9px] text-muted/60 uppercase tracking-[0.2em]">
              {isAnimating ? "animating…" : "ready"}
            </span>
          </div>

          {/* Rep trigger grid */}
          <div className="grid grid-cols-3 gap-1.5 px-3 pt-3 pb-1">
            {TRIGGERS.map(({ kind, label }) => (
              <button
                key={kind}
                onClick={() => onTrigger(kind)}
                disabled={isAnimating}
                className="border border-border bg-surface/60 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/80 transition hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Fall + Reset row */}
          <div className="grid grid-cols-2 gap-1.5 px-3 pt-1 pb-2">
            <button
              onClick={onFall}
              disabled={isAnimating}
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
