import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppStateKey } from './appStateMigration';
import { queueWebWrite } from './webWriteQueue';
export { appStateKeys } from './appStateMigration';

export function loadAppState(key: AppStateKey): Promise<string | null> {
  return queueWebWrite(() => AsyncStorage.getItem(key));
}
export function updateAppState(
  key: AppStateKey,
  update: (current: string | null) => string | null,
): Promise<void> {
  return queueWebWrite(async () => {
    const value = update(await AsyncStorage.getItem(key));
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  });
}
export function saveAppState(key: AppStateKey, value: string | null): Promise<void> {
  return updateAppState(key, () => value);
}
