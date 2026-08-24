import React from 'react';
import { StyleSheet } from 'react-native';
import { DockChrome } from './DockChrome';
import { dashboardTheme } from '../theme/dashboardTheme';
import type { StyleProp, ViewStyle } from 'react-native';

export function NavigationFooter({ style }: { style?: StyleProp<ViewStyle> }) {
  return <DockChrome theme={dashboardTheme} style={[styles.footer, style]} />;
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
