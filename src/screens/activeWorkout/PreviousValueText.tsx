import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { ForgeText } from '../../components/ui/ForgeText';

/** Below this the value ellipsizes rather than becoming unreadably small. */
const MINIMUM_SCALE = 0.7;
/** Values this short (`20 × 8`, `—`) always fit the narrowest column. */
const ALWAYS_FITS_LENGTH = 8;
/** Natural widths by font and text, so each distinct value is measured once. */
const naturalWidths = new Map<string, number>();

/**
 * A Previous column value on one line. A long value (`5 km × 30:00`) steps its
 * font size down to the column width instead of wrapping; the row height and
 * line height stay unchanged. It measures the natural width with a hidden
 * copy, so the same fit applies on iOS, Android and web.
 */
export function PreviousValueText({
  children,
  style,
  textStyle,
}: {
  children: string;
  /** Layout of the column (flex, basis). */
  style?: StyleProp<ViewStyle>;
  /** Typography of the value; its `fontSize` is the size used when it fits. */
  textStyle: StyleProp<TextStyle>;
}) {
  const flat = StyleSheet.flatten(textStyle);
  const fontSize = flat?.fontSize ?? 16;
  const key = `${flat?.fontFamily ?? ''}|${fontSize}|${children}`;
  const fits = children.length <= ALWAYS_FITS_LENGTH;
  const [available, setAvailable] = useState(0);
  const [natural, setNatural] = useState(() => naturalWidths.get(key) ?? 0);
  const measured = naturalWidths.get(key) ?? natural;
  const scale = !fits && available > 0 && measured > available ? Math.max(MINIMUM_SCALE, available / measured) : 1;
  return (
    <View style={[styles.column, style]} onLayout={fits ? undefined : (event) => setAvailable(event.nativeEvent.layout.width)}>
      <ForgeText numberOfLines={1} ellipsizeMode="tail" style={[textStyle, scale < 1 && { fontSize: fontSize * scale }]}>
        {children}
      </ForgeText>
      {fits || naturalWidths.has(key) ? null : <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
        style={styles.probeClip}
      >
        <View style={styles.probeRow}>
          <ForgeText
            style={textStyle}
            onLayout={(event) => {
              naturalWidths.set(key, event.nativeEvent.layout.width);
              setNatural(event.nativeEvent.layout.width);
            }}
          >
            {children}
          </ForgeText>
        </View>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { minWidth: 0, justifyContent: 'center' },
  // A zero-size clip keeps the unconstrained copy from widening the page.
  probeClip: { position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'hidden', opacity: 0 },
  probeRow: { width: 10000, flexDirection: 'row', alignItems: 'flex-start' },
});
