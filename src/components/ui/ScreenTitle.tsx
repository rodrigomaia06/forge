import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { colors, typography } from '../../theme/tokens';

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
  title: {
    fontFamily: typography.bold,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -1,
    textShadowColor: 'rgba(23, 36, 49, 0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
});
