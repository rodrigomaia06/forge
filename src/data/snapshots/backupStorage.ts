import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { safName, type SnapshotFiles } from './snapshotCore';

type Root = 'icloud' | 'folder';
type UploadState = 'uploaded' | 'pending' | 'no-space' | 'error';
type ForgeBackupStorageModule = {
  isICloudAvailableAsync(): Promise<boolean>;
  pickFolderAsync(): Promise<string | null>;
  folderNameAsync(): Promise<string | null>;
  clearFolderAsync(): Promise<void>;
  listAsync(root: Root, directory: string): Promise<string[]>;
  readAsync(root: Root, path: string): Promise<string>;
  writeAsync(root: Root, path: string, text: string): Promise<void>;
  removeAsync(root: Root, path: string): Promise<void>;
  importFileAsync(root: Root, path: string, sourceUri: string): Promise<void>;
  exportFileAsync(root: Root, path: string, destinationUri: string): Promise<void>;
  readExternalTextAsync(uri: string): Promise<string>;
  uploadStateAsync(root: Root, path: string): Promise<UploadState>;
};

/** The iOS module; null on Android, web, Expo Go and builds without it. */
function native(): ForgeBackupStorageModule | null {
  return Platform.OS === 'ios' ? requireOptionalNativeModule<ForgeBackupStorageModule>('ForgeBackupStorage') : null;
}

// iCloud: the incremental snapshot store (text objects and manifests).

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
  if (!module) return null;
  return {
    list: (directory) => module.listAsync('icloud', directory),
    read: (path) => module.readAsync('icloud', path),
    write: (path, text) => module.writeAsync('icloud', path, text),
    remove: (path) => module.removeAsync('icloud', path),
  };
}

/** Whether iCloud has uploaded a mirrored file yet (writes succeed locally even when iCloud is full). */
export async function iCloudUploadState(path: string): Promise<UploadState | 'unavailable'> {
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

// Phone backups: complete `.sqlite` files, one per backup.

/** Where the phone's backup files live; every operation is by file name. */
export interface BackupFileStore {
  /** File names in the folder (Forge's and anything else the person put there). */
  list(): Promise<string[]>;
  /** Copies a local file into the folder under `name`, replacing one with that name. */
  save(name: string, source: File): Promise<void>;
  /** A readable local copy of the named file. */
  fetch(name: string): Promise<File>;
  remove(name: string): Promise<void>;
}

const cacheCopy = () => new File(Paths.cache, `forge-backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`);

/**
 * Forge's own folder: `Documents/Backups`. On iPhone, Files shows Documents as
 * On My iPhone › Forge (with the Forge icon); iOS deletes it with the app.
 */
export function appBackupFiles(): BackupFileStore {
  const folder = () => new Directory(Paths.document, 'Backups');
  return {
    async list() {
      const directory = folder();
      if (!directory.exists) return [];
      // An earlier build kept an incremental store here; it is replaced by plain files.
      for (const entry of directory.list()) if (entry instanceof Directory) entry.delete();
      return directory.list().map((entry) => entry.name);
    },
    async save(name, source) {
      const directory = folder();
      if (!directory.exists) directory.create({ intermediates: true });
      const target = new File(directory, name);
      if (target.exists) target.delete();
      source.copySync(target);
    },
    async fetch(name) {
      return new File(folder(), name);
    },
    async remove(name) {
      const file = new File(folder(), name);
      if (file.exists) file.delete();
    },
  };
}

/**
 * A folder outside the app that survives deleting Forge. iOS keeps a bookmark
 * natively; Android keeps the granted folder URI, stored in the backup state.
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

/** The chosen folder's files, or null when none is chosen. Errors surface on use. */
export function folderBackupFiles(folder: BackupFolder | undefined): BackupFileStore | null {
  if (!folder) return null;
  const module = native();
  if (module) {
    return {
      list: () => module.listAsync('folder', ''),
      save: (name, source) => module.importFileAsync('folder', name, source.uri),
      async fetch(name) {
        const copy = cacheCopy();
        await module.exportFileAsync('folder', name, copy.uri);
        return copy;
      },
      remove: (name) => module.removeAsync('folder', name),
    };
  }
  return folder.uri ? safBackupFiles(folder.uri) : null;
}

// Android Storage Access Framework. Document URIs carry the path encoded in one
// segment ("…/document/primary%3ADocuments%2FForge"), so names come from the
// decoded tail, and children are found by listing their parent.

const SUBFOLDER = 'Forge Backups';

function child(directory: Directory, name: string): Directory | File | undefined {
  return directory.list().find((entry) => safName(entry.uri) === name);
}

function safBackupFiles(rootUri: string): BackupFileStore {
  const base = (): Directory => {
    const root = new Directory(rootUri);
    if (safName(rootUri) === SUBFOLDER) return root;
    const existing = child(root, SUBFOLDER);
    return existing instanceof Directory ? existing : root.createDirectory(SUBFOLDER);
  };
  return {
    async list() {
      return base().list().filter((entry) => entry instanceof File).map((entry) => safName(entry.uri));
    },
    async save(name, source) {
      const directory = base();
      child(directory, name)?.delete();
      // octet-stream keeps the provider from appending its own extension.
      directory.createFile(name, 'application/octet-stream').write(await source.bytes());
    },
    async fetch(name) {
      const file = child(base(), name);
      if (!(file instanceof File)) throw new Error('This backup is no longer in the backup folder.');
      const copy = cacheCopy();
      await copyAsync({ from: file.uri, to: copy.uri });
      return copy;
    },
    async remove(name) {
      child(base(), name)?.delete();
    },
  };
}
