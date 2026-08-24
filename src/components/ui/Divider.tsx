import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/tokens';
import type { StyleProp, ViewStyle } from 'react-native';

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View accessibilityRole="none" style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.divider },
});
