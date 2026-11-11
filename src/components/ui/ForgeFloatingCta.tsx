import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ForgeTheme, IconName } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { Button } from './Button';
import { ForgeControlSurface } from './ForgeControlSurface';

/** Geometry shared by scrollable sheet bodies and their floating confirmation action. */
export const forgeFloatingCtaGeometry = {
  /**
   * The fade rises only this far above the button. It matches `contentGap`, so the
   * clearance that rests the final row above the CTA keeps that row untinted; only
   * content actually scrolling under the button fades out.
   */
  fadeLead: 16,
  horizontalInset: 20,
  topInset: 8,
  buttonHeight: 46,
  minimumBottomInset: 8,
  contentGap: 16,
} as const;

/** The trailing content room that places a final row fully above the CTA. */
export function useForgeFloatingCtaClearance(): number {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(
    forgeFloatingCtaGeometry.minimumBottomInset,
    insets.bottom - 4,
  );
  return forgeFloatingCtaGeometry.topInset
    + forgeFloatingCtaGeometry.buttonHeight
    + bottomInset
    + forgeFloatingCtaGeometry.contentGap;
}

/** The floating confirmation treatment used by long picker sheets. */
export function ForgeFloatingCta({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
  icon,
  tone = 'neutral',
  theme,
  style,
  labelStyle,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
  tone?: 'neutral' | 'success' | 'destructive';
  theme?: ForgeTheme;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}) {
  const insets = useSafeAreaInsets();
  const contextTheme = useForgeTheme();
  const resolvedTheme = theme ?? contextTheme;
  const surface = React.useContext(ForgeControlSurface) ?? resolvedTheme.background;
  // A success-tone floating confirm is a form/selection completion, so it wears
  // the shared checkmark by default (design.md) unless a caller sets its own icon.
  const resolvedIcon = icon ?? (tone === 'success' ? 'check' : undefined);
  const gradientId = `forgeFloatingCtaFade${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const bottomInset = Math.max(forgeFloatingCtaGeometry.minimumBottomInset, insets.bottom - 4);
  // Solid behind the button and its insets; transparent → opaque only across the
  // short lead above it, rather than a tall veil reaching up over resting content.
  const fadeHeight = forgeFloatingCtaGeometry.fadeLead
    + forgeFloatingCtaGeometry.topInset
    + forgeFloatingCtaGeometry.buttonHeight
    + bottomInset;
  const solidFrom = forgeFloatingCtaGeometry.fadeLead / fadeHeight;
  return (
    <>
      <View testID="forge-floating-cta-fade" style={[styles.fade, { height: fadeHeight, pointerEvents: 'none' }]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={surface} stopOpacity="0" />
              <Stop offset={String(solidFrom * 0.5)} stopColor={surface} stopOpacity="0.6" />
              <Stop offset={String(solidFrom)} stopColor={surface} stopOpacity="1" />
              <Stop offset="1" stopColor={surface} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
      <Animated.View style={[
        styles.dock,
        { paddingBottom: bottomInset },
        style,
      ]}>
        <Button
          label={label}
          accessibilityLabel={accessibilityLabel}
          disabled={disabled}
          onPress={onPress}
          theme={resolvedTheme}
          icon={resolvedIcon}
          variant="outline"
          tone={tone}
          style={styles.button}
          labelStyle={labelStyle}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fade: {
    position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 1,
  },
  dock: {
    position: 'absolute', right: forgeFloatingCtaGeometry.horizontalInset, bottom: 0,
    left: forgeFloatingCtaGeometry.horizontalInset, paddingTop: forgeFloatingCtaGeometry.topInset, zIndex: 2,
  },
  button: { width: '100%', minHeight: forgeFloatingCtaGeometry.buttonHeight, borderRadius: 16 },
});
