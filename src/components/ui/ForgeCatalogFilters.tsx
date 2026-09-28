import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { IconName } from '../../types';
import { typeScale } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { Button } from './Button';
import { ForgeBackButton } from './HeaderAction';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeFloatingCta, useForgeFloatingCtaClearance } from './ForgeFloatingCta';
import { ForgeSearchField } from './ForgeSearchField';
import { ForgeSheetHeader } from './ForgeSheetHeader';
import { ForgeText as Text } from './ForgeText';
import { Icon } from './Icon';
import { pressedFeedback } from './pressFeedback';
import { selectionHaptic } from './haptics';

export type CatalogFilterKey = 'types' | 'equipment' | 'exerciseCategories';
export type CatalogFilterState = Record<CatalogFilterKey, string[]>;
export type CatalogFilterOption = { value: string; label: string };
export type CatalogFilterFacet = {
  key: CatalogFilterKey;
  title: string;
  icon: IconName;
  options: CatalogFilterOption[];
  /** Choices may narrow as earlier draft facets are selected. */
  optionsFor?: (draft: CatalogFilterState) => CatalogFilterOption[];
  readOnly?: boolean;
};

export const emptyCatalogFilters = (): CatalogFilterState => ({
  types: [],
  equipment: [],
  exerciseCategories: [],
});

export function catalogFilterCount(filters: CatalogFilterState): number {
  return filters.types.length + filters.equipment.length + filters.exerciseCategories.length;
}

export function ForgeCatalogFilterSheet({
  visible,
  filters,
  facets,
  onApply,
  onClose,
  testID,
  title = 'Filters',
  closeAccessibilityLabel = 'Cancel exercise filters',
  backdropAccessibilityLabel = 'Close exercise filters',
}: {
  visible: boolean;
  filters: CatalogFilterState;
  facets: CatalogFilterFacet[];
  onApply: (filters: CatalogFilterState) => void;
  onClose: () => void;
  testID?: string;
  /** Name the sheet for another Forge catalogue-like collection. */
  title?: string;
  closeAccessibilityLabel?: string;
  backdropAccessibilityLabel?: string;
}) {
  return (
    <ForgeBottomSheet
      testID={testID}
      surfaceTestID={testID ? `${testID}-surface` : undefined}
      visible={visible}
      onClose={onClose}
      accessibilityLabel={backdropAccessibilityLabel}
      initialOffset={620}
      closeDistance={620}
      dismissThreshold={220}
    >
      {(close) => (
        <ForgeCatalogFilterContent
          filters={filters}
          facets={facets}
          title={title}
          closeAccessibilityLabel={closeAccessibilityLabel}
          headerWithDragHandle
          onApply={(next) => { onApply(next); close(); }}
          onCancel={close}
        />
      )}
    </ForgeBottomSheet>
  );
}

