/**
 * Hands the URI of a `.forge` file the OS asked Forge to open (AirDrop, Files,
 * Mail, Drive, an `content://`/`file://` VIEW intent) to the Backup & Export
 * import flow, without routing it through a navigation param that a
 * already-mounted screen would miss.
 *
 * Two delivery paths, because the target screen may or may not be mounted when
 * the file arrives:
 *   - Cold start / first navigation: the screen calls `takePendingFileImport()`
 *     on mount and consumes whatever was stored.
 *   - Warm start while the screen is already mounted: it receives the URI via
 *     `subscribePendingFileImport`.
 *
 * `takePendingFileImport()` clears the value so a single open is never imported
 * twice; a subscriber that handles the URI should therefore not also take it.
 */
type Listener = (uri: string) => void;

let pending: string | null = null;
const listeners = new Set<Listener>();

export function setPendingFileImport(uri: string): void {
  pending = uri;
  for (const listener of listeners) listener(uri);
}

export function takePendingFileImport(): string | null {
  const uri = pending;
  pending = null;
  return uri;
}

export function subscribePendingFileImport(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
