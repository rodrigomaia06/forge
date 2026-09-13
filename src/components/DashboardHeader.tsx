import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ForgeText as Text, HeaderAction, ScreenTitle } from './ui';
import { spacing, typeScale } from '../theme/tokens';
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
        <ScreenTitle testID="dashboard-header-title" numberOfLines={1} color={theme.ink}>
          {content.title}
        </ScreenTitle>
        {content.subtitle && (
          <Text style={[styles.subtitle, { color: theme.slate }]}>{content.subtitle}</Text>
        )}
      </View>
      <View style={styles.actions}>
        <HeaderAction
          accessibilityLabel={action.accessibilityLabel}
          icon={action.icon}
          iconSize={action.iconSize}
          iconWeight={action.iconWeight}
          iconOnly
          onPress={onStart}
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
    height: 70,
    flexShrink: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 16 },
  subtitle: { ...typeScale.label, marginTop: 2 },
  outlinePillButton: { borderRadius: 1000 },
  outlineRoundedButton: { borderRadius: 15 },
  outlineCompactButton: { width: 46, height: 46, minWidth: 46, minHeight: 46, borderRadius: 13 },
  outlineSoftButton: { borderRadius: 19 },
  outlineWideButton: { width: 58, height: 50, minWidth: 58, borderRadius: 15 },
});
