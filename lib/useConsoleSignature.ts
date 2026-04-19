"use client";
import { useEffect } from "react";

type Mode = "workout" | "worksite";

const ACCENT: Record<Mode, string> = {
  workout: "#c9f04b",
  worksite: "#f59152",
};

export function useConsoleSignature(mode: Mode) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & { __liftlogicSigned?: Mode };
    if (w.__liftlogicSigned === mode) return;
    w.__liftlogicSigned = mode;

    const brand = `color:${ACCENT[mode]};font-weight:700;letter-spacing:0.28em;font-family:ui-monospace,monospace;font-size:12px`;
    const warm = "color:#e8e8e0;font-family:ui-monospace,monospace;font-size:11px";
    const muted = "color:#808078;font-family:ui-monospace,monospace;font-size:11px";

    const line1 = mode === "workout" ? "// workout mode" : "// worksite mode";
    const line2 = "five IMUs · 50 Hz sagittal + frontal · rep detection armed";

    console.log(
      `%cLIFTLOGIC%c ${line1}\n%c${line2}\n%c↳ purdue starkhacks 2026 · built by four undergrads`,
      brand,
      warm,
      muted,
      muted,
    );
  }, [mode]);
}
