const runtimeFamilies = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};
const iosFamilies = {
  regular: 'Manrope-Regular',
  medium: 'Manrope-Medium',
  semibold: 'Manrope-SemiBold',
  bold: 'Manrope-Bold',
};

export function resolveManropeFamilies(platform: string, isLoaded: (family: string) => boolean) {
  const nativeFamilies = platform === 'ios' ? iosFamilies : runtimeFamilies;
  const embedded = platform !== 'web' && Object.values(nativeFamilies).every(isLoaded);
  return { embedded, families: embedded ? nativeFamilies : runtimeFamilies };
}
