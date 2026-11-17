import { Platform } from 'react-native';
import { Directory, File } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { safName, type SnapshotFiles } from './snapshotCore';

type Root = 'icloud' | 'folder';
type ForgeBackupStorageModule = {
  isICloudAvailableAsync(): Promise<boolean>;
  pickFolderAsync(): Promise<string | null>;
  folderNameAsync(): Promise<string | null>;
  clearFolderAsync(): Promise<void>;
  listAsync(root: Root, directory: string): Promise<string[]>;
  readAsync(root: Root, path: string): Promise<string>;
  writeAsync(root: Root, path: string, text: string): Promise<void>;
  removeAsync(root: Root, path: string): Promise<void>;
  readExternalTextAsync(uri: string): Promise<string>;
  uploadStateAsync(root: Root, path: string): Promise<'uploaded' | 'pending' | 'no-space' | 'error'>;
};

/** The iOS module; null on Android, web, Expo Go and builds without it. */
function native(): ForgeBackupStorageModule | null {
  return Platform.OS === 'ios' ? requireOptionalNativeModule<ForgeBackupStorageModule>('ForgeBackupStorage') : null;
}

function nativeFiles(module: ForgeBackupStorageModule, root: Root): SnapshotFiles {
  return {
    list: (directory) => module.listAsync(root, directory),
    read: (path) => module.readAsync(root, path),
    write: (path, text) => module.writeAsync(root, path, text),
    remove: (path) => module.removeAsync(root, path),
  };
}

/** True only on a signed iOS build with iCloud Drive on for this Apple account. */
export async function isICloudAvailable(): Promise<boolean> {
  const module = native();
  if (!module) return false;
  try {
    return await module.isICloudAvailableAsync();
  } catch {
    return false;
  }
}

export function iCloudFiles(): SnapshotFiles | null {
  const module = native();
  return module ? nativeFiles(module, 'icloud') : null;
}

/**
 * A backup folder outside the app (iOS Files, Android storage), so deleting
 * Forge keeps the backups. iOS keeps a bookmark natively; Android keeps the
 * granted folder URI, which Forge stores in its backup state.
 */
export type BackupFolder = { name: string; uri?: string };

export const backupFolderSupported = (): boolean => Platform.OS === 'android' || native() !== null;

/** Opens the system folder picker. Null when the person cancels. */
export async function pickBackupFolder(): Promise<BackupFolder | null> {
  const module = native();
  if (module) {
    const name = await module.pickFolderAsync();
    return name ? { name } : null;
  }
  if (Platform.OS !== 'android') return null;
  try {
    const directory = await Directory.pickDirectoryAsync();
    return { name: safName(directory.uri), uri: directory.uri };
  } catch (error) {
    if (error instanceof Error && /cancel/i.test(error.message)) return null;
    throw error;
  }
}

export async function forgetBackupFolder(): Promise<void> {
  await native()?.clearFolderAsync();
}

/** The folder's files, or null when no folder is chosen. Errors surface on use. */
export function backupFolderFiles(folder: BackupFolder | undefined): SnapshotFiles | null {
  if (!folder) return null;
  const module = native();
  if (module) return nativeFiles(module, 'folder');
  return folder.uri ? safFiles(folder.uri) : null;
}

/** Whether the chosen folder is still reachable (not deleted, access not revoked). */
export async function backupFolderReachable(folder: BackupFolder | undefined): Promise<boolean> {
  if (!folder) return false;
  try {
    const module = native();
    if (module) return (await module.folderNameAsync()) !== null;
    return Boolean(folder.uri && new Directory(folder.uri).exists);
  } catch {
    return false;
  }
}

// Android Storage Access Framework. Document URIs carry the path encoded in one
// segment ("…/document/primary%3ADocuments%2FForge"), so names come from the
// decoded tail, and children are found by listing their parent.

const SUBFOLDER = 'Forge Backups';


function child(directory: Directory, name: string): Directory | File | undefined {
  return directory.list().find((entry) => safName(entry.uri) === name);
}

function safFiles(rootUri: string): SnapshotFiles {
  const base = (): Directory => {
    const root = new Directory(rootUri);
    if (safName(rootUri) === SUBFOLDER) return root;
    const existing = child(root, SUBFOLDER);
    return existing instanceof Directory ? existing : root.createDirectory(SUBFOLDER);
  };
  const folder = (parts: string[], create: boolean): Directory | null => {
    let current = base();
    for (const part of parts) {
      const next = child(current, part);
      if (next instanceof Directory) current = next;
      else if (create) current = current.createDirectory(part);
      else return null;
    }
    return current;
  };
  const split = (path: string) => {
    const parts = path.split('/').filter(Boolean);
    return { parents: parts.slice(0, -1), name: parts[parts.length - 1] ?? '' };
  };
  return {
    async list(directory) {
      const target = folder(directory.split('/').filter(Boolean), false);
      return target ? target.list().map((entry) => safName(entry.uri)) : [];
    },
    async read(path) {
      const { parents, name } = split(path);
      const file = folder(parents, false) && child(folder(parents, false) as Directory, name);
      if (!(file instanceof File)) throw new Error(`not-downloaded: ${path} is missing from the backup folder.`);
      return file.text();
    },
    async write(path, text) {
      const { parents, name } = split(path);
      const parent = folder(parents, true) as Directory;
      const existing = child(parent, name);
      if (existing) existing.delete();
      parent.createFile(name, 'application/json').write(text);
    },
    async remove(path) {
      const { parents, name } = split(path);
      const parent = folder(parents, false);
      const existing = parent ? child(parent, name) : undefined;
      if (existing) existing.delete();
    },
  };
}

/** Whether iCloud has uploaded a mirrored file yet (writes succeed locally even when iCloud is full). */
export async function iCloudUploadState(path: string): Promise<'uploaded' | 'pending' | 'no-space' | 'error' | 'unavailable'> {
  const module = native();
  if (!module) return 'unavailable';
  try {
    return await module.uploadStateAsync('icloud', path);
  } catch {
    return 'error';
  }
}

/** Reads a file another app opened in place in Forge (iOS); null when the module is missing. */
export async function readExternalText(uri: string): Promise<string | null> {
  const module = native();
  return module ? module.readExternalTextAsync(uri) : null;
}
