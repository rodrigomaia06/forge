import type { TextStyle } from 'react-native';
import type { ForgeTheme } from '../types';

export const colors: ForgeTheme = {
  background: '#F6F7F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F3',
  ink: '#172431',
  inkInteractive: '#284C68',
  slate: '#62717D',
  muted: '#8A969E',
  divider: '#DCE2E6',
  success: '#39745E',
};

export const radii = {
  control: 12,
  iconButton: 14,
  selectedDay: 13,
  secondaryAction: 10,
};

export const spacing = {
  screen: 20,
  section: 28,
};

export const typography = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

/** Forge's semantic type scale. Use these roles instead of raw text metrics. */
export const typeScale = {
  display: { fontFamily: typography.bold, fontSize: 32, lineHeight: 38, fontWeight: '700' },
  screenTitle: {
    fontFamily: typography.bold,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  headerTitle: { fontFamily: typography.semibold, fontSize: 23, lineHeight: 28, fontWeight: '600' },
  sectionTitle: { fontFamily: typography.semibold, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  cardTitle: { fontFamily: typography.semibold, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontFamily: typography.regular, fontSize: 15, lineHeight: 22 },
  controlLabel: { fontFamily: typography.medium, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  supporting: { fontFamily: typography.medium, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: typography.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: typography.medium, fontSize: 12, lineHeight: 16 },
  metricLarge: { fontFamily: typography.bold, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  metricMedium: { fontFamily: typography.semibold, fontSize: 22, lineHeight: 28, fontWeight: '600' },
} as const satisfies Record<string, TextStyle>;

export type ForgeTextRole = keyof typeof typeScale;
export const maxFontSizeMultiplier = 1.5;
