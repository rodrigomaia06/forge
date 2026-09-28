import { File } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { parseDataTransfer, type ForgeDataTransfer } from './backupRepository';

/**
 * Reads the raw text of a launched `.forge` file. iOS hands the OS an
 * app-owned `file://` copy (the app Inbox), which the current file API reads
 * directly. Android VIEW intents commonly deliver a Storage Access Framework
 * `content://` URI, which the new `File` API cannot open in read mode — the
 * legacy `readAsStringAsync` still resolves those, so route them there.
 */
async function readUriText(uri: string): Promise<string> {
  if (uri.startsWith('content://')) {
    return readAsStringAsync(uri);
  }
  return new File(uri).text();
}

/**
 * Reads and validates a launched `.forge` file into a Forge transfer. Reuses
 * `parseDataTransfer`, so a file whose contents are not a compatible Forge
 * export throws the same error the in-app Import path shows, and non-Forge
 * files the OS mistakenly routed here are rejected on content rather than name.
 */
export async function readForgeTransferFromUri(uri: string): Promise<ForgeDataTransfer> {
  return parseDataTransfer(await readUriText(uri));
}
