import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BlurView } from 'expo-blur';
import type { IconName, IconWeight } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { Button } from './Button';

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
  loading?: boolean;
  haptic?: 'none' | 'light' | 'medium';
}

type ForgeBackButtonProps = Omit<HeaderActionProps, 'icon' | 'iconOnly' | 'label'>;

/** Forge's shared Back affordance for headers and in-sheet replacement views. */
export function ForgeBackButton({
  accessibilityLabel,
  onPress,
  style,
  disabled,
  loading,
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
      loading={loading}
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
  loading = false,
  haptic,
}: HeaderActionProps) {
  const theme = useForgeTheme();
  const isBackControl = iconOnly && icon === 'chevron-back';
  // Icon-only circular header/sheet controls are borderless in BOTH themes — they
  // separate by their tonal/frosted surface against the header, never a grey ring.
  const isBorderlessSheetCircle = iconOnly;
  // Neutral circular controls get a frosted "glass-like" surface (blur + a soft tint),
  // the same feel on every device — no native Liquid Glass. Primary CTAs keep their
  // solid fill; destructive/success keep their semantic surfaces.
  const frosted = iconOnly && tone === 'neutral' && variant !== 'primary';
  const surfaceStyle = [styles.base, styles.iconOnly, styles.frostedCircle, style];
  const surface = StyleSheet.flatten<ViewStyle>(surfaceStyle);
  const layerShape = {
    borderRadius: surface.borderRadius,
    borderTopLeftRadius: surface.borderTopLeftRadius,
    borderTopRightRadius: surface.borderTopRightRadius,
    borderBottomLeftRadius: surface.borderBottomLeftRadius,
    borderBottomRightRadius: surface.borderBottomRightRadius,
  };
  const control = (
    <Button
      accessibilityLabel={accessibilityLabel}
      label={iconOnly ? undefined : label}
      icon={icon}
      iconSize={iconSize}
      iconWeight={iconWeight}
      // On a frosted control render a true ghost: transparent at rest (the frost is the
      // surface) but it keeps its pressed tint (theme.pressed) on top of the blur.
      variant={frosted ? 'ghost' : variant}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      haptic={haptic}
      tone={tone}
      style={[
        styles.base,
        iconOnly && styles.iconOnly,
        isBackControl && !frosted && {
          // Back is a peer of the neutral header action, not a disabled or
          // inset control. Dark headers need the muted layer to retain the
          // same clear silhouette that the light elevated surface provides.
          backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surfaceElevated,
          borderColor: theme.border,
        },
        // On a frosted control the frost is the surface, so the caller's tonal fill is
        // dropped; otherwise the caller style (incl. background) applies as before.
        !frosted && style,
        frosted && layerShape,
        isBorderlessSheetCircle && styles.borderlessDarkCircle,
      ]}
    />
  );
  if (frosted) {
    // Backdrop filters need their own mask inside transformed web sheets.
    return (
      <View style={surfaceStyle}>
        <BlurView
          pointerEvents="none"
          intensity={theme.colorScheme === 'dark' ? 36 : 60}
          tint={theme.colorScheme === 'dark' ? 'dark' : 'light'}
          blurMethod="dimezisBlurView"
          style={[StyleSheet.absoluteFill, layerShape]}
        />
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            layerShape,
            {
              opacity: theme.colorScheme === 'dark' ? 0.6 : 0.55,
              backgroundColor: theme.colorScheme === 'dark' ? theme.surfaceMuted : theme.surfaceElevated,
            },
          ]}
        />
        {control}
      </View>
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
  // Frosted circular control: blur + soft tint clipped to the circle, icon on top.
  frostedCircle: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
