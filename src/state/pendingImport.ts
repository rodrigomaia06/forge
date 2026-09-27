import type { ForgeDataTransfer } from '../data/transferFormat';

/**
 * Hands a picked data-dump transfer from Backup & Export to the Import selection
 * screen without routing a large object through navigation params. It is a
 * one-shot: the screen takes it on mount and clears it.
 */
let pending: ForgeDataTransfer | null = null;

export function setPendingImport(transfer: ForgeDataTransfer): void {
  pending = transfer;
}

export function takePendingImport(): ForgeDataTransfer | null {
  const transfer = pending;
  pending = null;
  return transfer;
}
