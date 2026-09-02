import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { HeaderAction } from './HeaderAction';

interface SheetCloseButtonProps {
  accessibilityLabel?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Shared dismiss action for Forge sheets and modal surfaces. */
export function SheetCloseButton({
  accessibilityLabel = 'Close',
  onPress,
  style,
}: SheetCloseButtonProps) {
  const theme = useForgeTheme();
  return (
    <HeaderAction
      accessibilityLabel={accessibilityLabel}
      icon="close"
      iconOnly
      onPress={onPress}
      style={[{ backgroundColor: theme.surfaceMuted, borderColor: theme.border }, style]}
    />
  );
}
