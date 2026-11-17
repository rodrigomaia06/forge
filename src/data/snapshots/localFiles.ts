import { Directory, File, Paths } from 'expo-file-system';
import type { SnapshotFiles } from './snapshotCore';

/** Snapshots on the phone live in the app's documents folder, which iOS also includes in device backups. */
const ROOT = 'forge-backups';

function parts(path: string): string[] {
  return [ROOT, ...path.split('/').filter(Boolean)];
}

export function localFiles(): SnapshotFiles {
  return {
    async list(directory) {
      const folder = new Directory(Paths.document, ...parts(directory));
      if (!folder.exists) return [];
      return folder.list().map((entry) => entry.name);
    },
    async read(path) {
      return new File(Paths.document, ...parts(path)).text();
    },
    async write(path, text) {
      const target = new File(Paths.document, ...parts(path));
      // Write a sibling first and move it into place, so a crash never leaves a half-written file.
      const temporary = new File(Paths.document, ...parts(`${path}.partial`));
      if (temporary.exists) temporary.delete();
      temporary.create({ intermediates: true });
      temporary.write(text);
      if (target.exists) target.delete();
      await temporary.move(target);
    },
    async remove(path) {
      const file = new File(Paths.document, ...parts(path));
      if (file.exists) file.delete();
    },
  };
}

/** Bytes used on the phone, for the Backups status line. */
export function localBackupSize(): number {
  const folder = new Directory(Paths.document, ROOT);
  return folder.exists ? (folder.size ?? 0) : 0;
}

/** Removes the in-app backups once they have been moved to the backup folder. */
export function clearAppBackups(): void {
  const folder = new Directory(Paths.document, ROOT);
  if (folder.exists) folder.delete();
}
