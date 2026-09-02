import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeText as Text } from './ForgeText';
import { Icon } from './Icon';
import { lightHaptic, selectionHaptic } from './haptics';
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
  testID?: string;
}

/** Shared, accessible single-choice rows for Forge lists and sheets. */
export function ForgeSingleSelectList<T extends SelectionValue>({
  options,
  selectedValue,
  onSelect,
  onSelectedPress,
  maxVisibleRows = DEFAULT_MAX_VISIBLE_ROWS,
  testID,
}: ForgeSingleSelectListProps<T>) {
  const hasDescriptions = options.some((option) => option.description);
  const visibleRows = Math.min(options.length, Math.max(1, Math.min(DEFAULT_MAX_VISIBLE_ROWS, maxVisibleRows)));
  const virtualized = !hasDescriptions && options.length > visibleRows;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));
  const initialScrollIndex = Math.max(0, selectedIndex - Math.floor(visibleRows / 2));
  const renderOption = (option: ForgeSingleSelectOption<T>, index: number) => (
    <ForgeSelectionRow
      key={String(option.value)}
      option={option}
      selected={option.value === selectedValue}
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
  onSelect: (value: T) => void;
  onSelectedPress?: (value: T) => void;
  showSeparator: boolean;
}

function ForgeSelectionRow<T extends SelectionValue>({
  option,
  selected,
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
      {selected && <Icon name="check" size={22} color={theme.inkInteractive} weight="bold" />}
      {showSeparator && (
        <View
          pointerEvents="none"
          style={[styles.selectionSeparator, { backgroundColor: theme.divider }]}
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
  const theme = useForgeTheme();
  return (
    <ForgeBottomSheet visible={visible} onClose={onClose} accessibilityLabel={accessibilityLabel} testID={testID}>
      {() => (
        <View testID={testID ? `${testID}-surface` : undefined} style={styles.sheet}>
          <ForgeBottomSheetHandle />
          <View style={styles.sheetTitleRow}>
            <Text style={[styles.sheetTitle, { color: theme.textPrimary }]}>{title}</Text>
          </View>
          <ForgeSingleSelectList
            testID={listTestID}
            options={options}
            selectedValue={selectedValue}
            maxVisibleRows={maxVisibleRows}
            onSelect={(value) => {
              onSelect(value);
              onClose();
            }}
            onSelectedPress={onClose}
          />
        </View>
      )}
    </ForgeBottomSheet>
  );
}

interface ForgeListRowProps {
  label: string;
  value?: string;
  onPress: () => void;
  accessibilityLabel?: string;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Shared value/disclosure row for settings that open a selection surface. */
export function ForgeListRow({
  label,
  value,
  onPress,
  accessibilityLabel = label,
  divider = false,
  style,
}: ForgeListRowProps) {
  const theme = useForgeTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={value ? { text: value } : undefined}
      onPress={() => {
        lightHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.valueRow, style, pressed && { backgroundColor: theme.pressed }]}
    >
      <Text style={[styles.valueLabel, { color: theme.textPrimary }]}>{label}</Text>
      {value && <Text style={[styles.valueText, { color: theme.textSecondary }]}>{value}</Text>}
      <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
      {divider && <ForgeListSeparator inset />}
    </Pressable>
  );
}

export function ForgeListSeparator({ inset = false }: { inset?: boolean }) {
  const theme = useForgeTheme();
  return <View pointerEvents="none" style={[styles.separator, inset && styles.separatorInset, { backgroundColor: theme.divider }]} />;
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
  selectionSeparator: { position: 'absolute', height: StyleSheet.hairlineWidth, right: 20, bottom: 0, left: 20 },
  separator: { height: StyleSheet.hairlineWidth },
  separatorInset: { position: 'absolute', right: 18, bottom: 0, left: 18 },
  sheet: { flexShrink: 1 },
  sheetTitleRow: { minHeight: 56, paddingHorizontal: 20, justifyContent: 'center' },
  sheetTitle: { ...typeScale.headerTitle },
  valueRow: { minHeight: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  valueLabel: { flex: 1, minWidth: 0, ...typeScale.body },
  valueText: { ...typeScale.supporting, textAlign: 'right' },
});
