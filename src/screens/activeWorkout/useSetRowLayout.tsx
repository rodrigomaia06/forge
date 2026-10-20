import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { ForgeText } from '../../components/ui/ForgeText';
import { typeScale } from '../../theme/tokens';
import { scaleUI } from '../../theme/scale';

/** Measure scaled text rather than approximating the platform's font curve. */
export function useSetRowLayout(fieldCount: number, showPrevious: boolean) {
  const [width, setWidth] = useState(0);
  const [cellWidth, setCellWidth] = useState(scaleUI(60));
  const required = (fieldCount + (showPrevious ? 1 : 0)) * cellWidth + 90 + (fieldCount + 2) * scaleUI(6);
  const stacked = width > 0 && required > width;
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const probe = <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.probe}>
    <ForgeText style={typeScale.body} onLayout={event => setCellWidth(Math.max(scaleUI(60), event.nativeEvent.layout.width + scaleUI(12)))}>0000.0</ForgeText>
  </View>;
  return { stacked, onLayout, probe };
}
const styles = StyleSheet.create({ probe: { position: 'absolute', top: 0, left: 0, opacity: 0, alignItems: 'flex-start' } });
