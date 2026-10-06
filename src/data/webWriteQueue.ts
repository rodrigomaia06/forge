let pending: Promise<unknown> = Promise.resolve();
/** All browser plan and workout writes share one ordering boundary. */
export function queueWebWrite<T>(operation: () => Promise<T>): Promise<T> {
  const run = pending.then(operation, operation);
  pending = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
