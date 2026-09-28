import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { REST_DURATION_OPTIONS } from '../../domain/rest/restDurationOptions';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { ForgeWheelColumn } from './ForgeWheelColumn';

/** mm:ss for a duration in seconds. */
export function formatDurationValue(seconds: number): string {
  const absolute = Math.abs(seconds);
  return `${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

/**
 * The rest-duration picker: the shared Forge wheel bound to the rest options.
 * Used by the rest-timer overlay, the rest override sheets, and the rest-time
 * settings sheet so every duration is picked one way.
 */
export function ForgeDurationWheel({
  selectedDuration,
  onSelect,
  options = REST_DURATION_OPTIONS as readonly number[],
}: {
  selectedDuration: number;
  onSelect: (duration: number) => void;
  options?: readonly number[];
}) {
  return (
    <View style={styles.wheel}>
      <ForgeWheelColumn
        options={options}
        selectedValue={selectedDuration}
        onSelect={onSelect}
        formatValue={formatDurationValue}
        accessibilityLabel={(value) => `Rest duration ${formatDurationValue(value)}`}
      />
    </View>
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
      accessibilityLabel={`Dismiss ${title.toLowerCase()} picker`}
      testID={testID}
      dragEnabled={false}
    >
      {(close) => (
        <View testID={`${testID}-surface`} style={[sheetStyles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader title={title} onClose={close} closeAccessibilityLabel={`Close ${title.toLowerCase()} picker`} />
          <ForgeDurationWheel selectedDuration={selectedDuration} onSelect={onSelect} />
        </View>
      )}
    </ForgeBottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: { paddingHorizontal: 16 },
});

const styles = StyleSheet.create({
  // A little breathing room below the wheel so the last row never sits flush
  // against the sheet's bottom edge.
  wheel: { marginTop: 8, marginBottom: 16, marginHorizontal: 20 },
});
