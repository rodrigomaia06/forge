import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ForgeText as Text } from './ForgeText';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';

const useNativeDriver = Platform.OS !== 'web';
const rollEasing = Easing.bezier(...forgeMotion.rollCurve);
const DIGIT = /\d/;
const GLYPH_KEYS = new Set<keyof TextStyle>([
  'color',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'includeFontPadding',
  'textShadowColor',
  'textShadowOffset',
  'textShadowRadius',
]);

/** Text metrics go to every glyph; layout (min width, margins, alignment) stays on the row. */
function splitStyle(style: StyleProp<TextStyle>) {
  const flat = StyleSheet.flatten(style) ?? {};
  const glyph: TextStyle = { fontVariant: ['tabular-nums'] };
  const row: ViewStyle = {};
  for (const [key, value] of Object.entries(flat)) {
    if (GLYPH_KEYS.has(key as keyof TextStyle)) (glyph as Record<string, unknown>)[key] = value;
    else if (key !== 'textAlign' && key !== 'fontVariant') (row as Record<string, unknown>)[key] = value;
  }
  if (flat.textAlign === 'center') row.justifyContent = 'center';
  if (flat.textAlign === 'right') row.justifyContent = 'flex-end';
  return { glyph, row };
}

function RollingDigit({
  digit,
  direction,
  style,
  reducedMotion,
}: {
  digit: string;
  direction: 1 | -1;
  style: TextStyle;
  reducedMotion: boolean;
}) {
  const [shown, setShown] = useState<{ current: string; previous: string | null; direction: 1 | -1 }>({
    current: digit,
    previous: null,
    direction,
  });
  const [height, setHeight] = useState(0);
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (digit === shown.current) return;
    if (reducedMotion || height === 0) {
      progress.setValue(1);
      setShown({ current: digit, previous: null, direction });
      return;
    }
    setShown({ current: digit, previous: shown.current, direction });
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: forgeMotion.roll,
      easing: rollEasing,
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished) setShown((value) => ({ ...value, previous: null }));
    });
    // Only a new digit starts a roll; the remaining values are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digit]);

  const travel = height * shown.direction;
  return (
    <View style={styles.digit}>
      <Animated.View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={{
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] }) }],
        }}
      >
        <Text style={style}>{shown.current}</Text>
      </Animated.View>
      {shown.previous !== null ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] }) }],
            },
          ]}
        >
          <Text style={style}>{shown.previous}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * A numeric readout whose changed digits roll into place: upward when the value
 * grows, downward when it shrinks. Unchanged digits stay still; Reduce Motion swaps
 * values immediately. The whole value is one accessible text element.
 */
export function ForgeRollingNumber({
  value,
  style,
  testID,
  accessibilityLabel,
}: {
  value: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const reducedMotion = useForgeReducedMotion();
  const { glyph, row } = splitStyle(style);
  const numeric = Number(value.replace(/\D/g, '') || 0);
  const previousNumeric = useRef(numeric);
  const direction: 1 | -1 = numeric >= previousNumeric.current ? 1 : -1;
  useEffect(() => {
    previousNumeric.current = numeric;
  }, [numeric]);
  const chars = [...value];
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? value}
      style={[styles.row, row]}
    >
      {chars.map((char, index) => {
        // Key from the right so digits keep their identity when the value gains a place.
        const key = chars.length - index;
        return DIGIT.test(char) ? (
          <RollingDigit key={key} digit={char} direction={direction} style={glyph} reducedMotion={reducedMotion} />
        ) : (
          <Text key={key} style={glyph}>
            {char}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  digit: { overflow: 'hidden' },
});
