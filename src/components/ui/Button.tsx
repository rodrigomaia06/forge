import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Icon } from './Icon';
import { ForgeText as Text } from './ForgeText';
import { colors, radii, typeScale } from '../../theme/tokens';
import type { ForgeTheme, IconName, IconWeight } from '../../types';

interface ButtonProps {
  label?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  icon?: IconName;
  iconSize?: number;
  iconWeight?: IconWeight;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  labelColor?: string;
  theme?: ForgeTheme;
}

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  icon,
  iconSize = 20,
  iconWeight = 'regular',
  loading = false,
  disabled = false,
  style,
  labelStyle,
  labelColor,
  theme = colors,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const textColor = labelColor || (isPrimary ? theme.surface : theme.accent);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isPrimary
          ? { backgroundColor: theme.accent }
          : isOutline
            ? [styles.outline, { borderColor: theme.accent, backgroundColor: theme.surface }]
            : { borderColor: theme.divider, backgroundColor: theme.surface },
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        icon && <Icon name={icon} size={iconSize} weight={iconWeight} color={textColor} />
      )}
      {!loading && label && (
        <Text style={[styles.label, { color: textColor }, labelStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: radii.control,
  },
  primary: { minWidth: 92 },
  outline: { borderWidth: 2 },
  label: typeScale.controlLabel,
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