/** Reused inside another Forge sheet when opening a second native modal is unsafe. */
export function ForgeCatalogFilterContent({
  filters,
  facets,
  onApply,
  onCancel,
  fill = false,
  headerWithDragHandle = false,
  title = 'Filters',
  closeAccessibilityLabel = 'Cancel exercise filters',
}: {
  filters: CatalogFilterState;
  facets: CatalogFilterFacet[];
  onApply: (filters: CatalogFilterState) => void;
  onCancel: () => void;
  /** Fill a parent sheet instead of creating a second sheet-sized region. */
  fill?: boolean;
  /** Make the handle and header one safe downward-drag target. */
  headerWithDragHandle?: boolean;
  /** Name the root of this reusable staged-filter flow. */
  title?: string;
  closeAccessibilityLabel?: string;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { height: viewportHeight } = useWindowDimensions();
  const floatingCtaClearance = useForgeFloatingCtaClearance();
  const [draft, setDraft] = useState<CatalogFilterState>(filters);
  const [activeFacetKey, setActiveFacetKey] = useState<CatalogFilterKey | null>(null);
  const [choiceQuery, setChoiceQuery] = useState('');
  // Keep the native input responsive while a longer option list catches up.
  // This is local in-memory filtering, so it remains live rather than waiting
  // for an arbitrary debounce delay.
  const deferredChoiceQuery = useDeferredValue(choiceQuery);
  const count = catalogFilterCount(draft);
  const hasDraftChanges = (['types', 'equipment', 'exerciseCategories'] as const).some(
    (key) => draft[key].length !== filters[key].length || draft[key].some((value) => !filters[key].includes(value)),
  );
  useEffect(() => {
    setDraft(filters);
    setActiveFacetKey(null);
    setChoiceQuery('');
  }, [filters]);
  const choicesFor = (facet: CatalogFilterFacet, next: CatalogFilterState) =>
    facet.optionsFor?.(next) ?? facet.options;
  const reconcileDependentChoices = (next: CatalogFilterState): CatalogFilterState => {
    // A changed type can make an already selected equipment/category impossible.
    // Remove only those stale draft selections, retaining every compatible choice.
    const equipmentFacet = facets.find((facet) => facet.key === 'equipment');
    const permittedEquipment = new Set(equipmentFacet ? choicesFor(equipmentFacet, next).map((option) => option.value) : next.equipment);
    const withEquipment = { ...next, equipment: next.equipment.filter((value) => permittedEquipment.has(value)) };
    const categoryFacet = facets.find((facet) => facet.key === 'exerciseCategories');
    const permittedCategories = new Set(categoryFacet ? choicesFor(categoryFacet, withEquipment).map((option) => option.value) : withEquipment.exerciseCategories);
    return { ...withEquipment, exerciseCategories: withEquipment.exerciseCategories.filter((value) => permittedCategories.has(value)) };
  };
  const toggle = (key: CatalogFilterKey, value: string): void => {
    selectionHaptic();
    setDraft((current) => {
      const next = {
        ...current,
        [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
      };
      return key === 'types' || key === 'equipment' ? reconcileDependentChoices(next) : next;
    });
  };
  const activeFacet = activeFacetKey
    ? facets.find((facet) => facet.key === activeFacetKey) ?? null
    : null;
  const visibleChoices = useMemo(() => {
    if (!activeFacet) return [];
    const normalizedQuery = deferredChoiceQuery.trim().toLocaleLowerCase();
    return choicesFor(activeFacet, draft).filter((option) =>
      option.label.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [activeFacet, deferredChoiceQuery, draft]);
  const header = (
    <ForgeSheetHeader
      title={activeFacet?.title ?? title}
      onClose={onCancel}
      closeAccessibilityLabel={closeAccessibilityLabel}
      leading={activeFacet ? (
        <ForgeBackButton
          accessibilityLabel="Back to filters"
          onPress={() => { setChoiceQuery(''); setActiveFacetKey(null); }}
        />
      ) : count > 0 ? (
        <Button
          accessibilityLabel="Clear filters"
          label="Clear"
          variant="outline"
          tone="destructive"
          onPress={() => setDraft(emptyCatalogFilters())}
          style={styles.headerClearAction}
        />
      ) : undefined}
    />
  );
  return (
    <View testID="catalog-filter-content" style={[
      fill ? styles.sheetFill : activeFacet ? styles.sheetTall : styles.sheetCompact,
      // Size an open facet to its rows and only cap when they overflow (ADR
      // 0005), so a short facet list hugs the header instead of filling a fixed
      // height and leaving dead space above the docked Apply action.
      !fill && activeFacet ? { maxHeight: Math.min(viewportHeight * 0.82, 640) } : undefined,
      // Size the summary to its rows; only constrain it when space runs out.
      !fill && !activeFacet ? { maxHeight: Math.min(viewportHeight * 0.82, 640) } : undefined,
    ]}>
      {headerWithDragHandle ? (
        <>
          <ForgeBottomSheetHandle />
          {header}
        </>
      ) : header}
      {activeFacet ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: floatingCtaClearance }]}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          directionalLockEnabled
        >
          <>
            <ForgeSearchField
              value={choiceQuery}
              onChangeText={setChoiceQuery}
              accessibilityLabel={`Search ${activeFacet.title} filters`}
              placeholder={`Search ${activeFacet.title.toLocaleLowerCase()}`}
              autoFocus
            />
            <View style={styles.choiceCard} accessibilityLabel={`${activeFacet.title} filter choices`}>
            {visibleChoices.map((option, index, options) => {
              const selected = draft[activeFacet.key].includes(option.value);
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Filter ${activeFacet.title}: ${option.label}`}
                  accessibilityState={{ checked: selected }}
                  unstable_pressDelay={80}
                  onPress={() => toggle(activeFacet.key, option.value)}
                  style={({ pressed }) => [
                    styles.choice,
                    selected && { backgroundColor: theme.successSurface },
                    pressed && pressedFeedback,
                  ]}
                >
                  <Text style={styles.choiceText}>{option.label}</Text>
                  {selected ? <Icon name="check" size={20} color={theme.selectionIndicator} weight="bold" /> : null}
                  {index < options.length - 1 ? <View style={[styles.separator, { backgroundColor: theme.divider }]} /> : null}
                </Pressable>
              );
            })}
            {!visibleChoices.length ? (
              <Text style={styles.emptyChoices}>No matching {activeFacet.title.toLocaleLowerCase()} options.</Text>
            ) : null}
          </View>
          </>
        </ScrollView>
      ) : (
        <ScrollView
          testID="catalog-filter-summary-scroll"
          style={fill ? styles.summaryFill : styles.summaryScroll}
          contentContainerStyle={[styles.rootSummary, { paddingBottom: floatingCtaClearance }]}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
        >
          <FilterFacetSummary
            filters={draft}
            facets={facets}
            onOpen={(key) => { selectionHaptic(); setChoiceQuery(''); setActiveFacetKey(key); }}
          />
        </ScrollView>
      )}
      <ForgeFloatingCta
        label={count ? `Apply (${count})` : 'Apply'}
        accessibilityLabel={count ? `Apply (${count})` : 'Apply filters'}
        disabled={!hasDraftChanges}
        tone="success"
        onPress={() => onApply(draft)}
      />
    </View>
  );
}

function FilterFacetSummary({
  filters,
  facets,
  onOpen,
}: {
  filters: CatalogFilterState;
  facets: CatalogFilterFacet[];
  onOpen: (key: CatalogFilterKey) => void;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.facetCard}>
        {facets.map((facet, index) => {
          const selected = filters[facet.key];
          const summary = selected.length
            ? selected.length === 1
              ? facet.options.find((option) => option.value === selected[0])?.label ?? '1 selected'
              : `${selected.length} selected`
            : 'Any';
          return (
            <Pressable
              key={facet.key}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${facet.title} filter, ${summary}`}
              onPress={() => onOpen(facet.key)}
              style={({ pressed }) => [styles.facetRow, pressed && pressedFeedback]}
            >
              <View style={[styles.facetIcon, { backgroundColor: theme.surfaceMuted }]}>
                <Icon name={facet.icon} size={19} color={theme.textPrimary} />
              </View>
              <View style={styles.facetCopy}>
                <Text style={styles.facetTitle}>{facet.title}</Text>
                <Text style={styles.facetSummary}>{summary}</Text>
              </View>
              <Icon name="chevron-forward" size={19} color={theme.textSecondary} />
              {index < facets.length - 1 ? <View style={[styles.separator, styles.facetSeparator, { backgroundColor: theme.divider }]} /> : null}
            </Pressable>
          );
        })}
    </View>
  );
}

