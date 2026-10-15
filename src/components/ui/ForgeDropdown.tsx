import React, { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { ForgeCard } from './ForgeCard';
import { ForgeSingleSelectList, type ForgeSingleSelectOption } from './ForgeSelection';
import { ForgePressable } from './ForgePressable';
import { scaleUI } from '../../theme/scale';
import { ForgeText as Text } from './ForgeText';
import { typeScale } from '../../theme/tokens';

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
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [contentWidth, setContentWidth] = useState(0);
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(
    null,
  );
  useEffect(() => setPosition(null), [width, height]);
  const close = () => setPosition(null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, anchorWidth, anchorHeight) => {
      const edge = scaleUI(20);
      const menuWidth = Math.min(Math.max(anchorWidth, Math.ceil(contentWidth)), width - edge * 2);
      const menuHeight = Math.min(options.length, 6) * scaleUI(60) + scaleUI(24);
      const below = y + anchorHeight + scaleUI(8);
      const top =
        below + menuHeight <= height - insets.bottom - edge
          ? below
          : Math.max(insets.top + edge, y - menuHeight - scaleUI(8));
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
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel={`Close ${accessibilityLabel.toLowerCase()} menu`}
            onPress={close}
            pressFeedbackStyle={{ backgroundColor: 'transparent' }}
          />
          {position ? (
            <View
              style={[
                styles.menu,
                position,
                { maxHeight: height - position.top - insets.bottom - scaleUI(20) },
              ]}
              accessibilityLabel={`${accessibilityLabel} choices`}
            >
              <ForgeCard size="compact" style={styles.choices}>
                <ForgeSingleSelectList
                  embedded
                  appearance="menu"
                  options={options}
                  selectedValue={value}
                  onSelect={(next) => {
                    onChange(next);
                    close();
                  }}
                  onSelectedPress={close}
                />
              </ForgeCard>
            </View>
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menu: { position: 'absolute', flexShrink: 1 },
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
