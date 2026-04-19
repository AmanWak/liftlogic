"use client";
import Link from "next/link";

type Mode = "workout" | "worksite";

interface Props {
  active: Mode;
}

const MODES: { mode: Mode; href: string; label: string }[] = [
  { mode: "workout", href: "/", label: "workout" },
  { mode: "worksite", href: "/worker", label: "worksite" },
];

export function ModeSwitcher({ active }: Props) {
  return (
    <div className="inline-flex h-7 items-stretch border border-border bg-surface-2 p-0.5">
      {MODES.map(({ mode, href, label }) => {
        const isActive = mode === active;
        return (
          <Link
            key={mode}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center px-2 font-mono text-[10px] uppercase tracking-[0.22em] transition ${
              isActive
                ? "bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
