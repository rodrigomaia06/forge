import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from './ui';
import { typography, spacing } from '../theme/tokens';
import type { ForgeTheme, IconName, IconWeight } from '../types';

export const HEADER_VARIANTS = {
  greeting: 'greeting',
  archive: 'archive',
  month: 'month',
} as const;
type HeaderVariant = (typeof HEADER_VARIANTS)[keyof typeof HEADER_VARIANTS];

interface DashboardHeaderProps {
  theme: ForgeTheme;
  variant?: HeaderVariant;
  style?: StyleProp<ViewStyle>;
  onStart: () => void;
}
export function DashboardHeader({
  theme,
  variant = HEADER_VARIANTS.greeting,
  style,
  onStart,
}: DashboardHeaderProps) {
  const content = getHeaderContent(variant);
  const action = getHeaderAction(theme.startButtonVariant);

  return (
    <View
      testID="dashboard-header"
      style={[styles.container, { backgroundColor: theme.background }, style]}
    >
      <View testID={`dashboard-header-${variant}`} style={styles.copy}>
        <Text
          testID="dashboard-header-title"
          numberOfLines={1}
          style={[styles.title, { color: theme.ink }]}
        >
          {content.title}
        </Text>
        {content.subtitle && (
          <Text style={[styles.subtitle, { color: theme.slate }]}>{content.subtitle}</Text>
        )}
      </View>
      <View style={styles.actions}>
        <Button
          accessibilityLabel={action.accessibilityLabel}
          icon={action.icon}
          iconSize={action.iconSize}
          iconWeight={action.iconWeight}
          variant="secondary"
          onPress={onStart}
          style={styles.headerIconButton}
          theme={theme}
        />
      </View>
    </View>
  );
}

function getHeaderContent(variant: HeaderVariant): { title: string; subtitle?: string } {
  if (variant === HEADER_VARIANTS.archive) {
    return { title: 'Dashboard' };
  }

  if (variant === HEADER_VARIANTS.month) {
    return { title: 'August 2026', subtitle: '7 workout days · 8 workouts' };
  }

  return { title: getDashboardGreeting() };
}

function getHeaderAction(_variant?: string): {
  accessibilityLabel: string;
  icon: IconName;
  iconSize: number;
  iconWeight: IconWeight;
} {
  return {
    accessibilityLabel: 'Start workout',
    icon: 'add',
    iconSize: 22,
    iconWeight: 'regular',
  };
}

function getDashboardGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  container: {
    height: 78,
    flexShrink: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 16 },
  title: {
    fontFamily: typography.bold,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -1,
    textShadowColor: 'rgba(23, 36, 49, 0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  subtitle: { fontFamily: typography.medium, fontSize: 13, lineHeight: 17, marginTop: 2 },
  headerIconButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    minHeight: 46,
    paddingHorizontal: 0,
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.68)',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  outlinePillButton: { borderRadius: 1000 },
  outlineRoundedButton: { borderRadius: 15 },
  outlineCompactButton: { width: 46, height: 46, minWidth: 46, minHeight: 46, borderRadius: 13 },
  outlineSoftButton: { borderRadius: 19 },
  outlineWideButton: { width: 58, height: 50, minWidth: 58, borderRadius: 15 },
});
