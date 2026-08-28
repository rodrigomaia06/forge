import React from 'react';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { dashboardTheme } from '../../theme/dashboardTheme';
import type { IconName } from '../../types';
import { Button } from './Button';

interface HeaderActionProps {
  accessibilityLabel: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  iconOnly?: boolean;
  tone?: 'neutral' | 'accent';
  accentColor?: string;
  labelColor?: string;
  labelStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
}

export function HeaderAction({
  accessibilityLabel,
  label,
  icon,
  onPress,
  iconOnly = false,
  tone = 'neutral',
  accentColor,
  labelColor,
  labelStyle,
  style,
}: HeaderActionProps) {
  const accent = accentColor ?? dashboardTheme.accent;
  const isAccent = tone === 'accent';
  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      label={iconOnly ? undefined : label}
      icon={icon}
      iconSize={20}
      variant="secondary"
      onPress={onPress}
      theme={dashboardTheme}
      labelColor={labelColor ?? (isAccent ? dashboardTheme.surface : dashboardTheme.ink)}
      labelStyle={labelStyle}
      style={[
        styles.base,
        isAccent
          ? { backgroundColor: accent, borderColor: accent }
          : iconOnly
            ? styles.iconOnly
            : styles.neutral,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    width: 100,
    height: 44,
    minWidth: 100,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 21,
    borderWidth: 1,
  },
  iconOnly: {
    width: 44,
    minWidth: 44,
    paddingHorizontal: 0,
    borderRadius: 22,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  neutral: {
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
});
