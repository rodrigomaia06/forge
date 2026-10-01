import type { TextStyle } from 'react-native';
import type { ForgeTheme } from '../types';

const shared = {
  actionPrimary: '#1D252D',
  onActionPrimary: '#FFFFFF',
  setTargetIndicator: '#FFFFFF',
  selectionIndicator: '#1D252D',
  success: '#4D7B67',
  onSuccess: '#FFFFFF',
  successSurface: '#E3EEE8',
  successSurfacePressed: '#D5E5DB',
  marker: '#4D7B67',
  cardRadius: 24,
  topBar: true as const,
  headerVariant: 'greeting' as const,
  startButtonVariant: 'outline-compact',
  summaryGradientStart: '#F8F8F6',
  summaryGradientEnd: '#ECEDEB',
  summaryBorder: '#E2E3E0',
  summaryGlow: '#FFFFFF',
};

export const lightTheme: ForgeTheme = {
  ...shared,
  colorScheme: 'light',
  background: '#E8E8E8',
  header: '#E8E8E8',
  surface: '#F8F8F6',
  surfaceElevated: '#F8F8F6',
  surfaceInset: '#E7E8E5',
  input: '#F8F8F6',
  dock: '#FAFAF8',
  overlay: 'rgba(23,25,28,0.24)',
  surfaceMuted: '#ECEDEB',
  ink: '#17191C',
  textPrimary: '#17191C',
  textSecondary: '#55585C',
  textDisabled: '#A0A3A4',
  textDestructive: '#D64848',
  destructiveSurface: '#F6DCDD',
  destructiveSurfacePressed: '#E9AEB2',
  slate: '#55585C',
  muted: '#8A969E',
  divider: '#E2E3E0',
  border: '#E2E3E0',
  pressed: 'rgba(23,25,28,0.08)',
  focus: '#1D252D',
  shadow: '#17191C',
  ...shared,
  calendarDay: '#FFFFFF',
  calendarSelectionRing: '#1D252D',
  selected: '#1D252D',
  selectedText: '#FFFFFF',
  calendarWorkoutDay: 'rgba(31,41,50,0.07)',
  calendarWorkoutBorder: 'rgba(31,41,50,0.1)',
  cardShadowOpacity: 0.06,
  dockSelected: '#1D252D',
  dockForeground: '#FFFFFF',
  dockMuted: '#687078',
};

export const darkTheme: ForgeTheme = {
  ...shared,
  colorScheme: 'dark',
  actionPrimary: '#F5F7F8',
  onActionPrimary: '#172431',
  selectionIndicator: '#F5F7F8',
  success: '#6F9E87',
  onSuccess: '#172431',
  successSurface: '#293B32',
  successSurfacePressed: '#334B3E',
  background: '#0A0B0D',
  header: '#0A0B0D',
  surface: '#16181B',
  surfaceElevated: '#1F2225',
  surfaceInset: '#2A2E32',
  input: '#202226',
  dock: '#17191C',
  overlay: 'rgba(0,0,0,0.58)',
  surfaceMuted: '#2B2F34',
  ink: '#F7F8F6',
  textPrimary: '#F7F8F6',
  textSecondary: '#C3C8CC',
  textDisabled: '#707980',
  textDestructive: '#FF8A8A',
  destructiveSurface: '#4A2B2D',
  destructiveSurfacePressed: '#6E3E42',
  slate: '#C3C8CC',
  muted: '#929AA1',
  divider: '#3A4046',
  border: '#464D54',
  pressed: 'rgba(247,248,246,0.10)',
  focus: '#F5F7F8',
  shadow: '#000000',
  calendarSurface: '#16181B',
  calendarDay: 'rgba(255,255,255,0.08)',
  calendarSelectionRing: 'rgba(245,247,248,0.62)',
  selected: '#2A2E32',
  selectedText: '#F7F8F6',
  calendarWorkoutDay: '#24272B',
  calendarWorkoutBorder: '#464D54',
  cardShadowOpacity: 0,
  navigation: '#0F1113',
  dockSurface: '#17191C',
  dockSelected: 'rgba(247,248,246,0.20)',
  dockBorder: '#3A4046',
  dockForeground: '#F7F8F6',
  dockMuted: 'rgba(247,248,246,0.65)',
  summaryGradientStart: '#1F2225',
  summaryGradientEnd: '#16181B',
  summaryBorder: '#464D54',
  summaryGlow: '#F5F7F8',
};

/** Backwards-compatible light default for components that are not migrated yet. */
export const colors = lightTheme;

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
    // Headroom for the bold ascenders: a tighter line height clips the glyph
    // tops once Android's includeFontPadding is off (and on web), so keep it
    // comfortably above the font's own box.
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  headerTitle: { fontFamily: typography.semibold, fontSize: 23, lineHeight: 28, fontWeight: '600' },
  sectionTitle: {
    fontFamily: typography.semibold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  },
  cardTitle: { fontFamily: typography.semibold, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontFamily: typography.regular, fontSize: 15, lineHeight: 22 },
  controlLabel: { fontFamily: typography.medium, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  supporting: { fontFamily: typography.medium, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: typography.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: typography.medium, fontSize: 12, lineHeight: 16 },
  metricLarge: { fontFamily: typography.bold, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  metricMedium: {
    fontFamily: typography.semibold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
  },
} as const satisfies Record<string, TextStyle>;

export type ForgeTextRole = keyof typeof typeScale;
export const maxFontSizeMultiplier = 1.5;
