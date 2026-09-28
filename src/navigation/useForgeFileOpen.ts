import { useCallback, useEffect } from 'react';
import { Linking } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import { setPendingFileImport } from '../state/pendingFileImport';

type NavigationRef = NavigationContainerRefWithCurrent<RootStackParamList>;

/**
 * Only file-backed opens are ours to handle. A `forge://` custom-scheme link
 * (e.g. the rest-timer deep link) belongs to React Navigation's linking config,
 * and `http(s)` never routes here — so we act only on `file://` and
 * `content://` URIs. A named `file://` path is additionally gated on the
 * `.forge` extension so an unrelated file open is never hijacked; `content://`
 * providers rarely expose a name, so those are validated on content when read.
 */
function isForgeFileUri(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith('content://')) return true;
  if (url.startsWith('file://')) return /\.forge$/i.test(url.split('?')[0]);
  return false;
}

/**
 * Routes a `.forge` file the OS asked Forge to open into the existing Backup &
 * Export import flow. Cold launches are handled from the container's `onReady`
 * (the initial URL); warm opens arrive through the `url` event while the app is
 * already running. The URI is stashed in `pendingFileImport` for the Backup &
 * Export screen to consume, then that screen is brought to the front.
 */
export function useForgeFileOpen(navigationRef: NavigationRef): { onReady: () => void } {
  const route = useCallback(
    (url: string | null | undefined) => {
      if (!isForgeFileUri(url)) return;
      setPendingFileImport(url);
      if (navigationRef.isReady()) navigationRef.navigate('BackupExport');
    },
    [navigationRef],
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => route(url));
    return () => subscription.remove();
  }, [route]);

  const onReady = useCallback(() => {
    void Linking.getInitialURL().then(route);
  }, [route]);

  return { onReady };
}
