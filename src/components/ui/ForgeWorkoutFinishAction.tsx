import React from 'react';
import { scaleUI } from '../../theme/scale';
import { HeaderAction } from './HeaderAction';

export function ForgeWorkoutFinishAction({
  accessibilityLabel = 'Finish workout',
  onPress,
  disabled,
  loading,
}: {
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <HeaderAction
      accessibilityLabel={accessibilityLabel}
      icon="check"
      iconSize={24}
      iconOnly
      variant="primary"
      haptic="none"
      disabled={disabled}
      loading={loading}
      onPress={onPress}
      style={{
        zIndex: 1,
        width: scaleUI(72),
        minWidth: scaleUI(72),
        paddingHorizontal: 0,
        borderRadius: scaleUI(22),
      }}
    />
  );
}
