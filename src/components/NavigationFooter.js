import React from 'react';
import { StyleSheet, View } from 'react-native';
import { DockSurface } from './DockSurface';
import { dashboardTheme } from '../theme/dashboardTheme';

export function NavigationFooter({ style }) {
  return <View style={[styles.footer, style]}><DockSurface theme={dashboardTheme} /></View>;
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 0, paddingBottom: 10, paddingTop: 8 },
});
