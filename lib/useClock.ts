"use client";
import { useSyncExternalStore } from "react";

let snapshot = Date.now();
const listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | null = null;

function start() {
  if (interval) return;
  interval = setInterval(() => {
    snapshot = Date.now();
    for (const l of listeners) l();
  }, 250);
}

function stop() {
  if (listeners.size === 0 && interval) {
    clearInterval(interval);
    interval = null;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  start();
  return () => {
    listeners.delete(onChange);
    stop();
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return 0;
}

export function useClock() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
