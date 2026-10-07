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
import { colors, radii, shadows, typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { lightHaptic, mediumHaptic } from './haptics';
import type { ForgeTheme, IconName, IconWeight } from '../../types';

interface ButtonProps {
  label?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
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
  accessibilityHint,
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
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
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
        // The `outline` variant keeps its 2px ring in BOTH themes — if a button is
        // outlined in Dark it is outlined in Light too (the deepened Light `border`
        // token makes the neutral ring visible). `secondary`/ghost stay borderless;
        // Light secondary separates by its elevated fill + the card shadow.
        isOutline && styles.outline,
        borderless && !isPrimary && !isGhost && !isOutline && [styles.tonalShadow, { shadowColor: resolvedTheme.shadow }],
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
  tonalShadow: { ...shadows.tonalControl },
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
  // `outline` keeps its 2px semantic ring in BOTH themes (same colours): soft fill +
  // a toned border (red destructive / green success / neutral `border`). So a button
  // outlined in Dark is outlined in Light too.
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
  // `secondary` is borderless in both themes. LIGHT separates it by an elevated/tonal
  // fill (colour = meaning); DARK separates it by tone.
  if (theme.colorScheme === 'light') {
    const backgroundColor = tone === 'destructive'
      ? theme.destructiveSurface
      : tone === 'success'
        ? theme.successSurface
        : theme.surfaceElevated;
    return { backgroundColor, borderColor: backgroundColor };
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
