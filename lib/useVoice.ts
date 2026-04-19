"use client";
import { useCallback, useEffect, useRef } from "react";

export interface UseVoiceResult {
  speak: (text: string) => void;
  cancel: () => void;
  supported: boolean;
}

function fallbackSpeak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.05;
  utter.pitch = 1;
  utter.volume = 1;
  synth.speak(utter);
}

export function useVoice(enabled: boolean, premium: boolean = false): UseVoiceResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const unlockedRef = useRef(false);
  const supported = typeof window !== "undefined";

  useEffect(() => {
    if (!supported) return;
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    const el = audioRef.current;
    return () => {
      el.pause();
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    };
  }, [supported]);

  // iOS/Safari require audio playback to start from a user gesture. Unlock
  // both <audio> and speechSynthesis on the first click.
  useEffect(() => {
    if (!supported) return;
    const handler = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      const a = audioRef.current;
      if (a) {
        a.muted = true;
        a.src =
          "data:audio/mp3;base64,/+MYxAAAAANIAUAAAASEEB/jwOFM/0MM/90b/+RhST//w4NFwOjf///PZu////9lns5GFDv//l9GlUIEEIAAAgIg8g+n0OqmWvHxxYpA0U1K+p0IjMPUUAs6Wc4JZEwMdAeBSWGFLHH2UiEIWuKlMKnAiEbQAAIAIAPAIAAABQqQRX0RRgZZbGRBAqUJFIgJCOQAAAgAgg3NFGAgA=";
        a.play().catch(() => {}).finally(() => {
          a.muted = false;
          a.removeAttribute("src");
          a.load();
        });
      }
    };
    window.addEventListener("click", handler, { once: true });
    window.addEventListener("touchstart", handler, { once: true });
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
    };
  }, [supported]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!supported || !enabled) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      cancel();

      if (!premium) {
        fallbackSpeak(trimmed);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = url;

        const a = audioRef.current;
        if (!a) {
          fallbackSpeak(trimmed);
          return;
        }
        a.src = url;
        await a.play();
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof Error) console.warn("[useVoice] ElevenLabs failed, falling back:", err.message);
        fallbackSpeak(trimmed);
      }
    },
    [supported, enabled, premium, cancel],
  );

  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  return { speak, cancel, supported };
}
