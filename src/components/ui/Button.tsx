import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type Insets,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Icon } from './Icon';
import { ForgeText as Text } from './ForgeText';
import { colors, radii, typeScale } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { lightHaptic, mediumHaptic } from './haptics';
import type { ForgeTheme, IconName, IconWeight } from '../../types';

interface ButtonProps {
  label?: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  icon?: IconName;
  iconSize?: number;
  iconWeight?: IconWeight;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  theme?: ForgeTheme;
  tone?: 'neutral' | 'success' | 'destructive';
  haptic?: 'none' | 'light' | 'medium';
  hitSlop?: number | Insets;
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
  theme,
  tone,
  haptic,
  hitSlop,
}: ButtonProps) {
  const contextTheme = useForgeTheme();
  const resolvedTheme = theme ?? contextTheme ?? colors;
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isBorderlessDarkControl = resolvedTheme.colorScheme === 'dark' && (variant === 'secondary' || isOutline);
  const resolvedTone = tone ?? 'neutral';
  const textColor = disabled || loading
    ? resolvedTheme.textDisabled
    : foregroundFor(resolvedTone, isPrimary, resolvedTheme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      hitSlop={hitSlop}
      onPress={() => {
        const feedback = haptic ?? (isPrimary ? 'medium' : 'light');
        if (feedback === 'light') lightHaptic();
        if (feedback === 'medium') mediumHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        buttonSurface(variant, resolvedTone, resolvedTheme),
        isOutline && styles.outline,
        isGhost && styles.ghost,
        (disabled || loading) && [styles.disabled, { backgroundColor: resolvedTheme.surfaceMuted, borderColor: resolvedTheme.surfaceMuted }],
        pressed && !(disabled || loading) && pressedSurface(variant, resolvedTone, resolvedTheme),
        style,
        // Dark Forge controls use their filled tonal surface for separation.
        // A thin light outline becomes visual noise there, including when a
        // caller supplies a reusable header/button style with a border.
        isBorderlessDarkControl && styles.borderlessDarkControl,
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
  secondary: { borderWidth: 1 },
  outline: { borderWidth: 2 },
  ghost: { borderWidth: 0 },
  borderlessDarkControl: { borderWidth: 0, borderColor: 'transparent' },
  label: typeScale.controlLabel,
  disabled: { opacity: 1 },
});

function foregroundFor(tone: NonNullable<ButtonProps['tone']>, primary: boolean, theme: ForgeTheme): string {
  if (primary && tone === 'neutral') return theme.onActionPrimary;
  if (primary && tone === 'success') return theme.onSuccess;
  if (tone === 'destructive') return theme.textDestructive;
  if (tone === 'success') return theme.success;
  return theme.textPrimary;
}

function buttonSurface(
  variant: NonNullable<ButtonProps['variant']>,
  tone: NonNullable<ButtonProps['tone']>,
  theme: ForgeTheme,
): ViewStyle {
  if (variant === 'ghost') return { backgroundColor: 'transparent', borderColor: 'transparent' };
  if (variant === 'primary') {
    if (tone === 'neutral') return { backgroundColor: theme.actionPrimary, borderColor: theme.actionPrimary };
    if (tone === 'success') return { backgroundColor: theme.success, borderColor: theme.success };
    if (tone === 'destructive') return { backgroundColor: theme.destructiveSurface, borderColor: theme.textDestructive };
    return { backgroundColor: theme.surfaceElevated, borderColor: theme.border };
  }
  if (variant === 'outline') {
    return {
      backgroundColor: tone === 'destructive'
        ? theme.destructiveSurface
        : tone === 'success'
          ? theme.successSurface
          : theme.surface,
      borderColor: tone === 'destructive' ? theme.textDestructive : tone === 'success' ? theme.success : theme.border,
    };
  }
  return {
    backgroundColor: tone === 'destructive' ? theme.destructiveSurface : theme.surfaceElevated,
    borderColor: tone === 'destructive' ? theme.textDestructive : theme.border,
  };
}

function pressedSurface(
  variant: NonNullable<ButtonProps['variant']>,
  tone: NonNullable<ButtonProps['tone']>,
  theme: ForgeTheme,
): ViewStyle {
  if (tone === 'destructive') return { backgroundColor: theme.destructiveSurfacePressed };
  if (tone === 'success' && variant === 'outline') return { backgroundColor: theme.successSurfacePressed };
  if (variant === 'ghost') return { backgroundColor: theme.pressed };
  return { opacity: 0.76 };
}
