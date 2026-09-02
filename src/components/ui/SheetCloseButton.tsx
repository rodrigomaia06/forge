import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';

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
  return (
    <HeaderAction
      accessibilityLabel={accessibilityLabel}
      icon="close"
      iconOnly
      onPress={onPress}
      style={style}
    />
  );
}
