import React from 'react';
import { StyleSheet } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { DockChrome } from '../components/DockChrome';
import { useForgeTheme } from '../theme/ThemeProvider';
import { usePrimaryDock } from './PrimaryDockContext';

export function ForgeTabBar(props: BottomTabBarProps) {
  const theme = useForgeTheme();
  const { compact, setCompact } = usePrimaryDock();

  return (
    <DockChrome
      theme={theme}
      compact={compact}
      onInteract={() => setCompact(false)}
      tabBarProps={props}
      style={styles.tabBar}
      slotTestID="dashboard-dock-slot"
      cylinderTestID="dashboard-dock-cylinder"
      vignetteTestID="dashboard-dock-vignette"
      indicatorTestID="dashboard-dock-home-indicator"
    />
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
});
