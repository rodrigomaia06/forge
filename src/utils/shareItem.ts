import { Alert } from 'react-native';
import { shareScopedItem, type ShareScope } from '../data/scopedTransfer';

/**
 * Fire-and-forget share of a single item via the OS share sheet. Surfaces a
 * plain alert if sharing is unavailable or the item vanished; a user dismissing
 * the share sheet resolves normally and shows nothing.
 */
export function shareItem(scope: ShareScope): void {
  void shareScopedItem(scope).catch((error) => {
    const message = error instanceof Error ? error.message : '';
    Alert.alert('Could not share', message || 'Sharing is not available on this device.');
  });
}
