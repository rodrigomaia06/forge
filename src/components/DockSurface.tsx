import React, { type ReactNode, type Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BottomNavigation } from './BottomNavigation';
import { dashboardTheme } from '../theme/dashboardTheme';
import type { ForgeTheme } from '../types';

interface DockSurfaceProps {
  theme?: ForgeTheme;
  testID?: string;
  dockRef?: Ref<View>;
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: ReactNode;
}
export function DockSurface({
  theme = dashboardTheme,
  testID,
  dockRef,
  onLayout,
  children,
}: DockSurfaceProps) {
  return (
    <View
      ref={dockRef}
      onLayout={onLayout}
      testID={testID}
      style={[styles.dock, { backgroundColor: theme.dockSurface, borderColor: theme.dockBorder }]}
    >
      {children || <BottomNavigation theme={{ ...theme, surface: theme.surface }} />}
    </View>
  );
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
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
});
