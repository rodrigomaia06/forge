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
      style={[{
        // Close and the in-sheet Back action are peers. Their shared surface
        // remains visible against both sheet backgrounds without suggesting a
        // destructive action.
        backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surfaceElevated,
        borderColor: theme.border,
      }, style]}
    />
  );
}
