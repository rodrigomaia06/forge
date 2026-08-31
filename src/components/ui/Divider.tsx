import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import type { StyleProp, ViewStyle } from 'react-native';

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useForgeTheme();
  return <View accessibilityRole="none" style={[styles.divider, { backgroundColor: theme.divider }, style]} />;
}

const styles = StyleSheet.create({
  divider: { height: 1 },
});
