import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';

const KEY = '@forge/diagnostics-v1';
const LIMIT = 80;

export type DiagnosticKind = 'app-opened' | 'data-exported' | 'data-imported' | 'backup-created' | 'backup-restored' | 'operation-failed';
export type DiagnosticEntry = { id: string; at: number; kind: DiagnosticKind; detail?: 'invalid-file' | 'unavailable' | 'unknown' };

function isEntry(value: unknown): value is DiagnosticEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<DiagnosticEntry>;
  return typeof entry.id === 'string' && typeof entry.at === 'number' && typeof entry.kind === 'string';
}
export async function loadDiagnostics(): Promise<DiagnosticEntry[]> {
  try { const parsed: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]'); return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, LIMIT) : []; }
  catch { return []; }
}
export async function recordDiagnostic(kind: DiagnosticKind, detail?: DiagnosticEntry['detail']): Promise<void> {
  const entries = await loadDiagnostics();
  const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), kind, detail }, ...entries].slice(0, LIMIT);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
export async function clearDiagnostics(): Promise<void> { await AsyncStorage.removeItem(KEY); }
export async function exportDiagnostics(): Promise<void> {
  const entries = await loadDiagnostics();
  await Share.share({ title: 'Forge diagnostics', message: JSON.stringify({ format: 'forge-diagnostics', entries }, null, 2) });
}
