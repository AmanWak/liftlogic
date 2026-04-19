"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { WORKER_ERROR_LABEL, type WorkerFormError } from "@/lib/types-worker";
import type { LiftResult } from "@/lib/useWorkerStream";

const EASE = [0.16, 1, 0.3, 1] as const;

const ERROR_SEVERITY: Record<WorkerFormError, "danger" | "warn"> = {
  back_rounded: "danger",
  stiff_leg_lift: "danger",
  overloaded_lean: "danger",
  asymmetric_load: "warn",
};

export function LiftCard({ lift }: { lift: LiftResult }) {
  const [open, setOpen] = useState(false);
  const { analysis, coaching, coachingPending, coachingError } = lift;
  const clean = analysis.errorsDetected.length === 0;

  const statusLabel = clean
    ? "SAFE"
    : `${analysis.errorsDetected.length} FLAG${analysis.errorsDetected.length > 1 ? "S" : ""}`;
  const statusColor = clean ? "text-accent" : "text-danger";
  const statusDot = clean ? "bg-accent" : "bg-danger";

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.4, ease: EASE }}
      onClick={() => setOpen((o) => !o)}
      className="group grid w-full grid-cols-[auto_1fr] gap-x-4 border-l border-b border-border bg-surface/60 py-3 pl-4 pr-3 text-left transition hover:bg-surface"
    >
      {/* Left rail: lift number */}
      <div className="flex flex-col items-start gap-1 pt-0.5">
        <span className="num font-mono text-[10px] leading-none text-muted">
          LIFT
        </span>
        <span className="num font-display text-2xl font-semibold leading-none tracking-tight text-foreground">
          {String(analysis.liftNumber).padStart(2, "0")}
        </span>
      </div>

      {/* Right: status, chips, coaching */}
      <div className="min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDot}`} />
            <span className={`font-mono text-[11px] font-semibold tracking-[0.22em] ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <span className="num font-mono text-[10px] text-muted">
            {(analysis.durationMs / 1000).toFixed(1)}s
          </span>
        </div>

        {analysis.errorsDetected.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {analysis.errorsDetected.map((e) => (
              <span
                key={e}
                className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
                  ERROR_SEVERITY[e] === "danger"
                    ? "border-danger/50 text-danger"
                    : "border-warn/50 text-warn"
                }`}
              >
                {WORKER_ERROR_LABEL[e]}
              </span>
            ))}
          </div>
        )}

        <div className="min-h-[2.5rem] text-[13.5px] leading-relaxed text-foreground/90 text-balance">
          {coachingPending ? (
            <span className="inline-flex items-center gap-1.5">
              <Wave />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                analyzing
              </span>
            </span>
          ) : coachingError ? (
            <span className="font-mono text-[11px] text-danger">
              coach unavailable · {coachingError}
            </span>
          ) : (
            coaching || "…"
          )}
        </div>

        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="grid grid-cols-3 gap-x-4 gap-y-1 border-t border-border/80 pt-2 font-mono text-[10px]"
          >
            <Metric k="TORSO"    v={`${analysis.maxTorsoFlexion}°`} />
            <Metric k="LUMBAR Δ" v={`${analysis.maxLumbarDelta}°`} />
            <Metric k="THIGH AVG" v={`${analysis.avgThighFlexion}°`} />
            <Metric k="LEG ASYM"  v={`${analysis.maxLegAsymmetry}°`} />
            <Metric k="SIDE BEND" v={`${analysis.maxTorsoSideBend}°`} />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/50 py-1">
      <span className="uppercase tracking-[0.18em] text-muted">{k}</span>
      <span className="num text-foreground">{v}</span>
    </div>
  );
}

function Wave() {
  return (
    <span className="inline-flex h-3 items-end gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-accent"
          animate={{ height: ["30%", "100%", "30%"] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.08,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}
