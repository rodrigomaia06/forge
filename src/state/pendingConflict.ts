import type { DataTransferSelection, ForgeDataTransfer } from '../data/transferFormat';
import type { ShareConflict } from '../data/importDiff';

/**
 * Hands a shared single-item *conflict* (an incoming item that updates one
 * already on device) from Backup & Export to the dedicated Import conflict
 * screen, without routing a large object through navigation params. It is a
 * one-shot: the screen takes it on mount and clears it.
 */
export type PendingConflict = {
  transfer: ForgeDataTransfer;
  conflict: ShareConflict;
  selection: DataTransferSelection;
};

let pending: PendingConflict | null = null;

export function setPendingConflict(value: PendingConflict): void {
  pending = value;
}

export function takePendingConflict(): PendingConflict | null {
  const value = pending;
  pending = null;
  return value;
}
