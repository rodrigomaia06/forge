import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import type { IconName, IconWeight } from '../../types';
import { Button } from './Button';

interface HeaderCircleActionProps {
  accessibilityLabel: string;
  icon: IconName;
  onPress: () => void;
  iconSize?: number;
  iconWeight?: IconWeight;
  style?: StyleProp<ViewStyle>;
}

/** Dashboard-styled circular action, intended for tab-root headers. */
export function HeaderCircleAction({
  accessibilityLabel,
  icon,
  onPress,
  iconSize = 22,
  iconWeight = 'regular',
  style,
}: HeaderCircleActionProps) {
  const theme = useForgeTheme();
  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      icon={icon}
      iconSize={iconSize}
      iconWeight={iconWeight}
      variant="secondary"
      tone="neutral"
      onPress={onPress}
      theme={theme}
      style={[
        styles.button,
        {
          borderColor: theme.border,
          backgroundColor: theme.surfaceElevated,
          shadowColor: theme.shadow,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    width: 46,
    height: 46,
    minWidth: 46,
    minHeight: 46,
    paddingHorizontal: 0,
    borderRadius: 1000,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.68)',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