export function ForgeCatalogFilterTokens({
  filters,
  facets,
  onRemove,
  onClear,
}: {
  filters: CatalogFilterState;
  facets: CatalogFilterFacet[];
  onRemove: (key: CatalogFilterKey, value: string) => void;
  onClear: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const tokens = useMemo(
    () => facets.flatMap((facet) => filters[facet.key].flatMap((value) => {
      const label = facet.options.find((option) => option.value === value)?.label;
      return label ? [{ key: facet.key, value, label, readOnly: facet.readOnly === true }] : [];
    })),
    [facets, filters],
  );
  if (!tokens.length) return null;
  return (
    <View style={styles.tokenBar}>
      <ScrollView
        horizontal
        style={styles.tokenScroll}
        accessibilityRole="toolbar"
        accessibilityLabel="Applied exercise filters"
        contentContainerStyle={styles.tokens}
        showsHorizontalScrollIndicator={false}
      >
        {tokens.map((token) => token.readOnly ? (
          <View key={`${token.key}-${token.value}`} accessibilityLabel={`Fixed ${token.label} filter`} style={styles.lockedToken}>
            <Text style={styles.lockedTokenText}>{token.label}</Text>
          </View>
        ) : (
          <Button
            key={`${token.key}-${token.value}`}
            accessibilityLabel={`Remove ${token.label} filter`}
            label={token.label}
            icon="close"
            iconSize={14}
            variant="ghost"
            onPress={() => onRemove(token.key, token.value)}
            style={styles.token}
          />
        ))}
      </ScrollView>
      <Button
        accessibilityLabel="Clear all filters"
        label="Clear all"
        variant="secondary"
        onPress={onClear}
        style={styles.clearAll}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useForgeTheme>) => StyleSheet.create({
  sheetTall: { alignSelf: 'stretch' },
  // The root has a little presentation room; only an open choice list owns a
  // tall capped scroll region.
  sheetCompact: { alignSelf: 'stretch', flexShrink: 1 },
  // This is intentionally a separate style, rather than an override of `sheet`.
  // React Native retains percentage dimensions in some native style merges.
  sheetFill: { flex: 1, alignSelf: 'stretch' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  summaryScroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  summaryFill: { flex: 1, minHeight: 0 },
  // A root summary is normally compact, but remains a real bounded scroll
  // container when text scaling or future facets exceed that compact sheet.
  rootSummary: { paddingHorizontal: 20, paddingTop: 8 },
  facetCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: theme.surface },
  facetRow: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  facetIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  facetCopy: { flex: 1, minWidth: 0 },
  facetTitle: { ...typeScale.cardTitle, color: theme.textPrimary },
  facetSummary: { ...typeScale.supporting, color: theme.textSecondary, marginTop: 1 },
  choiceCard: { overflow: 'hidden', borderRadius: 20, backgroundColor: theme.surface },
  choice: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  choiceText: { flex: 1, ...typeScale.cardTitle, color: theme.textPrimary },
  separator: { position: 'absolute', right: 16, bottom: 0, left: 16, height: StyleSheet.hairlineWidth, pointerEvents: 'none' },
  facetSeparator: { left: 64 },
  emptyChoices: { padding: 20, ...typeScale.supporting, color: theme.textSecondary },
  headerClearAction: { minHeight: 38, paddingHorizontal: 12, borderRadius: 14 },
  tokenBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenScroll: { flex: 1 },
  tokens: { gap: 8, alignItems: 'center', paddingVertical: 2 },
  token: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
  lockedToken: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border, borderRadius: 18, backgroundColor: theme.surfaceMuted },
  lockedTokenText: { ...typeScale.label, color: theme.slate },
  clearAll: { flexShrink: 0, minHeight: 40, paddingHorizontal: 12, borderRadius: 20 },
});
