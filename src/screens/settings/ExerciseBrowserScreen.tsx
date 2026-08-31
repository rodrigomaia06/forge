import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AppScreen,
  Button,
  ForgeBottomSheet,
  ForgeBottomSheetHandle,
  ForgeText as Text,
  ForgeTextInput as TextInput,
  Icon,
  lightHaptic,
  mediumHaptic,
  pressedFeedback,
  selectionHaptic,
} from '../../components/ui';
import type { ExerciseCatalogItem } from '../../data/exerciseCatalog';
import { useExerciseCatalog } from '../../state/ExerciseCatalogContext';
import { useSettings } from '../../state/SettingsContext';
import { useForgeTheme } from '../../theme/ThemeProvider';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typeScale } from '../../theme/tokens';
import type { RootStackParamList } from '../../types';
import { SettingsDetailHeader } from './SettingsScreenChrome';
import { catalogFacets, filterCatalog, groupCatalogByMovement } from '../../domain/exercises/catalogSelectors';

type Props = NativeStackScreenProps<RootStackParamList, 'ExerciseBrowser'>;
type Filters = { types: string[]; equipment: string[]; categories: string[] };

export function ExerciseBrowserScreen({ navigation, route }: Props) {
  const theme = useForgeTheme();
  const styles = useThemedStyles(createStyles);
  const { preferences } = useSettings();
  const catalog = useExerciseCatalog();
  const fixedTypeId = route.params?.workoutTypeId;
  const customOnly = route.params?.custom === true;
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({ types: [], equipment: [], categories: [] });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [formParent, setFormParent] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<ExerciseCatalogItem | null>(null);
  const [detail, setDetail] = useState<ExerciseCatalogItem | null>(null);
  const source = customOnly ? catalog.customExercises : catalog.exercises;
  const title = customOnly
    ? 'Custom exercises'
    : (preferences.workoutTypes.find((item) => item.id === fixedTypeId)?.name ?? 'All exercises');
  const visibleTypes = preferences.workoutTypes.filter((item) => !item.hidden);
  const toggle = (key: keyof Filters, value: string) => {
    selectionHaptic();
    setFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };
  const active = filters.types.length + filters.equipment.length + filters.categories.length;
  const filtered = useMemo(
    () =>
      filterCatalog(source, { query, types: filters.types, equipment: filters.equipment, categories: filters.categories, includeGroupInSearch: true }).filter((item) => !fixedTypeId || item.workoutTypeIds.includes(fixedTypeId)),
    [source, fixedTypeId, filters, query],
  );
  const groups = useMemo(
    () =>
      groupCatalogByMovement(filtered),
    [filtered],
  );
  const { equipment, categories } = catalogFacets(source);
  const openCreate = (parent: string | null) => {
    lightHaptic();
    setEditing(null);
    setName('');
    setFormParent(parent);
  };
  const openEdit = (item: ExerciseCatalogItem) => {
    lightHaptic();
    setDetail(null);
    setEditing(item);
    setName(item.variation || item.name);
    setFormParent(item.group);
  };
  const save = () => {
    if (!name.trim()) return;
    const parent = catalog.exercises.find((item) => item.group === formParent);
    const exercise = {
      id: editing?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      group: formParent || name.trim(),
      variation: name.trim(),
      equipment: editing?.equipment ?? parent?.equipment ?? 'Bodyweight',
      category: editing?.category ?? parent?.category ?? 'Accessories',
      aliases: editing?.aliases ?? [],
      workoutTypeIds:
        editing?.workoutTypeIds ??
        parent?.workoutTypeIds ??
        (fixedTypeId ? [fixedTypeId] : ['strength']),
    };
    if (editing) catalog.updateCustomExercise(exercise);
    else catalog.addCustomExercise(exercise);
    mediumHaptic();
    setFormParent(undefined);
    setEditing(null);
  };
  return (
    <AppScreen backgroundColor={theme.background}>
      <View style={styles.screen}>
        <SettingsDetailHeader
          title={title}
          navigation={navigation}
          backAccessibilityLabel="Back to Exercises"
          rightAction={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create custom exercise"
              onPress={() => openCreate(null)}
              style={styles.add}
            >
              <Icon name="add" size={21} color={theme.textPrimary} />
            </Pressable>
          }
        />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <Icon name="search" size={20} color={theme.slate} />
              <TextInput
                accessibilityLabel="Search exercises"
                value={query}
                onChangeText={setQuery}
                placeholder="Search exercises"
                placeholderTextColor={theme.muted}
                style={styles.searchInput}
              />
            </View>
            {!customOnly && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filters"
                onPress={() => {
                  lightHaptic();
                  setFiltersOpen(true);
                }}
                style={styles.filters}
              >
                <Icon name="filter" size={18} color={theme.textPrimary} />
                <Text style={styles.filtersText}>Filters</Text>
              </Pressable>
            )}
          </View>
          {!customOnly && active > 0 && (
            <ScrollView
              horizontal
              contentContainerStyle={styles.chips}
              showsHorizontalScrollIndicator={false}
            >
              {(
                [
                  ['types', filters.types],
                  ['equipment', filters.equipment],
                  ['categories', filters.categories],
                ] as const
              ).flatMap(([key, values]) =>
                values.map((value) => (
                  <Pressable
                    key={`${key}-${value}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${value} filter`}
                    onPress={() => toggle(key, value)}
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>
                      {visibleTypes.find((type) => type.id === value)?.name ?? value}
                    </Text>
                    <Icon name="close" size={14} color={theme.textPrimary} />
                  </Pressable>
                )),
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                onPress={() => setFilters({ types: [], equipment: [], categories: [] })}
              >
                <Text style={styles.clear}>Clear all</Text>
              </Pressable>
            </ScrollView>
          )}
          {groups.map(([group, items]) => (
            <Movement
              key={group}
              group={group}
              items={items}
              expanded={expanded === group}
              onToggle={() => {
                selectionHaptic();
                setExpanded(expanded === group ? null : group);
              }}
              onOpen={setDetail}
              onAdd={() => openCreate(group)}
            />
          ))}
          {!groups.length && (
            <View style={styles.empty}>
              <Text style={styles.movementName}>No exercises found</Text>
              <Text style={styles.meta}>Try removing a filter or create a custom exercise.</Text>
            </View>
          )}
        </ScrollView>
        <ForgeBottomSheet
          testID="exercise-filter-sheet"
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          accessibilityLabel="Close exercise filters"
        >
          {(close) => (
            <View style={styles.sheet}>
              <ForgeBottomSheetHandle />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Filters</Text>
                {active > 0 && (
                  <Pressable
                    accessibilityLabel="Clear all filters"
                    onPress={() => setFilters({ types: [], equipment: [], categories: [] })}
                  >
                    <Text style={styles.clear}>Clear all</Text>
                  </Pressable>
                )}
              </View>
              <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
                {!fixedTypeId && (
                  <FilterSection
                    title="Workout type"
                    values={visibleTypes.map((item) => [item.id, item.name])}
                    selected={filters.types}
                    onToggle={(value) => toggle('types', value)}
                  />
                )}
                <FilterSection
                  title="Equipment"
                  values={equipment.map((value) => [value, value])}
                  selected={filters.equipment}
                  onToggle={(value) => toggle('equipment', value)}
                />
                <FilterSection
                  title="Muscle group"
                  values={categories.map((value) => [value, value])}
                  selected={filters.categories}
                  onToggle={(value) => toggle('categories', value)}
                />
              </ScrollView>
              <View style={styles.footer}>
                <Button label="Done" onPress={close} />
              </View>
            </View>
          )}
        </ForgeBottomSheet>
        <ForgeBottomSheet
          visible={formParent !== undefined}
          onClose={() => setFormParent(undefined)}
          accessibilityLabel="Close custom exercise form"
        >
          {(close) => (
            <View style={styles.formSheet}>
              <ForgeBottomSheetHandle />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  {editing
                    ? 'Edit variation'
                    : formParent
                      ? 'Add variation'
                      : 'New custom exercise'}
                </Text>
              </View>
              <View style={styles.form}>
                <TextInput
                  accessibilityLabel="Exercise name"
                  value={name}
                  onChangeText={setName}
                  placeholder={formParent ? 'Variation name' : 'Exercise name'}
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
                <Text style={styles.meta}>
                  {formParent
                    ? `Added to ${formParent}.`
                    : 'Create a new movement for your catalogue.'}
                </Text>
              </View>
              <View style={styles.footer}>
                <Button
                  label={editing ? 'Save changes' : 'Save variation'}
                  disabled={!name.trim()}
                  onPress={() => {
                    save();
                    close();
                  }}
                />
              </View>
            </View>
          )}
        </ForgeBottomSheet>
        <ForgeBottomSheet
          visible={detail !== null}
          onClose={() => setDetail(null)}
          accessibilityLabel="Close exercise details"
        >
          {(close) =>
            detail && (
              <View style={styles.detailSheet}>
                <ForgeBottomSheetHandle />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>{detail.variation || detail.name}</Text>
                </View>
                <View style={styles.form}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Equipment</Text>
                    <Text style={styles.detailValue}>{detail.equipment}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Muscle group</Text>
                    <Text style={styles.detailValue}>{detail.category}</Text>
                  </View>
                  {catalog.customExercises.some((item) => item.id === detail.id) ? (
                    <>
                      <Button
                        label="Edit variation"
                        variant="outline"
                        onPress={() => {
                          close();
                          openEdit(detail);
                        }}
                      />
                      <Button
                        label="Delete variation"
                        variant="outline"
                        tone="destructive"
                        labelColor={theme.textDestructive}
                        onPress={() => {
                          catalog.removeCustomExercise(detail.id);
                          mediumHaptic();
                          close();
                        }}
                      />
                    </>
                  ) : null}
                </View>
              </View>
            )
          }
        </ForgeBottomSheet>
      </View>
    </AppScreen>
  );
}

function FilterSection({
  title,
  values,
  selected,
  onToggle,
}: {
  title: string;
  values: string[][];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterTitle}>{title}</Text>
      {values.map(([value, label]) => (
        <Pressable
          key={value}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected.includes(value) }}
          onPress={() => onToggle(value)}
          style={({ pressed }) => [styles.option, pressed && pressedFeedback]}
        >
          <Text style={styles.optionText}>{label}</Text>
          <View style={[styles.check, selected.includes(value) && styles.checkSelected]}>
            {selected.includes(value) && <Icon name="check" size={14} color={theme.background} />}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
function Movement({
  group,
  items,
  expanded,
  onToggle,
  onOpen,
  onAdd,
}: {
  group: string;
  items: ExerciseCatalogItem[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: (item: ExerciseCatalogItem) => void;
  onAdd: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const theme = useForgeTheme();
  const equipment = Object.entries(
    items.reduce<Record<string, ExerciseCatalogItem[]>>((result, item) => {
      (result[item.equipment] ??= []).push(item);
      return result;
    }, {}),
  );
  if (items.length === 1) {
    const item = items[0];
    return (
      <View style={styles.movement}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${group}`}
          onPress={() => {
            lightHaptic();
            onOpen(item);
          }}
          style={styles.movementRow}
        >
          <View style={styles.copy}>
            <Text style={styles.movementName}>{group}</Text>
            <Text style={styles.meta}>
              {item.equipment} · {item.category}
            </Text>
          </View>
          <Icon name="chevron-forward" size={21} color={theme.textPrimary} />
        </Pressable>
      </View>
    );
  }
  return (
    <View style={styles.movement}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${group}, ${items.length} variations`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.movementRow}
      >
        <View style={styles.copy}>
          <Text style={styles.movementName}>{group}</Text>
          <Text style={styles.meta}>
            {items.length} {items.length === 1 ? 'variation' : 'variations'}
          </Text>
        </View>
        <Icon
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={21}
          color={theme.textPrimary}
        />
      </Pressable>
      {expanded && (
        <View style={styles.variations}>
          {equipment.map(([label, variants]) => (
            <View key={label} style={styles.equipmentGroup}>
              <Text style={styles.equipmentTitle}>{label}</Text>
              {variants.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => {
                    lightHaptic();
                    onOpen(item);
                  }}
                  style={({ pressed }) => [
                    styles.variation,
                    pressed && { backgroundColor: theme.pressed },
                  ]}
                >
                  <Text style={styles.variationName}>{item.variation || item.name}</Text>
                  <Icon name="chevron-forward" size={17} color={theme.slate} />
                </Pressable>
              ))}
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              lightHaptic();
              onAdd();
            }}
            style={styles.addVariation}
          >
            <Icon name="add" size={18} color={theme.textPrimary} />
            <Text style={styles.addText}>Add variation</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const createStyles = (theme: import('../../types').ForgeTheme) =>
  StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 20, paddingTop: 22, paddingBottom: 40, gap: 14 },
    add: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
    },
    searchRow: { flexDirection: 'row', gap: 8 },
    search: {
      flex: 1,
      minHeight: 48,
      paddingHorizontal: 13,
      borderRadius: 14,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    searchInput: { flex: 1, color: theme.ink, ...typeScale.body, paddingVertical: 0 },
    filters: {
      minHeight: 48,
      paddingHorizontal: 13,
      borderRadius: 14,
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    filtersText: { ...typeScale.controlLabel, color: theme.textPrimary },
    chips: { gap: 8, alignItems: 'center' },
    chip: {
      minHeight: 34,
      paddingHorizontal: 11,
      borderRadius: 17,
      gap: 5,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    chipText: { ...typeScale.label, color: theme.textPrimary },
    clear: { ...typeScale.label, color: theme.inkInteractive },
    movement: {
      overflow: 'hidden',
      borderRadius: theme.cardRadius,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    movementRow: {
      minHeight: 76,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    copy: { flex: 1 },
    movementName: { ...typeScale.cardTitle, color: theme.ink },
    meta: { ...typeScale.supporting, color: theme.slate, marginTop: 2 },
    variations: {
      padding: 14,
      backgroundColor: theme.surfaceMuted,
      borderTopWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    equipmentGroup: {
      overflow: 'hidden',
      borderRadius: 12,
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    equipmentTitle: {
      ...typeScale.label,
      color: theme.slate,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 5,
    },
    variation: {
      minHeight: 46,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    variationName: { ...typeScale.body, color: theme.ink },
    addVariation: { minHeight: 40, flexDirection: 'row', gap: 7, alignItems: 'center' },
    addText: { ...typeScale.controlLabel, color: theme.textPrimary },
    empty: { paddingTop: 60, alignItems: 'center' },
    sheet: { height: '78%' },
    formSheet: { height: '50%' },
    detailSheet: { minHeight: 230 },
    detailRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    detailLabel: { ...typeScale.label, color: theme.slate },
    detailValue: { ...typeScale.body, color: theme.ink },
    sheetHeader: {
      minHeight: 60,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sheetTitle: { ...typeScale.headerTitle, color: theme.ink },
    filterScroll: { flex: 1 },
    filterContent: { padding: 20, paddingTop: 4, gap: 22, paddingBottom: 24 },
    filterSection: { gap: 8 },
    filterTitle: { ...typeScale.sectionTitle, color: theme.slate },
    option: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.divider,
    },
    optionText: { ...typeScale.body, color: theme.ink },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.slate,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkSelected: { borderColor: theme.inkInteractive, backgroundColor: theme.inkInteractive },
    footer: {
      padding: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.divider,
    },
    form: { padding: 20, gap: 12 },
    input: {
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.divider,
      color: theme.ink,
      ...typeScale.body,
    },
  });
