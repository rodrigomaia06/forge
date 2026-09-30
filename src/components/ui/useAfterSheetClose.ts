import { useCallback, useRef } from 'react';

/**
 * Defers an action until a Forge sheet has fully closed. Presenting a follow-up
 * Modal (a confirmation, an editor) while the source sheet is still dismissing
 * is dropped on iOS; instead, register the action with `runAfterClose`, close
 * the sheet, and wire `onClosed` to the sheet's `onClosed`/`ForgeActionSheet`
 * `onClosed` prop so it runs once the sheet is gone.
 */
export function useAfterSheetClose(): {
  runAfterClose: (action: () => void) => void;
  onClosed: () => void;
} {
  const pending = useRef<null | (() => void)>(null);
  const runAfterClose = useCallback((action: () => void) => {
    pending.current = action;
  }, []);
  const onClosed = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);
  return { runAfterClose, onClosed };
}
