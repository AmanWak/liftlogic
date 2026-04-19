"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { FORM_ERROR_LABEL } from "@/lib/types";

interface SummaryItem {
  analysis: {
    errorsDetected: string[];
    durationMs: number;
  };
}

interface Props {
  open: boolean;
  reps: SummaryItem[];
  formScore: number | null;
  durationMs: number;
  streak: number;
  onClose: () => void;
  onNewSet: () => void;
  recapEndpoint?: string;
  errorLabels?: Record<string, string>;
  unitLabel?: string;
  headerLabel?: string;
  newButtonLabel?: string;
}

const EASE = [0.16, 1, 0.3, 1] as const;

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function scoreColor(score: number | null) {
  if (score === null) return "text-muted";
  if (score >= 80) return "text-accent";
  if (score >= 50) return "text-warn";
  return "text-danger";
}

export function SessionSummary({
  open,
  reps,
  formScore,
  durationMs,
  streak,
  onClose,
  onNewSet,
  recapEndpoint = "/api/recap",
  errorLabels = FORM_ERROR_LABEL as unknown as Record<string, string>,
  unitLabel = "reps",
  headerLabel = "set complete · summary",
  newButtonLabel = "new set",
}: Props) {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failDetail, setFailDetail] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!open || reps.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset when sheet opens or retried
    setRecap(null);
    setLoading(true);
    setFailDetail(null);
    const payload = {
      reps: reps.map((r) => ({
        errorsDetected: r.analysis.errorsDetected,
        durationMs: r.analysis.durationMs,
      })),
      durationMs,
      formScore: formScore ?? 0,
    };
    fetch(recapEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        const data = await r.json() as { recap?: string; detail?: string; error?: string };
        if (!r.ok) throw new Error(data.detail ?? data.error ?? `HTTP ${r.status}`);
        if (!data.recap) throw new Error("Empty response from model");
        setRecap(data.recap);
      })
      .catch((e: unknown) => setFailDetail(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [open, retryCount]); // eslint-disable-line react-hooks/exhaustive-deps -- only re-fetch when sheet opens or retry triggered

  // Error frequency breakdown
  const errorCounts = reps.reduce<Record<string, number>>((acc, r) => {
    for (const e of r.analysis.errorsDetected) {
      acc[e] = (acc[e] ?? 0) + 1;
    }
    return acc;
  }, {});
  const topErrors = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

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
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-accent" />
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  {headerLabel}
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
              {/* Streak callout */}
              {streak >= 2 && (
                <div className="mb-4 border border-accent/40 bg-accent/5 px-4 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
                    streak · {streak} sets
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                    {" "}above 85% in a row
                  </span>
                </div>
              )}

              {/* Stats row */}
              <div className="mb-5 grid grid-cols-3 divide-x divide-border border border-border">
                <StatCell label={unitLabel} value={String(reps.length).padStart(2, "0")} />
                <StatCell
                  label="form"
                  value={formScore !== null ? `${formScore}%` : "—"}
                  valueClass={scoreColor(formScore)}
                />
                <StatCell label="time" value={formatDuration(durationMs)} />
              </div>

              {/* Error breakdown */}
              {topErrors.length > 0 && (
                <div className="mb-5">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                    top issues
                  </div>
                  <div className="space-y-1.5">
                    {topErrors.map(([err, count]) => (
                      <div key={err} className="flex items-center justify-between">
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                          {errorLabels[err] ?? err}
                        </span>
                        <span className="font-mono text-[11px] text-muted">
                          {count}/{reps.length} {unitLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gemini recap */}
              <div className="mb-5 border border-border bg-surface-2 px-4 py-3">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
                  ai coaching recap
                </div>
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-border-strong" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-border-strong" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-border-strong" />
                  </div>
                ) : recap ? (
                  <p className="text-sm leading-relaxed text-foreground">{recap}</p>
                ) : failDetail !== null ? (
                  <div className="space-y-1.5">
                    <p className="font-mono text-[10px] text-danger">{failDetail}</p>
                    <button
                      onClick={() => setRetryCount((c) => c + 1)}
                      className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:brightness-110"
                    >
                      retry
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onClose}
                  className="border border-border bg-surface-2 py-2.5 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-strong hover:border-border-strong"
                >
                  keep log
                </button>
                <button
                  onClick={onNewSet}
                  className="bg-accent py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-background hover:brightness-95"
                >
                  {newButtonLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatCell({
  label,
  value,
  valueClass = "text-foreground",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-3">
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">{label}</span>
      <span className={`font-display text-2xl font-semibold leading-none ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}
