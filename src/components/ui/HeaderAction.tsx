import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName, IconWeight } from '../../types';
import { Button } from './Button';

interface HeaderActionProps {
  accessibilityLabel: string;
  label?: string;
  icon: IconName;
  iconSize?: number;
  iconWeight?: IconWeight;
  onPress: () => void;
  iconOnly?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  tone?: 'neutral' | 'success' | 'destructive';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: 'none' | 'light' | 'medium';
}

export function HeaderAction({
  accessibilityLabel,
  label,
  icon,
  iconSize = 20,
  iconWeight = 'regular',
  onPress,
  iconOnly = false,
  variant = 'secondary',
  tone = 'neutral',
  style,
  disabled = false,
  haptic,
}: HeaderActionProps) {
  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      label={iconOnly ? undefined : label}
      icon={icon}
      iconSize={iconSize}
      iconWeight={iconWeight}
      variant={variant}
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      tone={tone}
      style={[
        styles.base,
        iconOnly && styles.iconOnly,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    minHeight: 44,
    borderRadius: 21,
  },
  iconOnly: {
    width: 44,
    minWidth: 44,
    paddingHorizontal: 0,
    borderRadius: 22,
  },
});
