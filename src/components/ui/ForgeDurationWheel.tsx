import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WheelPicker, { type ValueChangedEvent } from '@quidone/react-native-wheel-picker';

import { REST_DURATION_OPTIONS } from '../../domain/rest/restDurationOptions';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { selectionHaptic } from './haptics';

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 7;

/** mm:ss for a duration in seconds. */
export function formatDurationValue(seconds: number): string {
  const absolute = Math.abs(seconds);
  return `${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

type DurationItem = { value: number; label: string };

const REST_ITEMS: DurationItem[] = REST_DURATION_OPTIONS.map((seconds) => ({
  value: seconds,
  label: formatDurationValue(seconds),
}));

/**
 * The single Forge wheel picker: an iOS-style drum wheel (smooth native-scroll
 * momentum via @quidone/react-native-wheel-picker) shared by the rest-timer
 * overlay, the rest override sheets, and the rest-time settings sheet.
 */
export function ForgeDurationWheel({
  selectedDuration,
  onSelect,
  options,
}: {
  selectedDuration: number;
  onSelect: (duration: number) => void;
  options?: readonly number[];
}) {
  const theme = useForgeTheme();
  const data = React.useMemo<DurationItem[]>(
    () => (options ? options.map((seconds) => ({ value: seconds, label: formatDurationValue(seconds) })) : REST_ITEMS),
    [options],
  );
  return (
    <WheelPicker
      data={data}
      value={selectedDuration}
      itemHeight={ITEM_HEIGHT}
      visibleItemCount={VISIBLE_ITEMS}
      width="100%"
      enableScrollByTapOnItem
      onValueChanged={({ item }: ValueChangedEvent<DurationItem>) => {
        selectionHaptic();
        onSelect(item.value);
      }}
      itemTextStyle={{ color: theme.ink, ...typeScale.metricMedium }}
      overlayItemStyle={{ backgroundColor: theme.surfaceMuted, borderRadius: 12, marginHorizontal: 20 }}
    />
  );
}

/** A Forge bottom sheet that presents the duration wheel as a standalone picker. */
export function ForgeRestDurationSheet({
  visible,
  onClose,
  title,
  selectedDuration,
  onSelect,
  testID = 'rest-duration-sheet',
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  selectedDuration: number;
  onSelect: (duration: number) => void;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={`Close ${title.toLowerCase()} picker`}
      testID={testID}
      dragEnabled={false}
    >
      {(close) => (
        <View testID={`${testID}-surface`} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader title={title} compactTitle onClose={close} closeAccessibilityLabel={`Close ${title.toLowerCase()} picker`} />
          <View style={styles.wheelWrap}>
            <ForgeDurationWheel selectedDuration={selectedDuration} onSelect={onSelect} />
          </View>
        </View>
      )}
    </ForgeBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 16 },
  wheelWrap: { paddingTop: 4 },
});
