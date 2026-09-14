import React from 'react';
import { FlatList, Pressable, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForgeText as Text } from './ForgeText';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { Icon } from './Icon';
import { selectionHaptic } from './haptics';
import { pressedFeedback } from './pressFeedback';

type SelectionValue = string | number;

const SELECTION_ROW_HEIGHT = 52;
const DEFAULT_MAX_VISIBLE_ROWS = 6;

export interface ForgeSingleSelectOption<T extends SelectionValue> {
  value: T;
  label: string;
  description?: string;
  emphasized?: boolean;
  accessibilityLabel?: string;
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
  const renderOption = (option: ForgeSingleSelectOption<T>, index: number) => (
    <ForgeSelectionRow
      key={String(option.value)}
      option={option}
      selected={option.value === selectedValue}
      selectedTone={selectedTone}
      onSelect={onSelect}
      onSelectedPress={onSelectedPress}
      showSeparator={index < options.length - 1}
    />
  );

  if (virtualized) {
    return (
      <View
        testID={testID}
        accessibilityRole="radiogroup"
        style={[styles.listViewport, { height: visibleRows * SELECTION_ROW_HEIGHT }]}
      >
        <FlatList
          style={styles.virtualizedList}
          data={options}
          extraData={selectedValue}
          renderItem={({ item, index }: ListRenderItemInfo<ForgeSingleSelectOption<T>>) =>
            renderOption(item, index)
          }
          keyExtractor={(item) => String(item.value)}
          getItemLayout={(_, index) => ({
            length: SELECTION_ROW_HEIGHT,
            offset: SELECTION_ROW_HEIGHT * index,
            index,
          })}
          initialScrollIndex={initialScrollIndex}
          initialNumToRender={visibleRows + 2}
          showsVerticalScrollIndicator
          accessibilityLabel="Selection options"
        />
      </View>
    );
  }

  return (
    <View testID={testID} accessibilityRole="radiogroup">
      {options.map(renderOption)}
    </View>
  );
}

interface ForgeSelectionRowProps<T extends SelectionValue> {
  option: ForgeSingleSelectOption<T>;
  selected: boolean;
  selectedTone: 'neutral' | 'success';
  onSelect: (value: T) => void;
  onSelectedPress?: (value: T) => void;
  showSeparator: boolean;
}

function ForgeSelectionRow<T extends SelectionValue>({
  option,
  selected,
  selectedTone,
  onSelect,
  onSelectedPress,
  showSeparator,
}: ForgeSelectionRowProps<T>) {
  const theme = useForgeTheme();
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
      style={({ pressed }) => [
        styles.selectionRow,
        selected && selectedTone === 'success' && { backgroundColor: theme.successSurface },
        pressed && pressedFeedback,
      ]}
    >
      <View style={styles.selectionCopy}>
        <Text
          style={[
            styles.selectionLabel,
            option.emphasized && styles.selectionLabelEmphasized,
            { color: theme.textPrimary },
          ]}
        >
          {option.label}
        </Text>
        {option.description && (
          <Text style={[styles.selectionDescription, { color: theme.textSecondary }]}>
            {option.description}
          </Text>
        )}
      </View>
      {selected && <Icon name="check" size={22} color={selectedTone === 'success' ? theme.success : theme.selectionIndicator} weight="bold" />}
      {showSeparator && (
        <View
          style={[
            styles.selectionSeparator,
            { backgroundColor: theme.divider, pointerEvents: 'none' },
          ]}
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
  testID,
  listTestID,
}: ForgeSelectionSheetProps<T>) {
  const insets = useSafeAreaInsets();
  const theme = useForgeTheme();
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
          <View style={[styles.optionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ForgeSingleSelectList
              testID={listTestID}
              options={options}
              selectedValue={selectedValue}
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
  selectionRow: {
    height: SELECTION_ROW_HEIGHT,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectionCopy: { flex: 1, minWidth: 0, gap: 2 },
  selectionLabel: { ...typeScale.body },
  selectionLabelEmphasized: { fontFamily: typeScale.display.fontFamily, fontWeight: '700' },
  selectionDescription: { ...typeScale.supporting },
  selectionSeparator: {
    position: 'absolute',
    height: StyleSheet.hairlineWidth,
    right: 20,
    bottom: 0,
    left: 20,
  },
  sheet: { flexShrink: 1, paddingHorizontal: 16 },
  optionCard: { overflow: 'hidden', borderWidth: 1, borderRadius: 16 },
});
