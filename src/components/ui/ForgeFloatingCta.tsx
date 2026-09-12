import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ForgeTheme, IconName } from '../../types';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { Button } from './Button';

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
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
  tone?: 'neutral' | 'success' | 'destructive';
  theme?: ForgeTheme;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const contextTheme = useForgeTheme();
  const resolvedTheme = theme ?? contextTheme;
  return (
    <>
      <View style={[styles.fade, { pointerEvents: 'none' }]}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="forgeFloatingCtaFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={resolvedTheme.surfaceElevated} stopOpacity="0" />
              <Stop offset="0.38" stopColor={resolvedTheme.surfaceElevated} stopOpacity="0.48" />
              <Stop offset="0.72" stopColor={resolvedTheme.surfaceElevated} stopOpacity="0.9" />
              <Stop offset="1" stopColor={resolvedTheme.surfaceElevated} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#forgeFloatingCtaFade)" />
        </Svg>
      </View>
      <Animated.View style={[styles.dock, { paddingBottom: Math.max(8, insets.bottom - 4) }, style]}>
        <Button
          label={label}
          accessibilityLabel={accessibilityLabel}
          disabled={disabled}
          onPress={onPress}
          theme={resolvedTheme}
          icon={icon}
          variant="outline"
          tone={tone}
          style={styles.button}
        />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fade: { position: 'absolute', right: 0, bottom: 0, left: 0, height: 142, zIndex: 1 },
  dock: { position: 'absolute', right: 20, bottom: 0, left: 20, paddingTop: 8, zIndex: 2 },
  button: { width: '100%', minHeight: 46, borderRadius: 16 },
});
