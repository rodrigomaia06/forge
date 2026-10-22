import { appStateKeys, loadAppState, saveAppState, updateAppState } from './appStateRepository';
import { Share } from 'react-native';

const KEY = appStateKeys.diagnostics;
const LIMIT = 80;

export type DiagnosticKind =
  | 'app-opened'
  | 'data-exported'
  | 'data-imported'
  | 'backup-created'
  | 'backup-restored'
  | 'operation-failed';
export type DiagnosticEntry = {
  id: string;
  at: number;
  kind: DiagnosticKind;
  detail?: 'invalid-file' | 'unavailable' | 'unknown';
};

const diagnosticKinds = new Set<DiagnosticKind>([
  'app-opened',
  'data-exported',
  'data-imported',
  'backup-created',
  'backup-restored',
  'operation-failed',
]);
const diagnosticDetails = new Set<NonNullable<DiagnosticEntry['detail']>>([
  'invalid-file',
  'unavailable',
  'unknown',
]);

/** Rebuild persisted rows so a corrupt cache can never be used to export private fields. */
function parseEntry(value: unknown): DiagnosticEntry | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Partial<DiagnosticEntry>;
  const at = entry.at;
  if (
    typeof entry.id !== 'string' ||
    typeof at !== 'number' ||
    !Number.isFinite(at) ||
    !diagnosticKinds.has(entry.kind as DiagnosticKind)
  )
    return null;
  const detail = diagnosticDetails.has(entry.detail as NonNullable<DiagnosticEntry['detail']>)
    ? entry.detail
    : undefined;
  return { id: entry.id, at, kind: entry.kind as DiagnosticKind, ...(detail ? { detail } : {}) };
}
export async function loadDiagnostics(): Promise<DiagnosticEntry[]> {
  try {
    const parsed: unknown = JSON.parse((await loadAppState(KEY)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed
          .flatMap((entry) => {
            const parsedEntry = parseEntry(entry);
            return parsedEntry ? [parsedEntry] : [];
          })
          .slice(0, LIMIT)
      : [];
  } catch {
    return [];
  }
}
export async function recordDiagnostic(
  kind: DiagnosticKind,
  detail?: DiagnosticEntry['detail'],
): Promise<void> {
  await updateAppState(KEY, (raw) => {
    let entries: DiagnosticEntry[] = [];
    try {
      const parsed = JSON.parse(raw ?? '[]');
      if (Array.isArray(parsed))
        entries = parsed.flatMap((value) => {
          const entry = parseEntry(value);
          return entry ? [entry] : [];
        });
    } catch {
      /* Discard malformed diagnostics only. */
    }
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
        kind,
        detail,
      },
      ...entries,
    ].slice(0, LIMIT);
    return JSON.stringify(next);
  });
}
export async function clearDiagnostics(): Promise<void> {
  await saveAppState(KEY, null);
}
export async function exportDiagnostics(): Promise<void> {
  const entries = await loadDiagnostics();
  // IDs are implementation-only keys for the local list. They add no value to a
  // support export, so omit them alongside all workout and user data.
  const exportEntries = entries.map(({ at, kind, detail }) => ({
    at,
    kind,
    ...(detail ? { detail } : {}),
  }));
  await Share.share({
    title: 'Forge diagnostics',
    message: JSON.stringify({ format: 'forge-diagnostics', entries: exportEntries }, null, 2),
  });
}
