import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { ForgeText as Text } from './ui/ForgeText';
import { useForgeTheme } from '../theme/ThemeProvider';
import { useThemedStyles } from '../theme/useThemedStyles';
import { typeScale } from '../theme/tokens';
import type { ForgeTheme } from '../types';

/**
 * Shared empty-state scaffold: a small on-brand line illustration over a title,
 * optional subtitle, and an optional action. Used across Plans, History, and the
 * Dashboard so every empty screen reads the same.
 */
export function EmptyState({
  illustration,
  title,
  subtitle,
  action,
  testID,
  illustrationTestID,
  style,
}: {
  illustration: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  testID?: string;
  illustrationTestID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.art} testID={illustrationTestID}>{illustration}</View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

type ArtColors = { line: string; fill: string; accent: string; onAccent: string };

function useArtColors(): ArtColors {
  const theme = useForgeTheme();
  return {
    line: theme.slate,
    fill: theme.surfaceMuted,
    accent: theme.ink,
    onAccent: theme.onActionPrimary,
  };
}

/** Stacked routine cards with a checklist — "build a routine/plan". */
export function PlansArt() {
  const { line, fill, accent } = useArtColors();
  return (
    <Svg width={150} height={112} viewBox="0 0 150 112" fill="none">
      <Rect x={42} y={12} width={84} height={66} rx={12} stroke={line} strokeWidth={2} opacity={0.45} />
      <Rect x={20} y={26} width={96} height={74} rx={14} fill={fill} stroke={line} strokeWidth={2} />
      <Circle cx={40} cy={49} r={5} fill={accent} />
      <Line x1={54} y1={49} x2={98} y2={49} stroke={line} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={40} cy={66} r={5} stroke={line} strokeWidth={2} />
      <Line x1={54} y1={66} x2={98} y2={66} stroke={line} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={40} cy={83} r={5} stroke={line} strokeWidth={2} />
      <Line x1={54} y1={83} x2={86} y2={83} stroke={line} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** A timeline of logged sessions — past workout history. */
export function HistoryArt() {
  const { line, fill, accent } = useArtColors();
  return (
    <Svg width={150} height={112} viewBox="0 0 150 112" fill="none">
      <Line x1={40} y1={30} x2={40} y2={82} stroke={line} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={40} cy={30} r={6} fill={accent} />
      <Circle cx={40} cy={56} r={6} fill={fill} stroke={line} strokeWidth={2} />
      <Circle cx={40} cy={82} r={6} fill={fill} stroke={line} strokeWidth={2} />
      <Rect x={58} y={22} width={72} height={16} rx={6} fill={fill} stroke={line} strokeWidth={2} />
      <Rect x={58} y={48} width={72} height={16} rx={6} fill={fill} stroke={line} strokeWidth={2} />
      <Rect x={58} y={74} width={72} height={16} rx={6} fill={fill} stroke={line} strokeWidth={2} />
    </Svg>
  );
}

/** A widget grid with one active tile — "build your dashboard". */
export function DashboardArt() {
  const { line, fill, accent, onAccent } = useArtColors();
  return (
    <Svg width={150} height={112} viewBox="0 0 150 112" fill="none">
      <Rect x={29} y={20} width={44} height={34} rx={9} fill={accent} stroke={accent} strokeWidth={2} />
      <Path d="M37 45 L45 37 L51 41 L61 31" stroke={onAccent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={81} y={20} width={44} height={34} rx={9} fill={fill} stroke={line} strokeWidth={2} />
      <Rect x={29} y={62} width={44} height={34} rx={9} fill={fill} stroke={line} strokeWidth={2} />
      <Rect x={81} y={62} width={44} height={34} rx={9} fill={fill} stroke={line} strokeWidth={2} />
    </Svg>
  );
}

const createStyles = (theme: ForgeTheme) =>
  StyleSheet.create({
    container: { alignItems: 'center', paddingHorizontal: 28, gap: 8 },
    art: { marginBottom: 10 },
    title: { ...typeScale.sectionTitle, color: theme.ink, textAlign: 'center' },
    subtitle: { ...typeScale.body, color: theme.slate, textAlign: 'center', maxWidth: 300 },
    action: { marginTop: 10 },
  });
