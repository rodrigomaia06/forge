import { Platform } from 'react-native';
import { isLoaded } from 'expo-font';
import { resolveManropeFamilies } from './fontFamilies';

const resolved = resolveManropeFamilies(Platform.OS, isLoaded);
export const embeddedFontsReady = resolved.embedded;
// Expo Go and builds predating font embedding retain the runtime aliases.
export const typography = resolved.families;
