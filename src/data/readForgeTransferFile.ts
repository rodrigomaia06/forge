import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { readExternalText } from './snapshots/backupStorage';
import { readAsStringAsync } from 'expo-file-system/legacy';
import { parseDataTransfer, type ForgeDataTransfer } from './backupRepository';

/**
 * Reads the raw text of a launched `.forge` file.
 *
 * iOS opens documents in place (LSSupportsOpeningDocumentsInPlace, required so
 * Forge's Documents folder appears in Files), handing a security-scoped
 * `file://` URL to the original file. The file API requests that scope itself;
 * if a provider still refuses, the backup storage module reads it with explicit
 * scoped access and file coordination.
 *
 * Android VIEW intents commonly deliver a Storage Access Framework `content://`
 * URI, which the new `File` API cannot open in read mode, so those go through
 * the legacy `readAsStringAsync`.
 */
export async function readUriText(uri: string): Promise<string> {
  if (uri.startsWith('content://')) {
    return readAsStringAsync(uri);
  }
  try {
    return await new File(uri).text();
  } catch (error) {
    const text = Platform.OS === 'ios' ? await readExternalText(uri) : null;
    if (text === null) throw error;
    return text;
  }
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
