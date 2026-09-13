import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import type { Edge } from 'react-native-safe-area-context';
import type { StyleProp, ViewStyle } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';

interface AppScreenProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  testID?: string;
  edges?: readonly Edge[];
}

export function AppScreen({
  children,
  style,
  backgroundColor,
  testID,
  edges = ['top', 'bottom'],
}: AppScreenProps) {
  const theme = useForgeTheme();
  const insets = useSafeAreaInsets();
  const surface = backgroundColor ?? theme.background;
  return (
    <View
      testID={testID}
      style={[
        styles.safeArea,
        {
          backgroundColor: surface,
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
          paddingLeft: edges.includes('left') ? insets.left : 0,
          paddingRight: edges.includes('right') ? insets.right : 0,
        },
      ]}
    >
      <View collapsable={false} style={[styles.content, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Keep the safe-area padding and child bounds in the same layout pass as
  // navigation and the dock, which also consume useSafeAreaInsets.
  safeArea: { flex: 1, minHeight: 0 },
  content: { flex: 1, minHeight: 0 },
});
