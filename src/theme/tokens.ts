import type { TextStyle } from 'react-native';
import type { ForgeTheme } from '../types';
import { moderateScale } from './scale';

// Round to a whole pixel so scaled type/spacing never land on fractional dp.
const scaleTextStyle = <T extends TextStyle>(style: T): T => ({
  ...style,
  ...(typeof style.fontSize === 'number' ? { fontSize: Math.round(moderateScale(style.fontSize)) } : {}),
  ...(typeof style.lineHeight === 'number' ? { lineHeight: Math.round(moderateScale(style.lineHeight)) } : {}),
  ...(typeof style.letterSpacing === 'number' ? { letterSpacing: moderateScale(style.letterSpacing) } : {}),
});

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
  // Light elevation ramp (mirrors Dark's distinct tone steps so borderless surfaces
  // separate by tone, not outlines): page < base surface < elevated. Sheets are painted
  // the base `surface`, so elevated controls/nested cards (surfaceElevated = white) pop
  // on them and on the darker header.
  background: '#E3E4E1',
  header: '#E3E4E1',
  surface: '#F4F5F2',
  surfaceElevated: '#FFFFFF',
  surfaceInset: '#DEDFDC',
  input: '#E8E9E6',
  dock: '#FAFAF8',
  overlay: 'rgba(23,25,28,0.24)',
  // The raised-control / selection / nested tone. Deepened from #E8E9E6 so a
  // borderless tonal control reads on the base surface and on white cards
  // (the old value sat within ~5 of the page tones and vanished).
  surfaceMuted: '#DEDFDB',
  ink: '#17191C',
  textPrimary: '#17191C',
  textSecondary: '#55585C',
  textDisabled: '#A0A3A4',
  textDestructive: '#D64848',
  destructiveSurface: '#F6DCDD',
  destructiveSurfacePressed: '#E9AEB2',
  slate: '#55585C',
  muted: '#8A969E',
  // Divider stays a hairline tone for row separators; `border` is deepened so the
  // few elements that keep an outline (search/text fields) actually show one on light.
  divider: '#E2E3E0',
  border: '#CDCFC9',
  pressed: 'rgba(23,25,28,0.08)',
  focus: '#1D252D',
  shadow: '#17191C',
  ...shared,
  // The shared default is white (for dark chips); in light the next-session target dot
  // needs a dark tone to read on the light set-number chip. (After the 2nd `...shared`.)
  setTargetIndicator: '#55585C',
  calendarDay: '#FFFFFF',
  calendarSelectionRing: '#1D252D',
  selected: '#1D252D',
  selectedText: '#FFFFFF',
  calendarWorkoutDay: 'rgba(31,41,50,0.07)',
  calendarWorkoutBorder: 'rgba(31,41,50,0.1)',
  cardShadowOpacity: 0.08,
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
  screen: Math.round(moderateScale(20)),
  section: Math.round(moderateScale(28)),
};

export const typography = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

/** Forge's semantic type scale. Use these roles instead of raw text metrics. */
const baseTypeScale = {
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

export type ForgeTextRole = keyof typeof baseTypeScale;

// The exported scale is the base metrics run through the responsive UI scale, so
// every `typeScale.role` consumer tightens on smaller canvases automatically.
export const typeScale = Object.fromEntries(
  Object.entries(baseTypeScale).map(([role, style]) => [role, scaleTextStyle(style)]),
) as typeof baseTypeScale;

export const maxFontSizeMultiplier = 1.5;
