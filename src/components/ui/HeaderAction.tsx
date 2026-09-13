import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

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
  return (
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
        style,
      ]}
    />
  );
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
});
