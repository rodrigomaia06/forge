import React from 'react';
import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
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
  disabled?: boolean;
  haptic?: 'none' | 'light' | 'medium';
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
  disabled = false,
  haptic,
}: HeaderActionProps) {
  const theme = useForgeTheme();
  const accent = accentColor ?? theme.accent;
  const isAccent = tone === 'accent';
  return (
    <Button
      accessibilityLabel={accessibilityLabel}
      label={iconOnly ? undefined : label}
      icon={icon}
      iconSize={20}
      variant="secondary"
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      theme={theme}
      labelColor={labelColor ?? (isAccent ? theme.surface : theme.textPrimary)}
      labelStyle={labelStyle}
      style={[
        styles.base,
        isAccent
          ? { backgroundColor: accent, borderColor: accent }
          : iconOnly
            ? [
                styles.iconOnly,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceElevated,
                  shadowColor: theme.shadow,
                },
              ]
            : [styles.neutral, { borderColor: theme.border, backgroundColor: theme.surface }],
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
    borderColor: '#00000000',
    backgroundColor: '#00000000',
    shadowColor: '#17191C',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  neutral: {
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.68)',
  },
});
