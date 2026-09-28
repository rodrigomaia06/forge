import React from 'react';
import { View } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { Icon } from './Icon';

/**
 * The shared unilateral marker: a rounded boxed "U" that reads as "complete one
 * side at a time" without a language label. Used on the live-workout exercise
 * header and the exercise-library detail so the two stay consistent.
 */
export function UnilateralBadge({ size = 19, color }: { size?: number; color?: string }) {
  const theme = useForgeTheme();
  return (
    <View accessible accessibilityLabel="Unilateral, complete one side at a time">
      <Icon name="square-rounded-letter-u" size={size} color={color ?? theme.slate} />
    </View>
  );
}
