import React from 'react';
import { StyleSheet, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { colors, typeScale } from '../../theme/tokens';
import { ForgeText as Text } from './ForgeText';

interface ScreenTitleProps extends Pick<TextProps, 'children' | 'numberOfLines' | 'testID'> {
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function ScreenTitle({ children, color = colors.ink, style, ...props }: ScreenTitleProps) {
  return (
    <Text {...props} style={[styles.title, { color }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: typeScale.screenTitle,
});
