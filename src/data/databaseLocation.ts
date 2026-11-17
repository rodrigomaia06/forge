import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

const NAME = 'forge.db';
const FILES = [NAME, `${NAME}-wal`, `${NAME}-shm`];

/**
 * On iPhone the app's Documents folder is visible in Files as On My iPhone ›
 * Forge, where the backups live. The live database must not sit there, where
 * it could be deleted or edited by hand, so it lives in Library/Application
 * Support/Forge, which Files never shows (and device backups still include).
 *
 * Older installs kept it in Documents/SQLite (expo-sqlite's default). It moves
 * once, before the database is opened: the files are copied into a staging
 * folder, which is then renamed into place in one step, and only then are the
 * originals removed. An interrupted move leaves the originals in charge and is
 * retried on the next launch.
 *
 * Returns the directory to open the database in, or undefined for the default.
 */
export function forgeDatabaseDirectory(): string | undefined {
  if (Platform.OS !== 'ios') return undefined;
  let target: Directory;
  try {
    const support = new Directory(Paths.cache.parentDirectory, 'Application Support');
    target = new Directory(support, 'Forge');
    const legacy = new Directory(Paths.document, 'SQLite');
    if (!target.exists) {
      const staging = new Directory(support, 'Forge.moving');
      if (staging.exists) staging.delete();
      staging.create({ intermediates: true });
      for (const name of FILES) {
        const source = new File(legacy, name);
        if (source.exists) source.copySync(new File(staging, name));
      }
      staging.rename('Forge');
    }
    target = new Directory(support, 'Forge');
    if (!target.exists) return undefined;
  } catch {
    // Keep using the original location; the move is retried next launch.
    return undefined;
  }
  try {
    const legacy = new Directory(Paths.document, 'SQLite');
    for (const name of FILES) {
      const source = new File(legacy, name);
      if (source.exists) source.delete();
    }
    if (legacy.exists && legacy.list().length === 0) legacy.delete();
  } catch {
    /* Leftover originals are harmless and are removed on a later launch. */
  }
  return target.uri;
}
