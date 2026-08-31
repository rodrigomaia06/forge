import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';

interface AppScreenProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  testID?: string;
}

export function AppScreen({
  children,
  style,
  backgroundColor,
  testID,
}: AppScreenProps) {
  const theme = useForgeTheme();
  const surface = backgroundColor ?? theme.background;
  return (
    <SafeAreaView
      testID={testID}
      edges={['top', 'bottom']}
      style={[styles.safeArea, { backgroundColor: surface }]}
    >
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1 },
});
