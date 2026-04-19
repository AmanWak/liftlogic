"use client";
import type { ConnStatus } from "@/lib/useSensorStream";

const STATUS_META: Record<
  ConnStatus,
  { label: string; dotClass: string; textClass: string; pulse: boolean }
> = {
  idle:         { label: "idle",    dotClass: "bg-muted",      textClass: "text-muted",       pulse: false },
  connecting:   { label: "link",    dotClass: "bg-warn",       textClass: "text-warn",        pulse: true  },
  live:         { label: "live",    dotClass: "bg-accent",     textClass: "text-accent",      pulse: false },
  mock:         { label: "sim",     dotClass: "bg-accent-dim", textClass: "text-accent-dim",  pulse: false },
  demo:         { label: "demo",    dotClass: "bg-warn",       textClass: "text-warn",        pulse: false },
  disconnected: { label: "offline", dotClass: "bg-danger",     textClass: "text-danger",      pulse: true  },
  error:        { label: "err",     dotClass: "bg-danger",     textClass: "text-danger",      pulse: true  },
};

export function ConnectionPill({
  status,
  onClick,
}: {
  status: ConnStatus;
  onClick?: () => void;
}) {
  const meta = STATUS_META[status];
  return (
    <button
      onClick={onClick}
      aria-label={`connection: ${meta.label}`}
      className="group flex h-7 items-center gap-1.5 border border-border bg-surface px-2 font-mono text-[10px] uppercase tracking-[0.22em] transition hover:border-border-strong"
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {meta.pulse && (
          <span className={`absolute inset-0 rounded-full ${meta.dotClass} opacity-50 animate-ping`} />
        )}
        <span className={`relative h-2 w-2 rounded-full ${meta.dotClass}`} />
      </span>
      <span className={meta.textClass}>{meta.label}</span>
    </button>
  );
}
