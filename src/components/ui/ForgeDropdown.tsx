import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { ForgeCard } from './ForgeCard';
import { ForgeSingleSelectList, type ForgeSingleSelectOption } from './ForgeSelection';
import { ForgePressable } from './ForgePressable';
import { scaleUI } from '../../theme/scale';
import { ForgeText as Text } from './ForgeText';
import { typeScale } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { forgeMotion, useForgeReducedMotion } from '../../theme/motion';

/**
 * The menu grows from its trigger: a short fade with a slight scale from 0.96 (never
 * from zero) around the corner nearest the button. Closing stays immediate so the
 * dismissal takes effect from the tap itself.
 */
function menuEntering() {
  'worklet';
  const config = { duration: forgeMotion.state, easing: forgeMotion.easing };
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.96 }] },
    animations: { opacity: withTiming(1, config), transform: [{ scale: withTiming(1, config) }] },
  };
}

/** A bounded choice menu anchored to its shared Forge button. */
export function ForgeDropdown<T extends string>({
  label,
  accessibilityLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  accessibilityLabel: string;
  options: readonly ForgeSingleSelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const anchor = useRef<View>(null);
  const theme = useForgeTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [contentWidth, setContentWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const reducedMotion = useForgeReducedMotion();
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(
    null,
  );
  const [opensAbove, setOpensAbove] = useState(false);
  useEffect(() => { if (position) open(); }, [width, height, fontScale, contentWidth, contentHeight]);
  const close = () => setPosition(null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
      const edge = scaleUI(20);
      const menuWidth = Math.min(Math.max(anchorWidth, Math.ceil(contentWidth)), width - edge * 2);
      const menuHeight = Math.min(contentHeight || Math.min(options.length, 6) * scaleUI(60) + scaleUI(24), height - insets.top - insets.bottom - edge * 2);
      const below = y + anchorHeight + scaleUI(8);
      const fitsBelow = below + menuHeight <= height - insets.bottom - edge;
      const top = fitsBelow ? below : Math.max(insets.top + edge, y - menuHeight - scaleUI(8));
      setOpensAbove(!fitsBelow);
      setPosition({
        left: Math.max(edge, Math.min(x + anchorWidth - menuWidth, width - menuWidth - edge)),
        top,
        width: menuWidth,
      });
    });
  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Button
          label={label}
          accessibilityLabel={accessibilityLabel}
          icon="chevron-down"
          variant="secondary"
          onPress={open}
        />
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={styles.measurementClip}
        >
          <View style={{ width: width - scaleUI(40), alignItems: 'flex-start' }}>
            <View
              style={styles.measurement}
              onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
            >
              {options.map((option) => (
                <View key={String(option.value)} style={styles.measurementRow}>
                  {option.leading}
                  <View style={styles.measurementCopy}>
                    <Text style={[typeScale.controlLabel, option.emphasized && styles.emphasized]}>
                      {option.label}
                    </Text>
                    {option.description ? (
                      <Text style={typeScale.supporting}>{option.description}</Text>
                    ) : null}
                  </View>
                  <View style={{ width: 22 }} />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
      <Modal
        transparent
        visible={position !== null}
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <ForgePressable
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay, opacity: 0.35 }]}
            accessibilityRole="button"
            accessibilityLabel={`Close ${accessibilityLabel.toLowerCase()} menu`}
            onPress={close}
            pressFeedbackStyle={{ backgroundColor: 'transparent' }}
          />
          {position ? (
            <Animated.View
              testID="forge-dropdown-panel"
              entering={reducedMotion ? undefined : menuEntering}
              style={[
                styles.menu,
                {
                  backgroundColor: theme.surfaceElevated,
                  // A floating menu sits clearly above the cards: a tight contact shadow
                  // plus a wide ambient one, both soft and ink-tinted rather than one
                  // heavy pure-black blur (Dark needs more opacity to read at all).
                  boxShadow: theme.colorScheme === 'dark'
                    ? [
                        { offsetX: 0, offsetY: 2, blurRadius: 4, color: `${theme.shadow}4D` },
                        { offsetX: 0, offsetY: 12, blurRadius: 32, color: `${theme.shadow}66` },
                      ]
                    : [
                        { offsetX: 0, offsetY: 2, blurRadius: 4, color: `${theme.shadow}1A` },
                        { offsetX: 0, offsetY: 12, blurRadius: 32, color: `${theme.shadow}14` },
                      ],
                },
                position,
                {
                  maxHeight: height - position.top - insets.bottom - scaleUI(20),
                  // Right-aligned to its trigger, so it grows from the trigger-side corner.
                  transformOrigin: opensAbove ? 'right bottom' : 'right top',
                },
              ]}
              accessibilityLabel={`${accessibilityLabel} choices`}
            >
              <ForgeCard variant="nested" size="compact" style={styles.choices}>
                <ScrollView style={{ flexShrink: 1 }} onContentSizeChange={(_width, nextHeight) => setContentHeight(nextHeight)}><ForgeSingleSelectList
                  disableVirtualization
                  embedded
                  appearance="menu"
                  options={options}
                  selectedValue={value}
                  onSelect={(next) => {
                    onChange(next);
                    close();
                  }}
                  onSelectedPress={close}
                /></ScrollView>
              </ForgeCard>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    flexShrink: 1,
    borderRadius: scaleUI(18),
  },
  choices: { flexShrink: 1 },
  measurementClip: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' },
  measurement: {
    alignItems: 'flex-start',
    padding: scaleUI(6),
  },
  measurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: scaleUI(12),
  },
  measurementCopy: { flexShrink: 1 },
  emphasized: { fontFamily: typeScale.display.fontFamily, fontWeight: '700' },
});
