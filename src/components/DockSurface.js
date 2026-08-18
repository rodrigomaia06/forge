import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomNavigation } from './BottomNavigation';
import { dashboardTheme } from '../theme/dashboardTheme';

export function DockSurface({ theme = dashboardTheme, testID, dockRef, onLayout, children }) {
  return <View ref={dockRef} onLayout={onLayout} testID={testID} style={[styles.dock, { backgroundColor: theme.dockSurface, borderColor: theme.dockBorder }]}>
    {children || <BottomNavigation theme={{ ...theme, surface: theme.surface }} />}
  </View>;
}

const styles = StyleSheet.create({
  dock: {
    width: '88%',
    maxWidth: 390,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 1000,
    borderWidth: 1,
    paddingHorizontal: 6,
    shadowColor: '#172431',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
