import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ForgeText as Text, HeaderAction, HeaderActionGroup, Icon, joinedHeaderAction, pressedFeedback, ScreenTitle } from './ui';
import { spacing, typeScale } from '../theme/tokens';
import { useForgeReducedMotion } from '../theme/motion';
import type { ForgeTheme } from '../types';

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
  editing?: boolean;
  onToggleEdit?: () => void;
}
export function DashboardHeader({
  theme,
  variant = HEADER_VARIANTS.greeting,
  style,
  onStart,
  editing = false,
  onToggleEdit,
}: DashboardHeaderProps) {
  const content = getHeaderContent(variant);
  const reducedMotion = useForgeReducedMotion();
  const enter = reducedMotion ? undefined : FadeIn.duration(180);
  const exit = reducedMotion ? undefined : FadeOut.duration(140);
  const isDark = theme.colorScheme === 'dark';

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
        {onToggleEdit ? (
          // Both states share one fixed pill slot and are absolutely stacked, so
          // switching crossfades in place rather than sliding two pills apart.
          <View style={styles.morphSlot}>
            {editing ? (
              // While editing the whole pill becomes one Done control — same
              // footprint, no Start-workout button to tap by mistake.
              <Animated.View key="done" entering={enter} exiting={exit} style={StyleSheet.absoluteFill}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done editing dashboard"
                  onPress={onToggleEdit}
                  style={({ pressed }) => [
                    styles.donePill,
                    {
                      backgroundColor: isDark ? theme.surfaceMuted : theme.surfaceElevated,
                      borderColor: theme.border,
                      borderWidth: isDark ? 0 : 1,
                    },
                    pressed && pressedFeedback,
                  ]}
                >
                  <Icon name="check" size={22} color={theme.ink} weight="bold" />
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View key="group" entering={enter} exiting={exit} style={StyleSheet.absoluteFill}>
                <HeaderActionGroup testID="dashboard-header-actions">
                  <HeaderAction
                    accessibilityLabel="Edit dashboard"
                    icon="note"
                    iconSize={20}
                    iconOnly
                    variant="ghost"
                    style={joinedHeaderAction}
                    onPress={onToggleEdit}
                  />
                  <HeaderAction
                    accessibilityLabel="Start workout"
                    icon="add"
                    iconSize={22}
                    iconOnly
                    variant="ghost"
                    style={joinedHeaderAction}
                    onPress={onStart}
                  />
                </HeaderActionGroup>
              </Animated.View>
            )}
          </View>
        ) : (
          <HeaderAction
            accessibilityLabel="Start workout"
            icon="add"
            iconSize={22}
            iconOnly
            onPress={onStart}
          />
        )}
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
  // Fixed pill footprint (the joined edit+add group width) that both states
  // stack inside, so the swap crossfades in place instead of resizing.
  morphSlot: { width: 90, height: 44 },
  donePill: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  copy: { flex: 1, minWidth: 0, justifyContent: 'center', paddingRight: 16 },
  subtitle: { ...typeScale.label, marginTop: 2 },
});
