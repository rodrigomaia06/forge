import React from 'react';
import { StyleSheet, type StyleProp, type TextProps, type TextStyle } from 'react-native';

import { typeScale } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { ForgeText as Text } from './ForgeText';

interface ScreenTitleProps extends Pick<TextProps, 'children' | 'numberOfLines' | 'testID'> {
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function ScreenTitle({ children, color, style, ...props }: ScreenTitleProps) {
  const theme = useForgeTheme();
  return (
    <Text {...props} style={[styles.title, { color: color ?? theme.textPrimary }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: typeScale.screenTitle,
});
