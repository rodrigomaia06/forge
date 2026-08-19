import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { DockSurface } from './DockSurface';
import { dashboardTheme } from '../theme/dashboardTheme';

export function DockChrome({
  theme = dashboardTheme,
  style,
  slotRef,
  onLayout,
  slotTestID,
  cylinderRef,
  cylinderOnLayout,
  cylinderTestID,
  vignetteTestID,
  indicatorTestID,
}) {
  const gradientId = `dockFade${slotTestID || cylinderTestID || 'shared'}`.replace(/[^a-zA-Z0-9]/g, '');
  return <View ref={slotRef} onLayout={onLayout} testID={slotTestID} pointerEvents="box-none" style={[styles.slot, style]}>
    <Svg pointerEvents="none" testID={vignetteTestID} style={styles.vignette}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={theme.background} stopOpacity="0" />
          <Stop offset="0.3" stopColor={theme.background} stopOpacity="0.42" />
          <Stop offset="0.56" stopColor={theme.background} stopOpacity="0.82" />
          <Stop offset="1" stopColor={theme.background} stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
    <DockSurface theme={theme} dockRef={cylinderRef} onLayout={cylinderOnLayout} testID={cylinderTestID} />
    <View testID={indicatorTestID} accessibilityLabel="Home indicator" style={[styles.indicator, { backgroundColor: theme.ink }]} />
  </View>;
}

const styles = StyleSheet.create({
  slot: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10, zIndex: 10 },
  vignette: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 68, zIndex: 0 },
  indicator: { position: 'absolute', bottom: 2, width: 88, height: 4, borderRadius: 1000, opacity: 0.72, zIndex: 12 },
});
