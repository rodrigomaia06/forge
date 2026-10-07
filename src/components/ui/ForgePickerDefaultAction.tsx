import React from 'react';
import { useForgeTheme } from '../../theme/ThemeProvider';
import type { IconName } from '../../types';
import { HeaderAction } from './HeaderAction';

export function ForgePickerDefaultAction({
  accessibilityLabel,
  icon,
  onPress,
  haptic,
}: {
  accessibilityLabel: string;
  icon: IconName;
  onPress: () => void;
  haptic?: 'none' | 'light' | 'medium';
}) {
  const theme = useForgeTheme();
  return (
    <HeaderAction
      accessibilityLabel={accessibilityLabel}
      label="Default"
      icon={icon}
      variant="secondary"
      haptic={haptic}
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        backgroundColor: theme.surfaceMuted,
        borderColor: theme.border,
        borderWidth: 1,
      }}
    />
  );
}
