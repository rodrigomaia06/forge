import React from 'react';
import { StyleSheet } from 'react-native';
import { DockChrome } from './DockChrome';
import { dashboardTheme } from '../theme/dashboardTheme';
import type { StyleProp, ViewStyle } from 'react-native';

export function NavigationFooter({
  style,
  compact = false,
  onInteract,
}: {
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  onInteract?: () => void;
}) {
  return (
    <DockChrome
      theme={dashboardTheme}
      compact={compact}
      onInteract={onInteract}
      style={[styles.footer, style]}
    />
  );
}

const styles = StyleSheet.create({
  footer: {
    height: 88,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    zIndex: 10,
  },
});
