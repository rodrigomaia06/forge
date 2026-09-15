import { useSyncExternalStore } from 'react';

let now = Date.now();
let timeout: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

/** Publishes an interaction timestamp so a fresh timer never sees a stale tick. */
export function synchronizeNow(value = Date.now()): number {
  now = value;
  listeners.forEach((listener) => listener());
  return now;
}

function tick(): void {
  synchronizeNow();
  timeout = setTimeout(tick, Math.max(8, 1000 - (Date.now() % 1000)));
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timeout) tick();
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timeout) { clearTimeout(timeout); timeout = null; }
  };
}
/** A shared, second-aligned wall clock for timer text without screen-wide rerenders. */
export function useSynchronizedNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => now);
}
