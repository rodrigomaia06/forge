import type { TextStyle } from 'react-native';
import type { ForgeTheme } from '../types';

const shared = {
  accent: '#1D252D',
  inkInteractive: '#284C68',
  success: '#4D7B67',
  onSuccess: '#FFFFFF',
  marker: '#4D7B67',
  iconCalendar: '#4F6B5B',
  iconStrength: '#6F7FF2',
  iconSport: '#62C98A',
  iconActivity: '#E99A5B',
  iconTime: '#5F7770',
  cardRadius: 24,
  topBar: true as const,
  headerVariant: 'greeting' as const,
  startButtonVariant: 'outline-compact',
  summaryGradientStart: '#F0EEFF',
  summaryGradientEnd: '#E4E2FF',
  summaryBorder: '#DAD7F8',
  summaryGlow: '#FFFFFF',
  workoutType: {
    strength: '#6F7FF2',
    mobility: '#62C98A',
    cardio: '#EF715F',
    sport: '#E99A5B',
    activity: '#B78AF0',
  },
};

export const lightTheme: ForgeTheme = {
  ...shared,
  background: '#E8E8E8',
  header: '#E8E8E8',
  surface: '#F8F8F6',
  surfaceElevated: '#F8F8F6',
  input: '#F8F8F6',
  dock: '#FAFAF8',
  overlay: 'rgba(23,25,28,0.24)',
  surfaceMuted: '#ECEDEB',
  ink: '#17191C',
  textPrimary: '#17191C',
  primaryText: '#FFFFFF',
  textSecondary: '#55585C',
  textDisabled: '#A0A3A4',
  textDestructive: '#D64848',
  destructiveSurface: '#F6DCDD',
  destructiveSurfacePressed: '#F1CED0',
  slate: '#55585C',
  muted: '#8A969E',
  divider: '#E2E3E0',
  border: '#E2E3E0',
  pressed: 'rgba(23,25,28,0.08)',
  focus: '#6F7FF2',
  shadow: '#17191C',
  ...shared,
  calendarDay: '#FFFFFF',
  calendarWorkoutDay: 'rgba(31,41,50,0.07)',
  calendarWorkoutBorder: 'rgba(31,41,50,0.1)',
  cardShadowOpacity: 0.06,
  dockSelected: '#1D252D',
  dockForeground: '#FFFFFF',
  dockMuted: '#687078',
};

export const darkTheme: ForgeTheme = {
  ...shared,
  accent: '#7C8CF8',
  inkInteractive: '#9CA7FF',
  success: '#6F9E87',
  onSuccess: '#172431',
  background: '#17191C',
  header: '#17191C',
  surface: '#22262A',
  surfaceElevated: '#2A2F34',
  input: '#30363B',
  dock: '#252A2E',
  overlay: 'rgba(0,0,0,0.58)',
  surfaceMuted: '#30363B',
  ink: '#F7F8F6',
  textPrimary: '#F7F8F6',
  primaryText: '#172431',
  textSecondary: '#C3C8CC',
  textDisabled: '#707980',
  textDestructive: '#FF8A8A',
  destructiveSurface: '#4A2B2D',
  destructiveSurfacePressed: '#5D3336',
  slate: '#C3C8CC',
  muted: '#929AA1',
  divider: '#3A4046',
  border: '#464D54',
  pressed: 'rgba(247,248,246,0.10)',
  focus: '#9CA7FF',
  shadow: '#000000',
  calendarSurface: '#202428',
  calendarDay: 'rgba(255,255,255,0.08)',
  selected: '#F5F7F8',
  selectedText: '#172431',
  calendarWorkoutDay: '#30363B',
  calendarWorkoutBorder: '#464D54',
  cardShadowOpacity: 0,
  navigation: '#1C2024',
  dockSurface: '#252A2E',
  dockSelected: 'rgba(247,248,246,0.20)',
  dockBorder: '#3A4046',
  dockForeground: '#F7F8F6',
  dockMuted: 'rgba(247,248,246,0.65)',
  summaryGradientStart: '#302D4D',
  summaryGradientEnd: '#292743',
  summaryBorder: '#514C76',
  summaryGlow: '#343150',
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
    lineHeight: 36,
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
