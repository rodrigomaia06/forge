type Flush = () => Promise<unknown>;
const flushers = new Set<Flush>();
const listeners = new Set<() => void>();

export function registerPersistenceFlush(flush: Flush): () => void {
  flushers.add(flush);
  return () => {
    flushers.delete(flush);
  };
}

export async function flushPersistence(): Promise<void> {
  await Promise.all([...flushers].map((flush) => flush()));
}

export function subscribePersistenceReset(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPersistenceReset(): void {
  listeners.forEach((listener) => listener());
}
