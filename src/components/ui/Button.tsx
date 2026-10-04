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
import { scaleUI } from '../../theme/scale';
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
  /** Delay before the press engages, so a scroll starting on the button from
   * standstill is handed to an enclosing list instead of being swallowed. */
  pressDelay?: number;
}

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  icon,
  iconSize = scaleUI(20),
  iconWeight = 'regular',
  loading = false,
  disabled = false,
  style,
  labelStyle,
  theme,
  tone,
  haptic,
  hitSlop,
  pressDelay,
}: ButtonProps) {
  const contextTheme = useForgeTheme();
  const resolvedTheme = theme ?? contextTheme ?? colors;
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const resolvedTone = tone ?? 'neutral';
  // Borderless + tonal is a LIGHT-only treatment: it fixes Light's compressed tones.
  // Dark keeps its original semantic outlines (it was already the reference look).
  const borderless = resolvedTheme.colorScheme === 'light';
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
      unstable_pressDelay={pressDelay}
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
        // Dark keeps the outline variant's 2px semantic ring. Light drops all rings
        // and instead separates non-primary tonal controls by fill + the card shadow.
        !borderless && isOutline && styles.outline,
        borderless && !isPrimary && !isGhost && styles.tonalShadow,
        isGhost && styles.ghost,
        (disabled || loading) && [styles.disabled, { backgroundColor: resolvedTheme.surfaceMuted, borderColor: resolvedTheme.surfaceMuted }],
        pressed && !(disabled || loading) && pressedSurface(variant, resolvedTone, resolvedTheme),
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
    gap: scaleUI(7),
    paddingHorizontal: scaleUI(14),
    borderRadius: radii.control,
  },
  primary: { minWidth: scaleUI(92) },
  outline: { borderWidth: 2 },
  ghost: { borderWidth: 0 },
  // Light-only raised-control shadow (dark sets cardShadowOpacity 0, so this stays
  // flat there). Matches ForgeCard so borderless buttons separate like nested cards.
  tonalShadow: {
    shadowColor: '#17191C',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  label: typeScale.controlLabel,
  disabled: { opacity: 1 },
});

function foregroundFor(tone: NonNullable<ButtonProps['tone']>, primary: boolean, theme: ForgeTheme): string {
  if (primary && tone === 'neutral') return theme.onActionPrimary;
  if (primary && tone === 'success') return theme.onSuccess;
  // A solid destructive (primary) button takes contrasting text; the tinted
  // variants keep the bright-red label on their soft fill.
  if (primary && tone === 'destructive') return theme.onActionPrimary;
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
    if (tone === 'destructive') return { backgroundColor: theme.textDestructive, borderColor: theme.textDestructive };
    return { backgroundColor: theme.surfaceElevated, borderColor: theme.surfaceElevated };
  }
  // LIGHT: borderless + tonal — colour carries the meaning (soft red = destructive,
  // soft green = success, white/elevated = neutral), no ring; `outline` == `secondary`.
  if (theme.colorScheme === 'light') {
    const backgroundColor = tone === 'destructive'
      ? theme.destructiveSurface
      : tone === 'success'
        ? theme.successSurface
        : theme.surfaceElevated;
    return { backgroundColor, borderColor: backgroundColor };
  }
  // DARK (reference, unchanged): outline keeps a 2px semantic ring (via styles.outline),
  // secondary is borderless by tone. These match the pre-change Dark appearance.
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
  // The solid destructive button darkens by dimming; the tinted ones deepen.
  if (variant === 'primary' && tone === 'destructive') return { opacity: 0.82 };
  if (tone === 'destructive') return { backgroundColor: theme.destructiveSurfacePressed };
  if (tone === 'success' && variant === 'outline') return { backgroundColor: theme.successSurfacePressed };
  if (variant === 'ghost') return { backgroundColor: theme.pressed };
  return { opacity: 0.76 };
}
