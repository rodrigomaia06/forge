import { ForgePressable as Pressable } from './ForgePressable';
import React from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';

import { useForgeTheme } from '../../theme/ThemeProvider';
import { scaleUI } from '../../theme/scale';
import { typeScale } from '../../theme/tokens';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForgeCard } from './ForgeCard';
import { ForgeText as Text } from './ForgeText';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { Icon } from './Icon';
import { selectionHaptic } from './haptics';
import { resolveForgeControlFill, useForgeControlSurface } from './ForgeControlSurface';

type SelectionValue = string | number;

const SELECTION_ROW_HEIGHT = 52;
const SELECTION_ROW_GAP = StyleSheet.hairlineWidth;
const MENU_ROW_HEIGHT = 44;
const MENU_ROW_GAP = 2;
const MENU_INSET = scaleUI(6);
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
  /** Omit the outer card when an existing grouped card owns the surface. */
  embedded?: boolean;
  /** Anchored menus use compact inset rows rather than connected sheet choices. */
  appearance?: 'list' | 'menu';
  /** Retained for callers; the connected group owns its outer corners. */
  rounded?: boolean;
  /** Retained for callers; connected choices always have inset dividers. */
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
  embedded = false,
  appearance = 'list',
}: ForgeSingleSelectListProps<T>) {
  const theme = useForgeTheme();
  const menu = appearance === 'menu';
  const rowHeight = menu ? MENU_ROW_HEIGHT : SELECTION_ROW_HEIGHT;
  const rowGap = menu ? MENU_ROW_GAP : SELECTION_ROW_GAP;
  const rowPitch = rowHeight + rowGap;
  const divider = menu ? (
    <View style={{ height: rowGap }} />
  ) : (
    <View style={[styles.rowDivider, { backgroundColor: theme.divider }]} />
  );
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
      menu={menu}
      fixedHeight={virtualized}
      onSelect={onSelect}
      onSelectedPress={onSelectedPress}
    />
  );

  const surface = (children: React.ReactNode) =>
    embedded ? (
      <View style={[virtualized && styles.virtualizedList, menu && styles.menuInset]}>
        {children}
      </View>
    ) : (
      <ForgeCard
        size="compact"
        style={[virtualized && styles.virtualizedList, menu && styles.menuInset]}
      >
        {children}
      </ForgeCard>
    );

  if (virtualized) {
    return (
      <View
        testID={testID}
        accessibilityRole="radiogroup"
        style={[
          styles.listViewport,
          { height: visibleRows * rowPitch - rowGap + (menu ? MENU_INSET * 2 : 0) },
        ]}
      >
        {surface(
          <FlatList
            style={styles.virtualizedList}
            data={options}
            extraData={selectedValue}
            renderItem={({ item }: ListRenderItemInfo<ForgeSingleSelectOption<T>>) =>
              renderOption(item)
            }
            keyExtractor={(item) => String(item.value)}
            getItemLayout={(_, index) => ({
              length: rowHeight,
              offset: rowPitch * index,
              index,
            })}
            initialScrollIndex={initialScrollIndex}
            initialNumToRender={visibleRows + 2}
            ItemSeparatorComponent={() => divider}
            showsVerticalScrollIndicator
            accessibilityLabel="Selection options"
          />,
        )}
      </View>
    );
  }

  return (
    <View testID={testID} accessibilityRole="radiogroup">
      {surface(
        options.map((option, index) => (
          <React.Fragment key={String(option.value)}>
            {index > 0 ? divider : null}
            {renderOption(option)}
          </React.Fragment>
        )),
      )}
    </View>
  );
}

interface ForgeSelectionRowProps<T extends SelectionValue> {
  option: ForgeSingleSelectOption<T>;
  selected: boolean;
  selectedTone: 'neutral' | 'success';
  fixedHeight: boolean;
  menu: boolean;
  onSelect: (value: T) => void;
  onSelectedPress?: (value: T) => void;
}

function ForgeSelectionRow<T extends SelectionValue>({
  option,
  selected,
  selectedTone,
  fixedHeight,
  menu,
  onSelect,
  onSelectedPress,
}: ForgeSelectionRowProps<T>) {
  const theme = useForgeTheme();
  const parentSurface = useForgeControlSurface();
  const neutralSelected = selected && selectedTone === 'neutral' && !menu;
  const foreground = neutralSelected ? theme.onActionPrimary : theme.textPrimary;
  const backgroundColor = menu
    ? selected
      ? resolveForgeControlFill(theme, parentSurface)
      : 'transparent'
    : selected
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
      style={[
        styles.selectionRow,
        fixedHeight && styles.fixedSelectionRow,
        menu && styles.menuRow,
        menu && fixedHeight && { height: MENU_ROW_HEIGHT, paddingVertical: 0 },
        { backgroundColor },
      ]}
    >
      {option.leading ? <View style={{ marginRight: scaleUI(12) }}>{option.leading}</View> : null}
      <View style={styles.selectionCopy}>
        <Text
          numberOfLines={fixedHeight ? 1 : undefined}
          style={[
            styles.selectionLabel,
            menu && styles.menuLabel,
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
          color={
            menu
              ? theme.textPrimary
              : selectedTone === 'success'
                ? theme.success
                : theme.onActionPrimary
          }
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
  menuInset: { padding: MENU_INSET },
  menuRow: {
    minHeight: MENU_ROW_HEIGHT,
    borderRadius: scaleUI(12),
    paddingHorizontal: scaleUI(12),
    paddingVertical: scaleUI(8),
  },
  menuLabel: { ...typeScale.controlLabel },
  rowDivider: { height: SELECTION_ROW_GAP, marginHorizontal: scaleUI(16) },
  selectionRow: {
    minHeight: SELECTION_ROW_HEIGHT,
    paddingHorizontal: scaleUI(16),
    paddingVertical: scaleUI(12),
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
