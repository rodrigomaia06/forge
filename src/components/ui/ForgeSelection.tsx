import { ForgePressable as Pressable } from './ForgePressable';
import React from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForgeText as Text } from './ForgeText';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { Icon } from './Icon';
import { selectionHaptic } from './haptics';
import { resolveForgeControlFill, useForgeControlSurface } from './ForgeControlSurface';

type SelectionValue = string | number;

const SELECTION_ROW_HEIGHT = 52;
const SELECTION_ROW_GAP = 8;
const SELECTION_ROW_PITCH = SELECTION_ROW_HEIGHT + SELECTION_ROW_GAP;
const DEFAULT_MAX_VISIBLE_ROWS = 6;

export interface ForgeSingleSelectOption<T extends SelectionValue> {
  value: T;
  label: string;
  description?: string;
  emphasized?: boolean;
  accessibilityLabel?: string;
  leading?: React.ReactNode;
}

interface ForgeSingleSelectListProps<T extends SelectionValue> {
  options: readonly ForgeSingleSelectOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  onSelectedPress?: (value: T) => void;
  maxVisibleRows?: number;
  /** Use when this control lives inside an existing vertical ScrollView. */
  disableVirtualization?: boolean;
  /** A contextual selection can use Forge's success treatment without
   * changing the neutral treatment used by ordinary settings. */
  selectedTone?: 'neutral' | 'success';
  /** Retained for callers; all choices now use rounded tonal surfaces. */
  rounded?: boolean;
  /** Retained for callers; spacing separates the individual choice surfaces. */
  showSeparators?: boolean;
  testID?: string;
}

/** Shared, accessible single-choice rows for Forge lists and sheets. */
export function ForgeSingleSelectList<T extends SelectionValue>({
  options,
  selectedValue,
  onSelect,
  onSelectedPress,
  maxVisibleRows = DEFAULT_MAX_VISIBLE_ROWS,
  disableVirtualization = false,
  selectedTone = 'neutral',
  testID,
}: ForgeSingleSelectListProps<T>) {
  const hasDescriptions = options.some((option) => option.description);
  const visibleRows = Math.min(
    options.length,
    Math.max(1, Math.min(DEFAULT_MAX_VISIBLE_ROWS, maxVisibleRows)),
  );
  // A FlatList inside a form ScrollView steals its parent scroll gesture and
  // triggers React Native's nested-virtualized-list warning. Forms are small,
  // so render their choices directly; standalone sheets retain windowing.
  const virtualized = !disableVirtualization && !hasDescriptions && options.length > visibleRows;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );
  const initialScrollIndex = Math.max(0, selectedIndex - Math.floor(visibleRows / 2));
  const renderOption = (option: ForgeSingleSelectOption<T>) => (
    <ForgeSelectionRow
      key={String(option.value)}
      option={option}
      selected={option.value === selectedValue}
      selectedTone={selectedTone}
      fixedHeight={virtualized}
      onSelect={onSelect}
      onSelectedPress={onSelectedPress}
    />
  );

  if (virtualized) {
    return (
      <View
        testID={testID}
        accessibilityRole="radiogroup"
        style={[
          styles.listViewport,
          { height: visibleRows * SELECTION_ROW_PITCH - SELECTION_ROW_GAP },
        ]}
      >
        <FlatList
          style={styles.virtualizedList}
          data={options}
          extraData={selectedValue}
          renderItem={({ item }: ListRenderItemInfo<ForgeSingleSelectOption<T>>) =>
            renderOption(item)
          }
          keyExtractor={(item) => String(item.value)}
          getItemLayout={(_, index) => ({
            length: SELECTION_ROW_HEIGHT,
            offset: SELECTION_ROW_PITCH * index,
            index,
          })}
          initialScrollIndex={initialScrollIndex}
          initialNumToRender={visibleRows + 2}
          ItemSeparatorComponent={() => <View style={styles.rowGap} />}
          showsVerticalScrollIndicator
          accessibilityLabel="Selection options"
        />
      </View>
    );
  }

  return (
    <View testID={testID} accessibilityRole="radiogroup" style={styles.choices}>
      {options.map(renderOption)}
    </View>
  );
}

interface ForgeSelectionRowProps<T extends SelectionValue> {
  option: ForgeSingleSelectOption<T>;
  selected: boolean;
  selectedTone: 'neutral' | 'success';
  fixedHeight: boolean;
  onSelect: (value: T) => void;
  onSelectedPress?: (value: T) => void;
}

