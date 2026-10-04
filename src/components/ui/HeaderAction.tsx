import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { IconName, IconWeight } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { Button } from './Button';

// Native iOS 26 Liquid Glass for neutral circular controls when available; otherwise
// the tonal borderless surface (Android / iOS < 26). Capability is static — read once.
const LIQUID_GLASS = isLiquidGlassAvailable();

interface HeaderActionProps {
  accessibilityLabel: string;
  label?: string;
  icon: IconName;
  iconSize?: number;
  iconWeight?: IconWeight;
  onPress: () => void;
  iconOnly?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  tone?: 'neutral' | 'success' | 'destructive';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: 'none' | 'light' | 'medium';
}

type ForgeBackButtonProps = Omit<HeaderActionProps, 'icon' | 'iconOnly' | 'label'>;

/** Forge's shared Back affordance for headers and in-sheet replacement views. */
export function ForgeBackButton({
  accessibilityLabel,
  onPress,
  style,
  disabled,
  haptic,
  iconSize,
  iconWeight,
}: ForgeBackButtonProps) {
  return (
    <HeaderAction
      accessibilityLabel={accessibilityLabel}
      icon="chevron-back"
      iconOnly
      onPress={onPress}
      style={style}
      disabled={disabled}
      haptic={haptic}
      iconSize={iconSize}
      iconWeight={iconWeight}
    />
  );
}

export function HeaderAction({
  accessibilityLabel,
  label,
  icon,
  iconSize = 20,
  iconWeight = 'regular',
  onPress,
  iconOnly = false,
  variant = 'secondary',
  tone = 'neutral',
  style,
  disabled = false,
  haptic,
}: HeaderActionProps) {
  const theme = useForgeTheme();
  const isBackControl = iconOnly && icon === 'chevron-back';
  // Icon-only circular header/sheet controls are borderless in BOTH themes — they
  // separate by their tonal surface against the header, never a grey ring. (Light
  // used to keep a fine border; removed so Light matches Dark's borderless feel.)
  const isBorderlessSheetCircle = iconOnly;
  // iOS 26 Liquid Glass for neutral circular controls; destructive/success keep their
  // semantic surfaces (red/green), and non-iOS-26 keeps the tonal fill.
  const glass = iconOnly && LIQUID_GLASS && tone === 'neutral';
  const control = (
    <Button
      accessibilityLabel={accessibilityLabel}
      label={iconOnly ? undefined : label}
      icon={icon}
      iconSize={iconSize}
      iconWeight={iconWeight}
      variant={variant}
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      tone={tone}
      style={[
        styles.base,
        iconOnly && styles.iconOnly,
        isBackControl && {
          // Back is a peer of the neutral header action, not a disabled or
          // inset control. Dark headers need the muted layer to retain the
          // same clear silhouette that the light elevated surface provides.
          backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surfaceElevated,
          borderColor: theme.border,
        },
        // Under glass the caller's tonal fill is dropped (the glass is the surface);
        // otherwise the caller style (incl. background) applies as before.
        !glass && style,
        // Circular icon-only header/sheet controls drop their outline in both themes.
        // Standard Save, Delete, Clear and labelled actions retain the semantic
        // border supplied by the shared Button primitive.
        isBorderlessSheetCircle && styles.borderlessDarkCircle,
        glass && styles.glassControl,
      ]}
    />
  );
  if (glass) {
    return (
      <GlassView
        style={[styles.base, styles.iconOnly, styles.glassSurface, style]}
        glassEffectStyle="regular"
        isInteractive
      >
        {control}
      </GlassView>
    );
  }
  return control;
}

const styles = StyleSheet.create({
  base: {
    height: 44,
    minHeight: 44,
    borderRadius: 21,
  },
  iconOnly: {
    width: 44,
    minWidth: 44,
    paddingHorizontal: 0,
    borderRadius: 22,
  },
  borderlessDarkCircle: { borderWidth: 0, borderColor: 'transparent' },
  // Liquid Glass control: the GlassView is the circular surface; the Button sits on
  // top transparent, and the surface clips to the circle.
  glassControl: { backgroundColor: 'transparent', borderWidth: 0 },
  glassSurface: { overflow: 'hidden' },
});
