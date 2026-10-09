let pending: Promise<unknown> = Promise.resolve();
let recover: (() => Promise<void>) | undefined;
export function registerWebRecovery(operation: () => Promise<void>): void {
  recover = operation;
}
/** Browser repository operations recover interrupted imports before sharing one ordering boundary. */
export function queueWebWrite<T>(operation: () => Promise<T>): Promise<T> {
  const recoveredOperation = async () => {
    await recover?.();
    return operation();
  };
  const run = pending.then(recoveredOperation, recoveredOperation);
  pending = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
