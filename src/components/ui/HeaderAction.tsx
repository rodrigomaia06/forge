import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { dashboardTheme } from '../../theme/dashboardTheme';
import { typography } from '../../theme/tokens';
import type { IconName } from '../../types';
import { Button } from './Button';

interface HeaderActionProps {
  accessibilityLabel: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  tone?: 'neutral' | 'accent';
  accentColor?: string;
  labelColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function HeaderAction({
  accessibilityLabel,
  label,
  icon,
  onPress,
  tone = 'neutral',
  accentColor,
  labelColor,
  style,
}: HeaderActionProps) {
  const accent = accentColor ?? dashboardTheme.accent;
  const isAccent = tone === 'accent';
  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      label={label}
      icon={icon}
      iconSize={18}
      variant="secondary"
      onPress={onPress}
      theme={dashboardTheme}
      labelColor={labelColor ?? (isAccent ? dashboardTheme.surface : dashboardTheme.ink)}
      labelStyle={styles.label}
      style={[
        styles.base,
        isAccent ? { backgroundColor: accent, borderColor: accent } : styles.neutral,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    width: 82,
    height: 38,
    minWidth: 82,
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: 19,
    borderWidth: 1,
  },
  neutral: {
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
  label: { fontFamily: typography.semibold, fontSize: 12, lineHeight: 16 },
});
