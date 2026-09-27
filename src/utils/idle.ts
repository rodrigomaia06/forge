// A small replacement for the deprecated `InteractionManager.runAfterInteractions`.
// Runs non-critical work once the JS thread is idle — or within `timeout` ms at
// the latest so it never starves — and returns a canceller. Falls back to a
// microtask-ish timeout where `requestIdleCallback` is unavailable.

declare const requestIdleCallback:
  | ((callback: () => void, options?: { timeout?: number }) => number)
  | undefined;
declare const cancelIdleCallback: ((handle: number) => void) | undefined;

export function runWhenIdle(callback: () => void, timeout = 500): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(callback, { timeout });
    return () => cancelIdleCallback?.(handle);
  }
  const timer = setTimeout(callback, 1);
  return () => clearTimeout(timer);
}
