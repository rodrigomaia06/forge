import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { IconName } from '../../types';
import { typeScale } from '../../theme/tokens';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { Button } from './Button';
import { ForgeBottomSheet, ForgeBottomSheetHandle } from './ForgeBottomSheet';
import { ForgeFloatingCta } from './ForgeFloatingCta';
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
}: {
  visible: boolean;
  filters: CatalogFilterState;
  facets: CatalogFilterFacet[];
  onApply: (filters: CatalogFilterState) => void;
  onClose: () => void;
  testID?: string;
}) {
  return (
    <ForgeBottomSheet
      testID={testID}
      visible={visible}
      onClose={onClose}
      accessibilityLabel="Close exercise filters"
      initialOffset={620}
      closeDistance={620}
      dismissThreshold={220}
    >
      {(close) => (
        <>
          <ForgeBottomSheetHandle />
          <ForgeCatalogFilterContent filters={filters} facets={facets} onApply={(next) => { onApply(next); close(); }} onCancel={close} />
        </>
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
}: {
  filters: CatalogFilterState;
  facets: CatalogFilterFacet[];
  onApply: (filters: CatalogFilterState) => void;
  onCancel: () => void;
  /** Fill a parent sheet instead of creating a second sheet-sized region. */
  fill?: boolean;
}) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const [draft, setDraft] = useState<CatalogFilterState>(filters);
  const count = catalogFilterCount(draft);
  useEffect(() => setDraft(filters), [filters]);
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
  return (
    <View style={fill ? styles.sheetFill : styles.sheet}>
      <ForgeSheetHeader
        title="Filters"
        onClose={onCancel}
        closeAccessibilityLabel="Cancel exercise filters"
        leading={count > 0 ? <Button accessibilityLabel="Clear filter draft" label="Clear" variant="secondary" onPress={() => setDraft(emptyCatalogFilters())} style={styles.clearDraft} /> : undefined}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {facets.map((facet) => (
          <View key={facet.key} style={styles.facet}>
            <View style={styles.heading}>
              <Icon name={facet.icon} size={18} color={theme.ink} />
              <Text style={styles.title}>{facet.title}</Text>
            </View>
            <View style={styles.options}>
              {choicesFor(facet, draft).map((option) => {
                const selected = draft[facet.key].includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Filter ${facet.title}: ${option.label}`}
                    accessibilityState={{ checked: selected }}
                    unstable_pressDelay={80}
                    onPress={() => toggle(facet.key, option.value)}
                    style={({ pressed }) => [styles.option, selected && { borderColor: theme.selectionIndicator, backgroundColor: theme.surfaceMuted }, pressed && pressedFeedback]}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    {selected && <Icon name="check" size={16} color={theme.ink} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <ForgeFloatingCta
        label={count ? `Apply (${count})` : 'Apply'}
        accessibilityLabel={count ? `Apply (${count})` : 'Apply'}
        onPress={() => onApply(draft)}
        disabled={count === 0}
        tone="success"
      />
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
  sheet: { height: '82%' },
  // This is intentionally a separate style, rather than an override of `sheet`.
  // React Native retains percentage dimensions in some native style merges.
  sheetFill: { flex: 1, alignSelf: 'stretch' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 142, gap: 16 },
  facet: { gap: 7 },
  heading: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...typeScale.sectionTitle, color: theme.slate },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 19,
    backgroundColor: theme.surface,
  },
  optionText: { ...typeScale.label, color: theme.ink },
  clearDraft: { paddingHorizontal: 14, borderRadius: 22 },
  tokenBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tokenScroll: { flex: 1 },
  tokens: { gap: 8, alignItems: 'center', paddingVertical: 2 },
  token: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surfaceMuted },
  lockedToken: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: theme.border, borderRadius: 18, backgroundColor: theme.surfaceMuted },
  lockedTokenText: { ...typeScale.label, color: theme.slate },
  clearAll: { flexShrink: 0, minHeight: 40, paddingHorizontal: 12, borderRadius: 20 },
});
