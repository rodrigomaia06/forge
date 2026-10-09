import type { StriveSnapshot } from './striveImport';

export async function pickStriveBackup(): Promise<{
  name: string;
  snapshot: StriveSnapshot;
} | null> {
  throw new Error(
    'Strive database imports are available in the iOS and Android app. CSV imports remain available in this browser.',
  );
}