function ForgeSelectionRow<T extends SelectionValue>({
  option,
  selected,
  selectedTone,
  fixedHeight,
  onSelect,
  onSelectedPress,
}: ForgeSelectionRowProps<T>) {
  const theme = useForgeTheme();
  const parentSurface = useForgeControlSurface();
  const neutralSelected = selected && selectedTone === 'neutral';
  const foreground = neutralSelected ? theme.onActionPrimary : theme.textPrimary;
  const backgroundColor = selected
    ? selectedTone === 'success'
      ? theme.successSurface
      : theme.actionPrimary
    : resolveForgeControlFill(theme, parentSurface);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.accessibilityLabel ?? option.label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={() => {
        if (selected) {
          onSelectedPress?.(option.value);
          return;
        }
        selectionHaptic();
        onSelect(option.value);
      }}
      unstable_pressDelay={80}
      style={[styles.selectionRow, fixedHeight && styles.fixedSelectionRow, { backgroundColor }]}
    >
      {option.leading ? <View style={{ marginRight: scaleUI(12) }}>{option.leading}</View> : null}
      <View style={styles.selectionCopy}>
        <Text
          numberOfLines={fixedHeight ? 1 : undefined}
          style={[
            styles.selectionLabel,
            option.emphasized && styles.selectionLabelEmphasized,
            { color: foreground },
          ]}
        >
          {option.label}
        </Text>
        {option.description && (
          <Text
            style={[
              styles.selectionDescription,
              { color: neutralSelected ? theme.onActionPrimary : theme.textSecondary },
            ]}
          >
            {option.description}
          </Text>
        )}
      </View>
      {selected && (
        <Icon
          name="check"
          size={22}
          color={selectedTone === 'success' ? theme.success : theme.onActionPrimary}
          weight="bold"
        />
      )}
    </Pressable>
  );
}

interface ForgeSelectionSheetProps<T extends SelectionValue> {
  visible: boolean;
  onClose: () => void;
  accessibilityLabel: string;
  title: string;
  options: readonly ForgeSingleSelectOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  maxVisibleRows?: number;
  selectedTone?: 'neutral' | 'success';
  testID?: string;
  listTestID?: string;
}

/** A Forge sheet that owns modal presentation for a standalone single-choice setting. */
export function ForgeSelectionSheet<T extends SelectionValue>({
  visible,
  onClose,
  accessibilityLabel,
  title,
  options,
  selectedValue,
  onSelect,
  maxVisibleRows = DEFAULT_MAX_VISIBLE_ROWS,
  selectedTone = 'neutral',
  testID,
  listTestID,
}: ForgeSelectionSheetProps<T>) {
  const insets = useSafeAreaInsets();
  return (
    <ForgeBottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {(close) => (
        <View
          testID={testID ? `${testID}-surface` : undefined}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
        >
          <ForgeBottomSheetHandle />
          <ForgeSheetHeader title={title} onClose={close} />
          <View style={styles.optionCard}>
            <ForgeSingleSelectList
              testID={listTestID}
              options={options}
              selectedValue={selectedValue}
              selectedTone={selectedTone}
              maxVisibleRows={maxVisibleRows}
              onSelect={(value) => {
                onSelect(value);
                close();
              }}
              onSelectedPress={close}
            />
          </View>
        </View>
      )}
    </ForgeBottomSheet>
  );
}

const styles = StyleSheet.create({
  listViewport: { overflow: 'hidden' },
  virtualizedList: { flex: 1 },
  choices: { gap: SELECTION_ROW_GAP },
  rowGap: { height: SELECTION_ROW_GAP },
  selectionRow: {
    minHeight: SELECTION_ROW_HEIGHT,
    paddingHorizontal: scaleUI(16),
    paddingVertical: scaleUI(12),
    borderRadius: scaleUI(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fixedSelectionRow: { height: SELECTION_ROW_HEIGHT, paddingVertical: 0 },
  selectionCopy: { flex: 1, minWidth: 0, gap: 2 },
  selectionLabel: { ...typeScale.body },
  selectionLabelEmphasized: { fontFamily: typeScale.display.fontFamily, fontWeight: '700' },
  selectionDescription: { ...typeScale.supporting },
  sheet: { flexShrink: 1, paddingHorizontal: 16 },
  optionCard: { paddingTop: 4 },
});
